import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

function normalizePostgresUrl(rawUrl) {
  if (!rawUrl) return rawUrl;

  try {
    new URL(rawUrl);
    return rawUrl;
  } catch {
    const scheme = 'postgresql://';
    if (!rawUrl.startsWith(scheme)) {
      throw new Error('DATABASE_URL is invalid and does not start with postgresql://');
    }

    const tail = rawUrl.slice(scheme.length);
    const atIndex = tail.lastIndexOf('@');
    if (atIndex === -1) {
      throw new Error('DATABASE_URL is invalid and missing host section.');
    }

    const authPart = tail.slice(0, atIndex);
    const hostAndDb = tail.slice(atIndex + 1);
    const slashAfterHost = hostAndDb.indexOf('/');
    if (slashAfterHost === -1) {
      throw new Error('DATABASE_URL is invalid and missing database name.');
    }

    const hostPart = hostAndDb.slice(0, slashAfterHost);
    const dbPath = hostAndDb.slice(slashAfterHost);
    const colonIndex = authPart.indexOf(':');
    if (colonIndex === -1) {
      throw new Error('DATABASE_URL is invalid and missing password section.');
    }

    const username = authPart.slice(0, colonIndex);
    const passwordRaw = authPart.slice(colonIndex + 1);
    const encodedPassword = encodeURIComponent(passwordRaw);

    return `${scheme}${username}:${encodedPassword}@${hostPart}${dbPath}`;
  }
}

const databaseUrl = normalizePostgresUrl(
  process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL
);

if (!databaseUrl) {
  throw new Error('Missing SUPABASE_DATABASE_URL or DATABASE_URL in environment variables.');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('supabase.com')
    ? { rejectUnauthorized: false }
    : false,
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      theme TEXT NOT NULL DEFAULT 'General',
      lyrics TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      cloudinary_id TEXT,
      filename TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      songs JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        folder: 'shadowshrine',
        timeout: 600000,
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
}

function sanitizePublicId(originalname) {
  const nameWithoutExt = originalname.replace(/\.[^.]+$/, '');
  const sanitized = nameWithoutExt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `${Date.now()}_${sanitized || 'audio'}`;
}

function mapSongRow(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    note: row.note,
    theme: row.theme,
    lyrics: row.lyrics,
    url: row.url,
    cloudinary_id: row.cloudinary_id,
    filename: row.filename,
    createdAt: row.created_at,
  };
}

function mapPlaylistRow(row) {
  return {
    id: row.id,
    name: row.name,
    songs: Array.isArray(row.songs) ? row.songs : [],
    createdAt: row.created_at,
  };
}

app.get('/api/songs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM songs ORDER BY created_at DESC');
    res.json(result.rows.map(mapSongRow));
  } catch (error) {
    console.error('Failed to read songs:', error);
    res.status(500).json({ error: 'Failed to read songs data' });
  }
});

app.post('/api/songs', upload.single('file'), async (req, res) => {
  req.setTimeout(600000);
  res.setTimeout(600000);

  try {
    const { title, author, note, theme, lyrics } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    console.log(`Uploading "${file.originalname}" (${fileSizeMB}MB) to Cloudinary...`);

    const publicId = sanitizePublicId(file.originalname);
    const cloud = await uploadToCloudinary(file.buffer, { public_id: publicId });

    const newSong = {
      id: Date.now().toString(),
      title: title || file.originalname,
      author: author || 'Unknown',
      note: note || '',
      theme: theme || 'General',
      lyrics: lyrics || '',
      url: cloud.secure_url,
      cloudinary_id: cloud.public_id,
      filename: file.originalname,
    };

    await pool.query(
      `INSERT INTO songs (id, title, author, note, theme, lyrics, url, cloudinary_id, filename)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        newSong.id,
        newSong.title,
        newSong.author,
        newSong.note,
        newSong.theme,
        newSong.lyrics,
        newSong.url,
        newSong.cloudinary_id,
        newSong.filename,
      ]
    );

    const created = await pool.query('SELECT * FROM songs WHERE id = $1', [newSong.id]);
    res.status(201).json(mapSongRow(created.rows[0]));
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    let errorMsg = 'Failed to upload song to Cloudinary';
    if (error.message) errorMsg += `: ${error.message}`;
    if (error.http_code) errorMsg += ` (HTTP ${error.http_code})`;
    res.status(500).json({ error: errorMsg });
  }
});

app.put('/api/songs/:id', async (req, res) => {
  try {
    const { title, author, note, theme, lyrics } = req.body;
    const songId = req.params.id;

    const existing = await pool.query('SELECT * FROM songs WHERE id = $1', [songId]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const current = existing.rows[0];
    const updated = await pool.query(
      `UPDATE songs
       SET title = $1, author = $2, note = $3, theme = $4, lyrics = $5
       WHERE id = $6
       RETURNING *`,
      [
        title ?? current.title,
        author ?? current.author,
        note ?? current.note,
        theme ?? current.theme,
        lyrics ?? current.lyrics,
        songId,
      ]
    );

    res.json(mapSongRow(updated.rows[0]));
  } catch (error) {
    console.error('Error updating song:', error);
    res.status(500).json({ error: 'Failed to update song' });
  }
});

app.delete('/api/songs/:id', async (req, res) => {
  try {
    const songId = req.params.id;
    const existing = await pool.query('SELECT * FROM songs WHERE id = $1', [songId]);

    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const song = existing.rows[0];

    if (song.cloudinary_id) {
      try {
        await cloudinary.uploader.destroy(song.cloudinary_id, { resource_type: 'video' });
        console.log(`Deleted from Cloudinary: ${song.cloudinary_id}`);
      } catch (cloudErr) {
        console.error('Cloudinary delete error (non-fatal):', cloudErr);
      }
    }

    await pool.query('DELETE FROM songs WHERE id = $1', [songId]);
    await pool.query(
      `UPDATE playlists
       SET songs = COALESCE((
         SELECT jsonb_agg(song_id)
         FROM jsonb_array_elements_text(playlists.songs) AS song_id
         WHERE song_id <> $1
       ), '[]'::jsonb)
       WHERE songs ? $1`,
      [songId]
    );

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

app.get('/api/playlists', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM playlists ORDER BY created_at DESC');
    res.json(result.rows.map(mapPlaylistRow));
  } catch (error) {
    console.error('Failed to read playlists:', error);
    res.status(500).json({ error: 'Failed to read playlists data' });
  }
});

app.post('/api/playlists', async (req, res) => {
  try {
    const { id, name, songs } = req.body;

    if (id) {
      const updated = await pool.query(
        `UPDATE playlists
         SET name = $1,
             songs = $2::jsonb
         WHERE id = $3
         RETURNING *`,
        [name || 'New Playlist', JSON.stringify(songs || []), id]
      );

      if (updated.rowCount > 0) {
        return res.json(mapPlaylistRow(updated.rows[0]));
      }
    }

    const newId = Date.now().toString();
    const created = await pool.query(
      `INSERT INTO playlists (id, name, songs)
       VALUES ($1,$2,$3::jsonb)
       RETURNING *`,
      [newId, name || 'New Playlist', JSON.stringify(songs || [])]
    );

    res.status(201).json(mapPlaylistRow(created.rows[0]));
  } catch (error) {
    console.error('Failed to save playlist:', error);
    res.status(500).json({ error: 'Failed to save playlist' });
  }
});

app.use((req, res) => {
  if (req.method === 'GET' && !req.url.startsWith('/api')) {
    const indexHtml = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      res.status(404).send('Frontend build (dist) not found. Please run "npm run build" first.');
    }
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

async function start() {
  await ensureSchema();

  const server = app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Cloudinary cloud: ${process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET'}`);
  });

  server.timeout = 600000;
  server.keepAliveTimeout = 120000;
}

start().catch((error) => {
  console.error('Failed to initialize server:', error);
  process.exit(1);
});
