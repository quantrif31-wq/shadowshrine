<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useMusicStore } from '../store/musicStore'

const musicStore = useMusicStore()
const lyricsContainer = ref(null)

// Parse LRC format
const parsedLyrics = computed(() => {
  const song = musicStore.currentSong
  if (!song || !song.lyrics) return []
  
  const lines = song.lyrics.split('\n')
  const result = []
  
  const timeRegex = /\[(\d{2}):(\d{2}(\.\d{2,3})?)\]/
  
  for (let line of lines) {
    const match = timeRegex.exec(line)
    if (match) {
      const minutes = parseInt(match[1])
      const seconds = parseFloat(match[2])
      const time = minutes * 60 + seconds
      const text = line.replace(timeRegex, '').trim()
      
      if (text) {
        result.push({ time, text })
      }
    } else if (line.trim()) {
      // Non-synced lyrics
      result.push({ time: -1, text: line.trim() })
    }
  }
  
  return result.sort((a, b) => a.time - b.time)
})

// Find current active line
const activeIndex = computed(() => {
  const currentTime = musicStore.currentTime
  const lyrics = parsedLyrics.value
  
  if (lyrics.length === 0 || lyrics[0].time === -1) return -1
  
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      return i
    }
  }
  return -1
})



// Auto scroll
watch(activeIndex, (newIndex) => {
  if (newIndex !== -1 && lyricsContainer.value) {
    const activeEl = lyricsContainer.value.children[newIndex]
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
})
</script>

<template>
  <div class="lyrics-container animate-fade-in">
    <div class="song-header" v-if="musicStore.currentSong">
      <h2>{{ musicStore.currentSong.title }}</h2>
      <p class="author">{{ musicStore.currentSong.author }}</p>
      

    </div>
    
    <div class="empty-state" v-if="!musicStore.currentSong">
      <p>Hãy chọn một bài hát để xem lời</p>
      <router-link to="/" class="btn mt-3">Quay lại trang chủ</router-link>
    </div>

    <div class="empty-state" v-else-if="parsedLyrics.length === 0">
      <p>Bài hát này chưa có lời.</p>
    </div>

    <div class="lyrics-scroll-area glass-panel" ref="lyricsContainer" v-else>
      <div 
        v-for="(line, index) in parsedLyrics" 
        :key="index"
        class="lyric-line"
        :class="{ 
          'active': index === activeIndex,
          'passed': index < activeIndex 
        }"
      >
        {{ line.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.lyrics-container {
  max-width: 800px;
  margin: 0 auto;
  padding-top: 2rem;
  height: calc(100vh - 250px);
  display: flex;
  flex-direction: column;
}

.song-header {
  text-align: center;
  margin-bottom: 2rem;
}

.song-header h2 {
  font-size: 2.5rem;
  background: linear-gradient(135deg, var(--accent-neon) 0%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}

.author {
  color: var(--text-muted);
  font-size: 1.1rem;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  margin-top: 4rem;
  font-size: 1.2rem;
}

.lyrics-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 3rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
}

.lyric-line {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: center;
  cursor: pointer;
}

.lyric-line:hover {
  color: rgba(255, 255, 255, 0.8);
}

.lyric-line.passed {
  color: rgba(255, 255, 255, 0.6);
}

.lyric-line.active {
  color: var(--accent-neon);
  font-size: 2rem;
  text-shadow: 0 0 20px rgba(0, 243, 255, 0.5);
  transform: scale(1.05);
}

.mt-3 {
  margin-top: 1.5rem;
}


</style>
