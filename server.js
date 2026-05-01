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
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const dataDir = path.join(__dirname, 'data');
const songsJsonFile = path.join(dataDir, 'songs.json');
const playlistsJsonFile = path.join(dataDir, 'playlists.json');

function ensureJsonFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(songsJsonFile)) fs.writeFileSync(songsJsonFile, '[]');
  if (!fs.existsSync(playlistsJsonFile)) fs.writeFileSync(playlistsJsonFile, '[]');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function normalizePostgresUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    new URL(rawUrl);
    return rawUrl;
  } catch {
    const scheme = 'postgresql://';
    if (!rawUrl.startsWith(scheme)) {
      throw new Error('DATABASE_URL invalid: must start with postgresql://');
    }

    const tail = rawUrl.slice(scheme.length);
    const atIndex = tail.lastIndexOf('@');
    if (atIndex === -1) throw new Error('DATABASE_URL invalid: missing host section');

    const authPart = tail.slice(0, atIndex);
    const hostAndDb = tail.slice(atIndex + 1);
    const slashAfterHost = hostAndDb.indexOf('/');
    if (slashAfterHost === -1) throw new Error('DATABASE_URL invalid: missing db name');

    const hostPart = hostAndDb.slice(0, slashAfterHost);
    const dbPath = hostAndDb.slice(slashAfterHost);
    const colonIndex = authPart.indexOf(':');
    if (colonIndex === -1) throw new Error('DATABASE_URL invalid: missing password section');

    const username = authPart.slice(0, colonIndex);
    const passwordRaw = authPart.slice(colonIndex + 1);
    const encodedPassword = encodeURIComponent(passwordRaw);

    return `${scheme}${username}:${encodedPassword}@${hostPart}${dbPath}`;
  }
}

const databaseUrl = normalizePostgresUrl(
  process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL
);

const usePostgres = Boolean(databaseUrl);
let pool = null;

if (usePostgres) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase.com') ? { rejectUnauthorized: false } : false,
  });
} else {
  ensureJsonFiles();
  console.warn('SUPABASE_DATABASE_URL/DATABASE_URL not set. Falling back to JSON storage.');
}

async function ensureSchema() {
  if (!pool) return;
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

async function getSongs() {
  if (pool) {
    const result = await pool.query('SELECT * FROM songs ORDER BY created_at DESC');
    return result.rows.map(mapSongRow);
  }
  return readJson(songsJsonFile);
}

async function insertSong(song) {
  if (pool) {
    await pool.query(
      `INSERT INTO songs (id, title, author, note, theme, lyrics, url, cloudinary_id, filename)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [song.id, song.title, song.author, song.note, song.theme, song.lyrics, song.url, song.cloudinary_id, song.filename]
    );
    const created = await pool.query('SELECT * FROM songs WHERE id = $1', [song.id]);
    return mapSongRow(created.rows[0]);
  }

  const songs = readJson(songsJsonFile);
  const out = { ...song, createdAt: new Date().toISOString() };
  songs.push(out);
  writeJson(songsJsonFile, songs);
  return out;
}

async function updateSongById(songId, patch) {
  if (pool) {
    const existing = await pool.query('SELECT * FROM songs WHERE id = $1', [songId]);
    if (existing.rowCount === 0) return null;
    const current = existing.rows[0];
    const updated = await pool.query(
      `UPDATE songs SET title = $1, author = $2, note = $3, theme = $4, lyrics = $5 WHERE id = $6 RETURNING *`,
      [
        patch.title ?? current.title,
        patch.author ?? current.author,
        patch.note ?? current.note,
        patch.theme ?? current.theme,
        patch.lyrics ?? current.lyrics,
        songId,
      ]
    );
    return mapSongRow(updated.rows[0]);
  }

  const songs = readJson(songsJsonFile);
  const idx = songs.findIndex((s) => s.id === songId);
  if (idx === -1) return null;
  songs[idx] = { ...songs[idx], ...patch };
  writeJson(songsJsonFile, songs);
  return songs[idx];
}

async function deleteSongById(songId) {
  if (pool) {
    const existing = await pool.query('SELECT * FROM songs WHERE id = $1', [songId]);
    if (existing.rowCount === 0) return null;
    const song = mapSongRow(existing.rows[0]);

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

    return song;
  }

  const songs = readJson(songsJsonFile);
  const idx = songs.findIndex((s) => s.id === songId);
  if (idx === -1) return null;
  const [song] = songs.splice(idx, 1);
  writeJson(songsJsonFile, songs);

  const playlists = readJson(playlistsJsonFile);
  const normalized = playlists.map((p) => ({ ...p, songs: (p.songs || []).filter((id) => id !== songId) }));
  writeJson(playlistsJsonFile, normalized);
  return song;
}

async function getPlaylists() {
  if (pool) {
    const result = await pool.query('SELECT * FROM playlists ORDER BY created_at DESC');
    return result.rows.map(mapPlaylistRow);
  }
  return readJson(playlistsJsonFile);
}

async function upsertPlaylist({ id, name, songs }) {
  const safeName = name || 'New Playlist';
  const safeSongs = Array.isArray(songs) ? songs : [];

  if (pool) {
    if (id) {
      const updated = await pool.query(
        `UPDATE playlists SET name = $1, songs = $2::jsonb WHERE id = $3 RETURNING *`,
        [safeName, JSON.stringify(safeSongs), id]
      );
      if (updated.rowCount > 0) return mapPlaylistRow(updated.rows[0]);
    }

    const newId = Date.now().toString();
    const created = await pool.query(
      `INSERT INTO playlists (id, name, songs) VALUES ($1,$2,$3::jsonb) RETURNING *`,
      [newId, safeName, JSON.stringify(safeSongs)]
    );
    return mapPlaylistRow(created.rows[0]);
  }

  const playlists = readJson(playlistsJsonFile);
  if (id) {
    const idx = playlists.findIndex((p) => p.id === id);
    if (idx !== -1) {
      playlists[idx] = { ...playlists[idx], name: safeName, songs: safeSongs };
      writeJson(playlistsJsonFile, playlists);
      return playlists[idx];
    }
  }

  const created = { id: Date.now().toString(), name: safeName, songs: safeSongs, createdAt: new Date().toISOString() };
  playlists.push(created);
  writeJson(playlistsJsonFile, playlists);
  return created;
}

function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'video', folder: 'shadowshrine', timeout: 600000, ...options },
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

app.get('/api/upload-signature', (req, res) => {
  try {
    const filename = String(req.query.filename || 'audio');
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'shadowshrine';
    const public_id = sanitizePublicId(filename);

    const paramsToSign = { timestamp, folder, public_id };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

    res.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      folder,
      publicId: public_id,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate upload signature' });
  }
});

app.get('/api/songs', async (req, res) => {
  try {
    res.json(await getSongs());
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
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const publicId = sanitizePublicId(file.originalname);
    const cloud = await uploadToCloudinary(file.buffer, { public_id: publicId });

    const created = await insertSong({
      id: Date.now().toString(),
      title: title || file.originalname,
      author: author || 'Unknown',
      note: note || '',
      theme: theme || 'General',
      lyrics: lyrics || '',
      url: cloud.secure_url,
      cloudinary_id: cloud.public_id,
      filename: file.originalname,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: `Failed to upload song to Cloudinary: ${error.message || 'Unknown error'}` });
  }
});

app.post('/api/songs/metadata', async (req, res) => {
  try {
    const { title, author, note, theme, lyrics, url, cloudinary_id, filename } = req.body;
    if (!url || !cloudinary_id || !filename) {
      return res.status(400).json({ error: 'Missing cloudinary metadata' });
    }

    const created = await insertSong({
      id: Date.now().toString(),
      title: title || filename,
      author: author || 'Unknown',
      note: note || '',
      theme: theme || 'General',
      lyrics: lyrics || '',
      url,
      cloudinary_id,
      filename,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Metadata save error:', error);
    res.status(500).json({ error: 'Failed to save song metadata' });
  }
});

app.put('/api/songs/:id', async (req, res) => {
  try {
    const updated = await updateSongById(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Song not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating song:', error);
    res.status(500).json({ error: 'Failed to update song' });
  }
});

app.delete('/api/songs/:id', async (req, res) => {
  try {
    const song = await deleteSongById(req.params.id);
    if (!song) return res.status(404).json({ error: 'Song not found' });

    if (song.cloudinary_id) {
      try {
        await cloudinary.uploader.destroy(song.cloudinary_id, { resource_type: 'video' });
      } catch (cloudErr) {
        console.error('Cloudinary delete error (non-fatal):', cloudErr);
      }
    }

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

app.get('/api/playlists', async (req, res) => {
  try {
    res.json(await getPlaylists());
  } catch (error) {
    console.error('Failed to read playlists:', error);
    res.status(500).json({ error: 'Failed to read playlists data' });
  }
});

app.post('/api/playlists', async (req, res) => {
  try {
    const out = await upsertPlaylist(req.body || {});
    res.status(req.body?.id ? 200 : 201).json(out);
  } catch (error) {
    console.error('Failed to save playlist:', error);
    res.status(500).json({ error: 'Failed to save playlist' });
  }
});

app.use((req, res) => {
  if (req.method === 'GET' && !req.url.startsWith('/api')) {
    const indexHtml = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
    return res.status(404).send('Frontend build (dist) not found. Please run "npm run build" first.');
  }
  res.status(404).json({ error: 'Not found' });
});

async function start() {
  await ensureSchema();

  const server = app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Storage backend: ${pool ? 'postgres' : 'json-fallback'}`);
  });

  server.timeout = 600000;
  server.keepAliveTimeout = 120000;
}

start().catch((error) => {
  console.error('Failed to initialize server:', error);
  process.exit(1);
});
