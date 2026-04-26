<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMusicStore } from '../store/musicStore'

const musicStore = useMusicStore()
const router = useRouter()
const audioRef = ref(null)
const progress = ref(0)
const isDragging = ref(false)
const volume = ref(1)

// Mobile UI State
const isMobileExpanded = ref(false)

// Handle Play/Pause
watch(() => musicStore.isPlaying, (playing) => {
  if (!audioRef.value) return
  if (playing) {
    audioRef.value.play().catch(e => console.error(e))
  } else {
    audioRef.value.pause()
  }
})

// Handle song change
watch(() => musicStore.currentSong, (song) => {
  if (!audioRef.value || !song) return
  audioRef.value.src = song.url
  if (musicStore.isPlaying) {
    audioRef.value.play().catch(e => console.error(e))
  }
})

// Handle Volume
watch(volume, (vol) => {
  if (audioRef.value) {
    audioRef.value.volume = vol
  }
})

// Time updates
const onTimeUpdate = () => {
  if (!audioRef.value || isDragging.value) return
  musicStore.currentTime = audioRef.value.currentTime
  musicStore.duration = audioRef.value.duration || 0
  progress.value = (musicStore.currentTime / musicStore.duration) * 100 || 0
}

const onEnded = () => {
  musicStore.nextSong()
}

const formatTime = (time) => {
  if (!time || isNaN(time)) return '0:00'
  const min = Math.floor(time / 60)
  const sec = Math.floor(time % 60).toString().padStart(2, '0')
  return `${min}:${sec}`
}

const seek = (e) => {
  if (!audioRef.value || !musicStore.duration) return
  const rect = e.currentTarget.getBoundingClientRect()
  const pos = (e.clientX - rect.left) / rect.width
  audioRef.value.currentTime = pos * musicStore.duration
}

const toggleMobileExpand = () => {
  if (window.innerWidth <= 768) {
    isMobileExpanded.value = !isMobileExpanded.value
  }
}

const openLyrics = () => {
  isMobileExpanded.value = false
  router.push('/lyrics')
}
</script>

<template>
  <div v-if="musicStore.songs.length > 0">
    <audio 
      ref="audioRef" 
      @timeupdate="onTimeUpdate" 
      @ended="onEnded"
      @loadedmetadata="onTimeUpdate"
    ></audio>

    <!-- 
      We have one unified player structure that transforms via CSS.
      On Desktop: It's the standard bottom bar.
      On Mobile (collapsed): It's a Mini Player above the bottom nav.
      On Mobile (expanded): It's a Full Screen Overlay.
    -->
    <div 
      class="music-player glass-panel animate-fade-in" 
      :class="{ 'mobile-expanded': isMobileExpanded }"
    >
      
      <!-- Mobile Expand Header (Only visible when Expanded on Mobile) -->
      <div class="mobile-expand-header">
        <button class="control-btn" @click.stop="toggleMobileExpand">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <span class="header-title">Đang phát</span>
        <button class="control-btn" @click.stop="openLyrics">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </button>
      </div>

      <div class="player-content" @click="!isMobileExpanded ? toggleMobileExpand() : null">
        <!-- Mobile Progress Bar (Thin line for Mini Player) -->
        <div class="mobile-progress" :style="{ width: progress + '%' }"></div>
        
        <!-- Player Left (Info) -->
        <div class="player-left">
          <div class="artwork">
            <div class="disc" :class="{ 'spinning': musicStore.isPlaying }"></div>
          </div>
          <div class="details">
            <div class="title" :title="musicStore.currentSong?.title">
              {{ musicStore.currentSong?.title || 'Chưa chọn bài hát' }}
            </div>
            <div class="author" :title="musicStore.currentSong?.author">
              {{ musicStore.currentSong?.author || '--' }}
            </div>
          </div>
          <div class="heart-btn hide-on-mini">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </div>
        </div>

        <!-- Player Center (Controls & Progress) -->
        <div class="player-center">
          <div class="progress-container hide-on-mini">
            <span class="time">{{ formatTime(musicStore.currentTime) }}</span>
            <div class="progress-bar-bg" @click.stop="seek">
              <div class="progress-bar-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <span class="time">{{ formatTime(musicStore.duration) }}</span>
          </div>

          <div class="main-controls">
            <button class="control-btn hide-on-mini" title="Trộn bài">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
            </button>
            
            <!-- Hide Prev button on Mini Player -->
            <button class="control-btn hide-on-mini" @click.stop="musicStore.prevSong">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
            </button>

            <!-- Play/Pause always visible -->
            <button class="control-btn play-pause" @click.stop="musicStore.togglePlay">
              <svg v-if="!musicStore.isPlaying" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <svg v-else viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            </button>

            <!-- Next button always visible -->
            <button class="control-btn" @click.stop="musicStore.nextSong(true)">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
            </button>

            <button class="control-btn hide-on-mini loop-btn" @click.stop="musicStore.toggleLoop" :class="{ 'active': musicStore.loopMode > 0 }">
              <!-- Loop Icon -->
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
              <span v-if="musicStore.loopMode === 2" class="loop-one-indicator">1</span>
            </button>
          </div>
        </div>

        <!-- Player Right (Extras) -->
        <div class="player-right hide-on-mini">
          <button class="control-btn small" @click.stop="openLyrics" title="Lời bài hát">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          
          <div class="volume-control">
            <button class="control-btn small">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </button>
            <input type="range" class="volume-slider" min="0" max="1" step="0.01" v-model="volume" @click.stop />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Main Player Styles (Desktop by default) */
.music-player {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: var(--player-height);
  z-index: 1000;
  background: var(--bg-panel);
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
  padding: 0;
  transition: all 0.3s ease;
}

.mobile-expand-header {
  display: none;
}

.player-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 24px;
  position: relative;
}

/* Three main sections */
.player-left {
  width: 30%;
  display: flex;
  align-items: center;
  gap: 15px;
}

.player-center {
  width: 40%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.player-right {
  width: 30%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 20px;
}

/* Artwork and Details */
.artwork {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #222, #000);
  border: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.disc {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: repeating-radial-gradient(#111, #111 2px, #222 3px, #222 4px);
  position: relative;
}

.disc::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: var(--bg-dark);
  border: 2px solid var(--text-muted);
  border-radius: 50%;
}

.spinning {
  animation: spin 4s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.details {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.title {
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.author {
  font-size: 0.8rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.heart-btn {
  margin-left: 10px;
  opacity: 0.5;
  cursor: pointer;
}
.heart-btn:hover { opacity: 1; color: var(--accent-neon); }

/* Controls */
.main-controls {
  display: flex;
  align-items: center;
  gap: 25px;
}

.control-btn {
  background: none;
  border: none;
  color: var(--text-main);
  cursor: pointer;
  padding: 0;
  opacity: 0.7;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.control-btn:hover {
  opacity: 1;
  color: var(--accent-neon);
}

.control-btn.active {
  color: var(--accent-neon);
  opacity: 1;
}

.loop-btn .loop-one-indicator {
  position: absolute;
  font-size: 8px;
  font-weight: 800;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.play-pause {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid var(--text-main);
  opacity: 1;
}

.play-pause:hover {
  border-color: var(--accent-neon);
  color: var(--accent-neon);
  transform: scale(1.05);
}

.progress-container {
  width: 100%;
  max-width: 500px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.progress-bar-bg {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}

.progress-bar-bg:hover .progress-bar-fill {
  background: var(--accent-neon);
}

.progress-bar-fill {
  height: 100%;
  background: var(--text-main);
  border-radius: 2px;
  transition: width 0.1s linear;
}

/* Volume & Extras */
.volume-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.volume-slider {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  padding: 0;
  border: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  background: var(--text-main);
  border-radius: 50%;
  cursor: pointer;
}

.mobile-progress {
  display: none;
}

/* -------------------------------------------
   RESPONSIVE (Mobile layout)
   ------------------------------------------- */
@media (max-width: 768px) {
  /* State 1: MINI PLAYER (Collapsed) */
  .music-player:not(.mobile-expanded) {
    bottom: var(--mobile-nav-height);
    cursor: pointer;
  }
  
  .music-player:not(.mobile-expanded) .hide-on-mini {
    display: none !important;
  }
  
  .music-player:not(.mobile-expanded) .player-content {
    padding: 0 15px;
  }
  
  .music-player:not(.mobile-expanded) .player-left {
    width: auto;
    flex: 1;
  }
  
  .music-player:not(.mobile-expanded) .artwork {
    width: 44px;
    height: 44px;
  }
  
  .music-player:not(.mobile-expanded) .player-center {
    width: auto;
    flex: 0;
    flex-direction: row;
    gap: 15px;
  }
  
  .music-player:not(.mobile-expanded) .main-controls {
    gap: 15px;
  }
  
  .music-player:not(.mobile-expanded) .play-pause {
    width: 36px;
    height: 36px;
    border: none;
  }
  
  .music-player:not(.mobile-expanded) .play-pause:hover {
    transform: none;
  }
  
  .music-player:not(.mobile-expanded) .player-right {
    display: none;
  }
  
  .music-player:not(.mobile-expanded) .mobile-progress {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    height: 2px;
    background: var(--accent-neon);
    transition: width 0.1s linear;
  }

  /* State 2: FULL SCREEN PLAYER (Expanded) */
  .music-player.mobile-expanded {
    height: 100vh;
    bottom: 0;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    padding: 0;
    background: var(--bg-darker);
    z-index: 2000;
  }

  .music-player.mobile-expanded .hide-on-mini {
    display: flex !important;
  }

  .mobile-expanded .mobile-expand-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    width: 100%;
  }

  .mobile-expanded .header-title {
    font-weight: 600;
    font-size: 1.1rem;
  }

  .mobile-expanded .player-content {
    flex-direction: column;
    justify-content: center;
    align-items: center;
    flex: 1;
    padding: 20px;
    gap: 40px;
  }

  .mobile-expanded .player-left {
    width: 100%;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    gap: 20px;
  }

  .mobile-expanded .artwork {
    width: 250px;
    height: 250px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }

  .mobile-expanded .details .title {
    font-size: 1.5rem;
    margin-bottom: 5px;
    white-space: normal;
  }

  .mobile-expanded .details .author {
    font-size: 1rem;
  }

  .mobile-expanded .heart-btn {
    position: absolute;
    right: 30px;
    top: 320px; /* roughly aligned with title */
  }

  .mobile-expanded .player-center {
    width: 100%;
    gap: 30px;
  }

  .mobile-expanded .progress-container {
    width: 100%;
    max-width: none;
  }

  .mobile-expanded .main-controls {
    width: 100%;
    justify-content: space-around;
    gap: 0;
  }

  .mobile-expanded .play-pause {
    width: 60px;
    height: 60px;
  }

  .mobile-expanded .play-pause svg {
    width: 30px;
    height: 30px;
  }

  .mobile-expanded .player-right {
    width: 100%;
    justify-content: center;
    gap: 40px;
    padding-bottom: 20px;
  }

  .mobile-expanded .mobile-progress {
    display: none;
  }
}
</style>
