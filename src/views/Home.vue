<script setup>
import { useMusicStore } from '../store/musicStore'

const musicStore = useMusicStore()

</script>

<template>
  <div class="home-container animate-fade-in">
    <div class="hero-section">
      <h1>Khám Phá Âm Nhạc</h1>
      <p>Lạc vào thế giới của Shadow Shrine</p>
    </div>

    <div class="filter-section glass-panel">
      <div class="search-box">
        <input 
          type="text" 
          v-model="musicStore.searchQuery" 
          placeholder="Tìm kiếm bài hát, tác giả..."
        />
      </div>
      
      <div class="theme-filters">
        <button 
          class="theme-btn" 
          :class="{ active: musicStore.filterPlaylist === '' }"
          @click="musicStore.filterPlaylist = ''"
        >Tất cả</button>
        <button 
          v-for="playlist in musicStore.playlists" 
          :key="playlist.id"
          class="theme-btn"
          :class="{ active: musicStore.filterPlaylist === playlist.id }"
          @click="musicStore.filterPlaylist = playlist.id"
        >{{ playlist.name }}</button>
      </div>
    </div>

    <div class="songs-grid">
      <div 
        class="song-card glass-panel" 
        v-for="song in musicStore.filteredSongs" 
        :key="song.id"
      >
        <div class="song-info">
          <h3>{{ song.title }}</h3>
          <p class="author">{{ song.author }}</p>
          <span class="theme-badge" v-if="song.theme">{{ song.theme }}</span>
        </div>
        
        <div class="song-actions">
          <button 
            class="play-btn" 
            @click="musicStore.playSong(song)"
            :class="{ playing: musicStore.currentSong?.id === song.id && musicStore.isPlaying }"
          >
            <!-- Nếu bài hát này đang play, hiện nút Pause -->
            <svg v-if="musicStore.currentSong?.id === song.id && musicStore.isPlaying" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            <!-- Ngược lại hiện nút Play -->
            <svg v-else viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
        </div>
      </div>
      
      <div v-if="musicStore.filteredSongs.length === 0" class="no-songs">
        <p>Không tìm thấy bài hát nào.</p>
        <router-link to="/manage" class="btn btn-primary mt-3">Thêm bài hát mới</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 1200px;
  margin: 0 auto;
  padding-top: 2rem;
}

.hero-section {
  text-align: center;
  margin-bottom: 3rem;
}

.hero-section p {
  color: var(--text-muted);
  font-size: 1.2rem;
}

.filter-section {
  padding: 1.5rem;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.search-box input {
  font-size: 1.1rem;
}

.theme-filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.theme-btn {
  padding: 6px 16px;
  border-radius: 20px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-muted);
}

.theme-btn:hover {
  background: rgba(255,255,255,0.1);
  color: var(--text-main);
}

.theme-btn.active {
  background: rgba(0, 243, 255, 0.15);
  border-color: var(--accent-neon);
  color: var(--accent-neon);
}

.songs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.song-card {
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.song-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.5), 0 0 15px rgba(157, 0, 255, 0.2);
}

.song-info h3 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.author {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 0.8rem;
}

.theme-badge {
  font-size: 0.7rem;
  padding: 3px 8px;
  border-radius: 8px;
  background: rgba(157, 0, 255, 0.15);
  color: #d499ff;
  border: 1px solid rgba(157, 0, 255, 0.3);
}

.play-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
}

.play-btn:hover {
  background: var(--accent-neon);
  border-color: var(--accent-neon);
  box-shadow: 0 0 15px rgba(0, 243, 255, 0.5);
  transform: scale(1.1);
  color: #000;
}

.play-btn.playing {
  background: var(--accent-neon);
  color: #000;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(0, 243, 255, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(0, 243, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 243, 255, 0); }
}

.no-songs {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

.mt-3 {
  margin-top: 1.5rem;
}
</style>
