import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/music': 'http://localhost:3000'
    }
  },
  preview: {
    allowedHosts: ['shadowshrine.onrender.com']
  }
})
