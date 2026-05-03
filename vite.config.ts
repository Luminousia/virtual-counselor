import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    port: 5173,
    open: true,
    host: true,
    // 开发环境代理豆包 TTS，避免浏览器直连 openspeech 被 CORS 拦截
    proxy: {
      '/__minimax-ai': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/__minimax-ai/, '')
      },
      '/__minimax-tts': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/__minimax-tts/, '')
      }
    }
  }
})