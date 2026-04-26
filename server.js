import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Create music directory if it doesn't exist
const musicDir = path.join(__dirname, 'public', 'music');
if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

// Data file for songs
const dataFile = path.join(musicDir, 'songs.json');
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

// Data file for playlists
const playlistsFile = path.join(musicDir, 'playlists.json');
if (!fs.existsSync(playlistsFile)) {
  fs.writeFileSync(playlistsFile, JSON.stringify([]));
}

// Serve static music files
app.use('/music', express.static(musicDir));

// Serve frontend dist folder if it exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, musicDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// API: Get all songs
app.get('/api/songs', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read songs data' });
  }
});

// API: Upload song
app.post('/api/songs', upload.single('file'), (req, res) => {
  try {
    const { title, author, note, theme, lyrics } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const newSong = {
      id: Date.now().toString(),
      title: title || file.originalname,
      author: author || 'Unknown',
      note: note || '',
      theme: theme || 'General',
      lyrics: lyrics || '',
      url: `/music/${file.filename}`,
      filename: file.filename,
      createdAt: new Date().toISOString()
    };

    const songs = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    songs.push(newSong);
    fs.writeFileSync(dataFile, JSON.stringify(songs, null, 2));

    res.status(201).json(newSong);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload song' });
  }
});
// API: Update song
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
    console.error(`Error updating song ID: ${songId}:`, error);
    res.status(500).json({ error: 'Failed to update song' });
  }
});

// API: Get all playlists
app.get('/api/playlists', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(playlistsFile, 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read playlists data' });
  }
});

// API: Create or Update playlist
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

// Catch-all route to serve index.html for SPA routing
if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/music')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
