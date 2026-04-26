import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import SongManager from './views/SongManager.vue'
import LyricsView from './views/LyricsView.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/manage',
    name: 'SongManager',
    component: SongManager
  },
  {
    path: '/lyrics',
    name: 'LyricsView',
    component: LyricsView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
