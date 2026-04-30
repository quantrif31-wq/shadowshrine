import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Cloudinary Config ───
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

// ─── Data Directory (for JSON metadata only) ───
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Data file for songs
const dataFile = path.join(dataDir, 'songs.json');
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

// Data file for playlists
const playlistsFile = path.join(dataDir, 'playlists.json');
if (!fs.existsSync(playlistsFile)) {
  fs.writeFileSync(playlistsFile, JSON.stringify([]));
}

// Serve frontend dist folder
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// ─── Multer: Memory Storage (buffer, không ghi disk) ───
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Upload a buffer to Cloudinary using upload_stream.
 * resource_type: 'video' is required for audio files on Cloudinary.
 */
function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        folder: 'shadowshrine',
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// ─── API: Get all songs ───
app.get('/api/songs', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read songs data' });
  }
});

// ─── API: Upload song → Cloudinary ───
app.post('/api/songs', upload.single('file'), async (req, res) => {
  try {
    const { title, author, note, theme, lyrics } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Uploading "${file.originalname}" to Cloudinary...`);

    // Upload buffer to Cloudinary
    const result = await uploadToCloudinary(file.buffer, {
      public_id: `${Date.now()}-${file.originalname.replace(/\.[^.]+$/, '')}`,
    });

    console.log(`Upload thành công: ${result.secure_url}`);

    const newSong = {
      id: Date.now().toString(),
      title: title || file.originalname,
      author: author || 'Unknown',
      note: note || '',
      theme: theme || 'General',
      lyrics: lyrics || '',
      url: result.secure_url,           // Cloudinary URL
      cloudinary_id: result.public_id,  // Để xóa sau này nếu cần
      filename: file.originalname,
      createdAt: new Date().toISOString()
    };

    const songs = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    songs.push(newSong);
    fs.writeFileSync(dataFile, JSON.stringify(songs, null, 2));

    res.status(201).json(newSong);
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: 'Failed to upload song to Cloudinary' });
  }
});

// ─── API: Update song metadata ───
app.put('/api/songs/:id', (req, res) => {
  console.log(`Incoming PUT request for song ID: ${req.params.id}`);
  try {
    const { title, author, note, theme, lyrics } = req.body;
    const songId = req.params.id;

    const songs = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    console.log(`Searching for ID: "${songId}". Available IDs: ${songs.map(s => `"${s.id}"`).join(', ')}`);
    const songIndex = songs.findIndex(s => s.id === songId);

    if (songIndex === -1) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Update only provided fields
    if (title !== undefined) songs[songIndex].title = title;
    if (author !== undefined) songs[songIndex].author = author;
    if (note !== undefined) songs[songIndex].note = note;
    if (theme !== undefined) songs[songIndex].theme = theme;
    if (lyrics !== undefined) songs[songIndex].lyrics = lyrics;

    fs.writeFileSync(dataFile, JSON.stringify(songs, null, 2));
    console.log(`Successfully updated song ID: ${songId}`);
    res.json(songs[songIndex]);
  } catch (error) {
    console.error(`Error updating song:`, error);
    res.status(500).json({ error: 'Failed to update song' });
  }
});

// ─── API: Delete song (+ xóa file trên Cloudinary) ───
app.delete('/api/songs/:id', async (req, res) => {
  try {
    const songId = req.params.id;
    const songs = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    const songIndex = songs.findIndex(s => s.id === songId);

    if (songIndex === -1) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const song = songs[songIndex];

    // Xóa file trên Cloudinary nếu có cloudinary_id
    if (song.cloudinary_id) {
      try {
        await cloudinary.uploader.destroy(song.cloudinary_id, { resource_type: 'video' });
        console.log(`Deleted from Cloudinary: ${song.cloudinary_id}`);
      } catch (cloudErr) {
        console.error('Cloudinary delete error (non-fatal):', cloudErr);
      }
    }

    songs.splice(songIndex, 1);
    fs.writeFileSync(dataFile, JSON.stringify(songs, null, 2));

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

// ─── API: Get all playlists ───
app.get('/api/playlists', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(playlistsFile, 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read playlists data' });
  }
});

// ─── API: Create or Update playlist ───
app.post('/api/playlists', (req, res) => {
  try {
    const { id, name, songs } = req.body; // songs is an array of song IDs
    const playlists = JSON.parse(fs.readFileSync(playlistsFile, 'utf-8'));
    
    if (id) {
      // Update
      const index = playlists.findIndex(p => p.id === id);
      if (index !== -1) {
        playlists[index] = { ...playlists[index], name, songs: songs || playlists[index].songs };
        fs.writeFileSync(playlistsFile, JSON.stringify(playlists, null, 2));
        return res.json(playlists[index]);
      }
    }
    
    // Create new
    const newPlaylist = {
      id: Date.now().toString(),
      name: name || 'New Playlist',
      songs: songs || [],
      createdAt: new Date().toISOString()
    };
    playlists.push(newPlaylist);
    fs.writeFileSync(playlistsFile, JSON.stringify(playlists, null, 2));
    res.status(201).json(newPlaylist);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save playlist' });
  }
});

// Catch-all middleware to serve index.html for SPA routing
app.use((req, res) => {
  // Chỉ xử lý các request GET không phải API
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

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Cloudinary cloud: ${process.env.CLOUDINARY_CLOUD_NAME || '⚠️ NOT SET'}`);
});
