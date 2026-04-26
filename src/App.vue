<script setup>
import { onMounted } from 'vue'
import { useMusicStore } from './store/musicStore'
import MusicPlayer from './components/MusicPlayer.vue'

const musicStore = useMusicStore()

onMounted(() => {
  musicStore.fetchSongs()
  musicStore.fetchPlaylists()
})
</script>

<template>
  <div class="app-layout">
    <!-- Desktop Sidebar -->
    <aside class="sidebar glass-panel">
      <div class="logo">
        <span class="neon-text">Shadow</span> Shrine
      </div>
      
      <nav class="nav-links">
        <router-link to="/" class="nav-item">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
          <span>Khám phá</span>
        </router-link>
        
        <router-link to="/lyrics" class="nav-item">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          <span>Lời bài hát</span>
        </router-link>
        
        <div class="nav-divider"></div>
        
        <router-link to="/manage" class="nav-item">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <span>Tải nhạc lên</span>
        </router-link>

        <a href="/cv.html" class="nav-item cv-link" target="_blank">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <span>Xem CV Tác Giả</span>
        </a>
      </nav>
    </aside>

    <!-- Mobile Top Header (Just Logo) -->
    <header class="mobile-header glass-panel">
      <div class="logo">
        <span class="neon-text">Shadow</span> Shrine
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
      <!-- Spacer for bottom elements -->
      <div class="bottom-spacer"></div>
    </main>

    <!-- Global Music Player -->
    <MusicPlayer class="global-player" />

    <!-- Mobile Bottom Navigation -->
    <nav class="bottom-nav glass-panel">
      <router-link to="/" class="nav-item">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
        <span>Khám phá</span>
      </router-link>
      
      <router-link to="/lyrics" class="nav-item">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        <span>Lời nhạc</span>
      </router-link>
      
      <router-link to="/manage" class="nav-item">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        <span>Cá nhân</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  position: relative;
}

/* Sidebar for Desktop */
.sidebar {
  width: var(--sidebar-width);
  height: calc(100vh - var(--player-height));
  display: flex;
  flex-direction: column;
  padding: 2rem 0;
  border-right: 1px solid var(--border-light);
  border-top: none;
  border-bottom: none;
  border-left: none;
  background: rgba(20, 20, 25, 0.8);
  z-index: 10;
}

.logo {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 0 1.5rem;
  margin-bottom: 2.5rem;
  display: flex;
  align-items: center;
  gap: 5px;
}

.neon-text {
  color: var(--accent-neon);
  text-shadow: 0 0 10px rgba(0, 243, 255, 0.4);
}

.nav-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 1rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px 16px;
  color: var(--text-main);
  font-weight: 600;
  font-size: 1rem;
  border-radius: 8px;
  opacity: 0.7;
  transition: all 0.3s ease;
}

.nav-item svg {
  transition: transform 0.3s;
}

.nav-item:hover, .nav-item.router-link-active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.05);
  color: var(--accent-neon);
}

.nav-item:hover svg {
  transform: scale(1.1);
}

.nav-item.router-link-active {
  background: rgba(0, 243, 255, 0.1);
  border-left: 3px solid var(--accent-neon);
}

.nav-divider {
  height: 1px;
  background: var(--border-light);
  margin: 1rem 0;
}

.cv-link {
  margin-top: auto;
}

/* Main Content */
.main-content {
  flex: 1;
  height: 100vh;
  overflow-y: auto;
  position: relative;
  background-color: transparent;
}

.bottom-spacer {
  height: calc(var(--player-height) + 60px); /* enough space to scroll past the player */
}

/* Global Player */
.global-player {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: var(--player-height);
  z-index: 100;
}

/* Mobile specific elements */
.mobile-header {
  display: none;
}

.bottom-nav {
  display: none;
}

/* Page Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from { opacity: 0; transform: translateY(10px); }
.fade-leave-to { opacity: 0; transform: translateY(-10px); }

/* Responsive Mobile Layout */
@media (max-width: 768px) {
  .app-layout {
    flex-direction: column;
  }
  
  .sidebar {
    display: none;
  }
  
  .mobile-header {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60px;
    border-bottom: 1px solid var(--border-light);
    border-radius: 0;
    z-index: 10;
  }
  
  .mobile-header .logo {
    margin-bottom: 0;
    padding: 0;
    font-size: 1.5rem;
  }
  
  .main-content {
    height: calc(100vh - 60px - var(--player-height) - var(--mobile-nav-height));
  }
  
  /* Bottom Nav */
  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: var(--mobile-nav-height);
    background: var(--bg-panel);
    border-top: 1px solid var(--border-light);
    z-index: 100;
    justify-content: space-around;
    align-items: center;
    border-radius: 0;
  }
  
  .bottom-nav .nav-item {
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    font-size: 0.7rem;
    border-radius: 0;
  }
  
  .bottom-nav .nav-item svg {
    width: 20px;
    height: 20px;
  }
  
  .bottom-nav .nav-item.router-link-active {
    border-left: none;
    border-bottom: 2px solid var(--accent-neon);
    background: transparent;
  }
  
  /* Shift player up to sit above bottom nav */
  .global-player {
    bottom: var(--mobile-nav-height);
  }
}
</style>
