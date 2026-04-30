<script setup>
import { ref, computed } from 'vue'
import { useMusicStore } from '../store/musicStore'

const musicStore = useMusicStore()

const activeTab = ref('upload') // 'upload' | 'playlist'

// Upload form
const form = ref({
  title: '',
  author: '',
  theme: '',
  note: '',
  lyrics: ''
})

const fileInput = ref(null)
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadSuccess = ref(false)
const errorMsg = ref('')

const handleUpload = async () => {
  if (!fileInput.value.files[0]) {
    errorMsg.value = 'Vui lòng chọn file MP3'
    return
  }

  isUploading.value = true
  uploadProgress.value = 0
  errorMsg.value = ''
  uploadSuccess.value = false

  const formData = new FormData()
  formData.append('file', fileInput.value.files[0])
  formData.append('title', form.value.title)
  formData.append('author', form.value.author)
  formData.append('theme', form.value.theme)
  formData.append('note', form.value.note)
  formData.append('lyrics', form.value.lyrics)

  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          // Upload chiếm 70% progress, 30% còn lại là Cloudinary xử lý
          uploadProgress.value = Math.round((e.loaded / e.total) * 70)
        }
      })

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          uploadProgress.value = 100
          uploadSuccess.value = true
          form.value = { title: '', author: '', theme: '', note: '', lyrics: '' }
          fileInput.value.value = ''
          await musicStore.fetchSongs()
          resolve()
        } else {
          try {
            const data = JSON.parse(xhr.responseText)
            errorMsg.value = data.error || 'Upload thất bại'
          } catch {
            errorMsg.value = 'Upload thất bại'
          }
          reject(new Error(errorMsg.value))
        }
      })

      xhr.addEventListener('error', () => {
        errorMsg.value = 'Lỗi kết nối tới server'
        reject(new Error(errorMsg.value))
      })

      // Khi upload xong phần data, Cloudinary vẫn đang xử lý
      xhr.upload.addEventListener('load', () => {
        uploadProgress.value = 75
      })

      xhr.open('POST', '/api/songs')
      xhr.send(formData)
    })
  } catch (err) {
    console.error(err)
  } finally {
    isUploading.value = false
  }
}

const searchSongQuery = ref('')
const availableSongs = computed(() => {
  return musicStore.songs.filter(song => {
    // Tìm kiếm
    const matchSearch = song.title.toLowerCase().includes(searchSongQuery.value.toLowerCase()) || 
                        song.author.toLowerCase().includes(searchSongQuery.value.toLowerCase());
    if (!matchSearch) return false;

    // Nếu bài đã được chọn VÀ không có từ khóa tìm kiếm -> ẩn đi cho gọn
    const isSelected = selectedSongs.value.includes(song.id);
    if (isSelected && searchSongQuery.value.trim() === '') {
      return false;
    }
    return true;
  });
})

const playlistName = ref('')
const selectedSongs = ref([])
const playlistSuccess = ref('')
const playlistError = ref('')
const isSavingPlaylist = ref(false)
const selectedPlaylistId = ref('')

const onPlaylistChange = () => {
  if (selectedPlaylistId.value) {
    const p = musicStore.playlists.find(x => x.id === selectedPlaylistId.value)
    if (p) {
      playlistName.value = p.name
      selectedSongs.value = [...p.songs]
    }
  } else {
    playlistName.value = ''
    selectedSongs.value = []
  }
}

const createPlaylist = async () => {
  if (!playlistName.value) {
    playlistError.value = 'Vui lòng nhập tên chủ đề'
    return
  }
  
  isSavingPlaylist.value = true
  playlistError.value = ''
  playlistSuccess.value = ''

  try {
    const response = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedPlaylistId.value || undefined,
        name: playlistName.value,
        songs: selectedSongs.value
      })
    })

    if (response.ok) {
      playlistSuccess.value = 'Đã lưu chủ đề thành công!'
      if (!selectedPlaylistId.value) {
        playlistName.value = ''
        selectedSongs.value = []
      }
      await musicStore.fetchPlaylists()
    } else {
      playlistError.value = 'Lưu chủ đề thất bại'
    }
  } catch (err) {
    playlistError.value = 'Lỗi kết nối tới server'
  } finally {
    isSavingPlaylist.value = false
  }
}

// Edit Song
const selectedEditSongId = ref('')
const editForm = ref({ title: '', author: '', theme: '', note: '', lyrics: '' })
const editSuccess = ref('')
const editError = ref('')
const isUpdating = ref(false)
const isFetchingLyrics = ref(false)

const onEditSongChange = () => {
  editSuccess.value = ''
  editError.value = ''
  if (selectedEditSongId.value) {
    const s = musicStore.songs.find(x => x.id === selectedEditSongId.value)
    if (s) {
      editForm.value = { 
        title: s.title || '', 
        author: s.author || '', 
        theme: s.theme || '', 
        note: s.note || '', 
        lyrics: s.lyrics || '' 
      }
    }
  } else {
    editForm.value = { title: '', author: '', theme: '', note: '', lyrics: '' }
  }
}

const updateSong = async () => {
  isUpdating.value = true
  editError.value = ''
  editSuccess.value = ''

  try {
    const response = await fetch(`/api/songs/${selectedEditSongId.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm.value)
    })

    console.log('Update response status:', response.status);
    if (response.ok) {
      editSuccess.value = 'Đã cập nhật bài hát thành công!'
      await musicStore.fetchSongs()
    } else {
      editError.value = 'Cập nhật thất bại'
    }
  } catch (err) {
    editError.value = 'Lỗi kết nối tới server'
  } finally {
    isUpdating.value = false
  }
}

const fetchLyrics = async () => {
  if (!editForm.value.title || !editForm.value.author) {
    editError.value = 'Vui lòng nhập Tên bài hát và Tác giả trước khi tự động lấy lời.'
    return
  }

  isFetchingLyrics.value = true
  editError.value = ''
  editSuccess.value = ''
  
  try {
    // Lấy thời lượng bài hát để tìm kiếm chính xác hơn
    let duration = 0;
    const song = musicStore.songs.find(x => x.id === selectedEditSongId.value);
    if (song && song.url) {
      duration = await new Promise(resolve => {
        const audio = new Audio(song.url);
        audio.onloadedmetadata = () => resolve(Math.round(audio.duration));
        audio.onerror = () => resolve(0);
        setTimeout(() => resolve(0), 3000); // Timeout 3s
      });
    }

    // Ưu tiên dùng API 'get' của LRCLIB nếu có duration để lấy bản khớp nhất
    let searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(editForm.value.title)}&artist_name=${encodeURIComponent(editForm.value.author)}`;
    if (duration > 0) {
       // Nếu có duration, LRCLIB sẽ trả về các bản ghi khớp với thời lượng nhất ở đầu
       searchUrl += `&duration=${duration}`;
    }

    const res = await fetch(searchUrl)
    const data = await res.json()
    
    if (data && data.length > 0) {
      const bestMatch = data.find(item => item.syncedLyrics) || data[0]
      if (bestMatch.syncedLyrics) {
        editForm.value.lyrics = bestMatch.syncedLyrics
        editSuccess.value = 'Đã lấy lời chạy chữ (Synced) thành công! Hãy bấm Cập Nhật để lưu.'
      } else if (bestMatch.plainLyrics) {
        editForm.value.lyrics = bestMatch.plainLyrics
        editSuccess.value = 'Chỉ tìm thấy lời thường (Không chạy chữ). Hãy bấm Cập Nhật để lưu.'
      } else {
        editError.value = 'Không tìm thấy lời bài hát nào từ LRCLIB.'
      }
    } else {
      editError.value = 'Không tìm thấy bài hát trên hệ thống LRCLIB.'
    }
  } catch (err) {
    editError.value = 'Lỗi kết nối khi lấy lời bài hát.'
  } finally {
    isFetchingLyrics.value = false
  }
}

</script>

<template>
  <div class="manage-container animate-fade-in">
    <h2>Quản Lý</h2>
    
    <div class="tabs">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'upload' }" 
        @click="activeTab = 'upload'"
      >Tải Lên</button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'edit' }" 
        @click="activeTab = 'edit'"
      >Sửa Bài Hát</button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'playlist' }" 
        @click="activeTab = 'playlist'"
      >Tạo Chủ Đề</button>
    </div>

    <!-- Upload Section -->
    <div v-if="activeTab === 'upload'" class="upload-section glass-panel">
      <h3>Thêm bài hát mới</h3>
      
      <div v-if="uploadSuccess" class="alert success">Tải lên bài hát thành công!</div>
      <div v-if="errorMsg" class="alert error">{{ errorMsg }}</div>

      <form @submit.prevent="handleUpload" class="upload-form">
        <div class="form-group">
          <label>File MP3 *</label>
          <input type="file" ref="fileInput" accept="audio/mp3,audio/*" required class="file-input"/>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Tên bài hát</label>
            <input type="text" v-model="form.title" placeholder="Để trống sẽ lấy tên file" />
          </div>
          <div class="form-group">
            <label>Tác giả / Ca sĩ</label>
            <input type="text" v-model="form.author" placeholder="Tên ca sĩ" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Thể loại (Tag)</label>
            <input type="text" v-model="form.theme" placeholder="VD: Pop, Lofi, EDM..." />
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <input type="text" v-model="form.note" placeholder="Thông tin thêm..." />
          </div>
        </div>

        <div class="form-group">
          <label>Lời bài hát (Định dạng LRC hoặc Text thường)</label>
          <textarea 
            v-model="form.lyrics" 
            rows="6" 
            placeholder="[00:15.30] Lời bài hát ở đây..."
          ></textarea>
        </div>

        <!-- Upload Progress Bar -->
        <div v-if="isUploading" class="upload-progress">
          <div class="progress-label">
            <span>{{ uploadProgress < 75 ? 'Đang tải lên...' : 'Đang xử lý trên Cloudinary...' }}</span>
            <span>{{ uploadProgress }}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="isUploading">
          <span v-if="isUploading">☁️ Đang tải lên Cloudinary... {{ uploadProgress }}%</span>
          <span v-else>☁️ Tải lên Cloudinary</span>
        </button>
      </form>
    </div>

    <!-- Edit Section -->
    <div v-if="activeTab === 'edit'" class="edit-section glass-panel">
      <h3>Sửa Thông Tin Bài Hát</h3>
      
      <div v-if="editSuccess" class="alert success">{{ editSuccess }}</div>
      <div v-if="editError" class="alert error">{{ editError }}</div>

      <div class="form-group mb-3">
        <label>Chọn Bài Hát Để Sửa:</label>
        <select v-model="selectedEditSongId" class="file-input" @change="onEditSongChange">
          <option value="">-- [ Chọn Bài Hát ] --</option>
          <option v-for="s in musicStore.songs" :key="s.id" :value="s.id">
            {{ s.title }} - {{ s.author }}
          </option>
        </select>
      </div>

      <form v-if="selectedEditSongId" @submit.prevent="updateSong" class="upload-form">
        <div class="form-row">
          <div class="form-group">
            <label>Tên bài hát</label>
            <input type="text" v-model="editForm.title" required />
          </div>
          <div class="form-group">
            <label>Tác giả / Ca sĩ</label>
            <input type="text" v-model="editForm.author" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Thể loại (Tag)</label>
            <input type="text" v-model="editForm.theme" />
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <input type="text" v-model="editForm.note" />
          </div>
        </div>

        <div class="form-group">
          <label style="display: flex; justify-content: space-between; align-items: center;">
            <span>Lời bài hát (Định dạng LRC)</span>
            <button type="button" class="btn-auto-lyric" @click="fetchLyrics" :disabled="isFetchingLyrics">
              {{ isFetchingLyrics ? 'Đang lấy lời...' : '🪄 Tự động lấy lời' }}
            </button>
          </label>
          <textarea 
            v-model="editForm.lyrics" 
            rows="10" 
            placeholder="[00:15.30] Lời bài hát ở đây..."
          ></textarea>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="isUpdating">
          <span v-if="isUpdating">Đang lưu...</span>
          <span v-else>Cập Nhật Thông Tin</span>
        </button>
      </form>
    </div>

    <!-- Playlist Section -->
    <div v-if="activeTab === 'playlist'" class="playlist-section glass-panel">
      <h3>Quản Lý Chủ Đề</h3>
      
      <div v-if="playlistSuccess" class="alert success">{{ playlistSuccess }}</div>
      <div v-if="playlistError" class="alert error">{{ playlistError }}</div>

      <form @submit.prevent="createPlaylist" class="upload-form">
        <div class="form-group">
          <label>Chọn Chủ Đề Đang Có HOẶC Tạo Mới</label>
          <select v-model="selectedPlaylistId" class="file-input" @change="onPlaylistChange">
            <option value="">-- [ Tạo Chủ Đề Mới ] --</option>
            <option v-for="p in musicStore.playlists" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
        </div>

        <div class="form-group" v-if="!selectedPlaylistId">
          <label>Tên Chủ Đề Mới *</label>
          <input type="text" v-model="playlistName" required placeholder="VD: Nhạc chill buổi tối, Nhạc tập GYM..." />
        </div>
        
        <div class="form-group" v-if="selectedPlaylistId">
          <label>Tên Chủ Đề *</label>
          <input type="text" v-model="playlistName" required />
        </div>

        <div class="form-group mt-3">
          <label>Chọn các bài hát đưa vào chủ đề:</label>
          <input 
            type="text" 
            v-model="searchSongQuery" 
            placeholder="Tìm bài hát..." 
            class="file-input" 
            style="margin-bottom: 10px;"
          />
          <div class="songs-list-picker">
            <div 
              v-for="song in availableSongs" 
              :key="song.id" 
              class="song-picker-item"
            >
              <label class="checkbox-container">
                <input type="checkbox" :value="song.id" v-model="selectedSongs">
                <span class="checkmark" :class="{'already-added': selectedSongs.includes(song.id) && searchSongQuery.trim() !== ''}"></span>
                <div class="song-picker-info">
                  <span class="title">{{ song.title }}</span>
                  <span class="author">{{ song.author }}</span>
                </div>
              </label>
            </div>
            
            <div v-if="availableSongs.length === 0" class="text-muted">
              Không tìm thấy bài hát nào chưa được thêm.
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="isSavingPlaylist">
          <span v-if="isSavingPlaylist">Đang lưu...</span>
          <span v-else>Lưu Chủ Đề</span>
        </button>
      </form>
      
      <!-- Existing Playlists -->
      <div class="existing-playlists mt-4" v-if="musicStore.playlists.length > 0">
        <h4>Các Chủ Đề Đã Tạo</h4>
        <div class="playlist-grid">
          <div v-for="p in musicStore.playlists" :key="p.id" class="playlist-card">
            <h5>{{ p.name }}</h5>
            <p>{{ p.songs.length }} bài hát</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manage-container {
  max-width: 800px;
  margin: 0 auto;
  padding-top: 2rem;
}

h2 {
  text-align: center;
  margin-bottom: 2rem;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 1.5rem;
  justify-content: center;
}

.tab-btn {
  padding: 10px 24px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.tab-btn:hover {
  background: rgba(255,255,255,0.1);
  color: var(--text-main);
}

.tab-btn.active {
  background: var(--accent-purple);
  color: white;
  border-color: var(--accent-purple);
}

.upload-section, .playlist-section {
  padding: 2rem;
}

h3, h4 {
  margin-bottom: 1.5rem;
  color: var(--accent-neon);
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: flex;
  gap: 1.5rem;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 500;
}

.file-input {
  padding: 10px;
  background: rgba(255,255,255,0.02);
}

.alert {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.alert.success {
  background: rgba(22, 163, 74, 0.1);
  border: 1px solid rgba(22, 163, 74, 0.3);
  color: #4ade80;
}

.alert.error {
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  color: #f87171;
}

/* Upload Progress Bar */
.upload-progress {
  margin-top: 0.5rem;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.progress-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-neon), var(--accent-purple));
  border-radius: 4px;
  transition: width 0.3s ease;
  box-shadow: 0 0 10px rgba(0, 243, 255, 0.4);
}

button[type="submit"] {
  margin-top: 1rem;
  padding: 14px;
  font-size: 1.1rem;
}

/* Song picker styles */
.songs-list-picker {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 10px;
  background: rgba(0,0,0,0.3);
}

.song-picker-item {
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.song-picker-item:last-child {
  border-bottom: none;
}

.checkbox-container {
  display: flex;
  align-items: center;
  position: relative;
  padding-left: 35px;
  cursor: pointer;
  user-select: none;
}

.checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  height: 20px;
  width: 20px;
  background-color: rgba(255,255,255,0.1);
  border: 1px solid var(--border-light);
  border-radius: 4px;
}

.checkbox-container:hover input ~ .checkmark {
  background-color: rgba(255,255,255,0.2);
}

.checkbox-container input:checked ~ .checkmark {
  background-color: var(--accent-neon);
  border-color: var(--accent-neon);
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-container .checkmark:after {
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid black;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-container input:checked ~ .checkmark.already-added {
  background-color: #22c55e; /* green-500 */
  border-color: #22c55e;
}

.song-picker-info {
  display: flex;
  flex-direction: column;
}
.song-picker-info .title {
  font-weight: 500;
  color: var(--text-main);
}
.song-picker-info .author {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}
.playlist-card {
  background: rgba(255,255,255,0.05);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
}
.playlist-card h5 {
  margin-bottom: 5px;
  font-size: 1.1rem;
}
.playlist-card p {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.mt-3 { margin-top: 1.5rem; }
.mt-4 { margin-top: 2rem; }
.mb-3 { margin-bottom: 1.5rem; }

.btn-auto-lyric {
  background: var(--accent-purple);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-auto-lyric:hover {
  background: #a855f7;
}
.btn-auto-lyric:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .form-row {
    flex-direction: column;
  }
}
</style>
