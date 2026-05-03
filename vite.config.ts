import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { rmSync, existsSync } from 'fs'
import { resolve } from 'path'

// 构建后删除超过 Cloudflare 25MB 限制的大文件（生产环境通过外部 CDN 加载）
const excludeLargeAssetsPlugin = () => ({
  name: 'exclude-large-assets',
  closeBundle() {
    const largeFiles = [
      'dist/model.vrm',
      'dist/idle_loop.vrma',
      'dist/model_pose.vrma',
      'dist/show_fullbody.vrma',
    ]
    for (const f of largeFiles) {
      const p = resolve(f)
      if (existsSync(p)) {
        rmSync(p)
        console.log(`[exclude-large-assets] 已删除: ${f}`)
      }
    }
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), excludeLargeAssetsPlugin()],
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
