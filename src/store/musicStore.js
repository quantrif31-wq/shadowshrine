import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMusicStore = defineStore('music', () => {
  const songs = ref([])
  const playlists = ref([])
  const playingQueue = ref([])
  
  const currentSongIndex = ref(-1)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  
  // 0: None, 1: Loop All, 2: Loop One
  const loopMode = ref(0) 
  
  const filterPlaylist = ref('') // ID of the selected playlist
  const filterTheme = ref('')
  const searchQuery = ref('')

  const currentSong = computed(() => {
    if (playingQueue.value.length === 0) return null
    if (currentSongIndex.value >= 0 && currentSongIndex.value < playingQueue.value.length) {
      return playingQueue.value[currentSongIndex.value]
    }
    return null
  })

  const filteredSongs = computed(() => {
    return songs.value.filter(song => {
      // Lọc theo playlist
      if (filterPlaylist.value) {
        const playlist = playlists.value.find(p => p.id === filterPlaylist.value)
        if (!playlist || !playlist.songs.includes(song.id)) return false
      }
      
      const matchTheme = filterTheme.value ? song.theme === filterTheme.value : true;
      const matchSearch = searchQuery.value 
        ? song.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
          song.author.toLowerCase().includes(searchQuery.value.toLowerCase())
        : true;
      return matchTheme && matchSearch;
    })
  })

  const themes = computed(() => {
    const themeSet = new Set(songs.value.map(s => s.theme).filter(Boolean))
    return Array.from(themeSet)
  })

  async function fetchSongs() {
    try {
      const response = await fetch('/api/songs')
      if (response.ok) {
        songs.value = await response.json()
      }
    } catch (error) {
      console.error('Failed to fetch songs:', error)
    }
  }

  async function fetchPlaylists() {
    try {
      const response = await fetch('/api/playlists')
      if (response.ok) {
        playlists.value = await response.json()
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error)
    }
  }

  function playSong(song, queue = null) {
    if (!queue) queue = filteredSongs.value;
    
    // Nếu click vào bài đang phát thì Toggle Play/Pause
    if (currentSong.value && currentSong.value.id === song.id) {
      isPlaying.value = !isPlaying.value;
      return;
    }

    // Nếu chọn bài mới, nạp queue và play
    playingQueue.value = [...queue];
    const index = playingQueue.value.findIndex(s => s.id === song.id);
    
    if (index !== -1) {
      currentSongIndex.value = index;
      isPlaying.value = true;
    }
  }

  function togglePlay() {
    if (currentSong.value) {
      isPlaying.value = !isPlaying.value;
    }
  }

  function nextSong(force = false) {
    if (playingQueue.value.length === 0) return;
    
    // Nếu đang bật Loop One và không phải do user chủ động bấm Next
    if (loopMode.value === 2 && !force) {
      const audio = document.querySelector('audio');
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.error(e));
      }
      return;
    }

    if (currentSongIndex.value < playingQueue.value.length - 1) {
      currentSongIndex.value++;
      isPlaying.value = true;
    } else if (loopMode.value === 1 || loopMode.value === 2) {
      // Hết danh sách và có lặp All/One
      currentSongIndex.value = 0;
      isPlaying.value = true;
    } else {
      // Hết danh sách, ngưng
      isPlaying.value = false;
      currentTime.value = 0;
    }
  }

  function prevSong() {
    if (playingQueue.value.length === 0) return;
    
    if (currentSongIndex.value > 0) {
      currentSongIndex.value--;
      isPlaying.value = true;
    } else if (loopMode.value === 1 || loopMode.value === 2) {
      currentSongIndex.value = playingQueue.value.length - 1;
      isPlaying.value = true;
    }
  }

  function toggleLoop() {
    // Vòng lặp: 0 (None) -> 1 (All) -> 2 (One) -> 0
    loopMode.value = (loopMode.value + 1) % 3;
  }

  return {
    songs,
    playlists,
    playingQueue,
    currentSongIndex,
    isPlaying,
    currentTime,
    duration,
    loopMode,
    filterPlaylist,
    filterTheme,
    searchQuery,
    currentSong,
    filteredSongs,
    themes,
    fetchSongs,
    fetchPlaylists,
    playSong,
    togglePlay,
    nextSong,
    prevSong,
    toggleLoop
  }
})
