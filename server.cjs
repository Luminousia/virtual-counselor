/**
 * 生产服务器 - Express
 * 同时托管 React 静态文件 + /api/ai + /api/tts 代理
 * 运行方式：node server.cjs
 * 推荐：pm2 start server.cjs --name xiao-nuan
 */

const express = require('express')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000

// ── 中间件 ──
app.use(express.json({ limit: '10mb' }))

// ── 静态文件（React 打包产物） ──
app.use(express.static(path.join(__dirname, 'dist')))

// ── /api/ai — DeepSeek 流式代理 ──
app.post('/api/ai', async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY 未配置' })
  }

  try {
    const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('X-Accel-Buffering', 'no') // 关闭 Nginx 缓冲，保证流式

    const reader = upstream.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
    res.end()
  } catch (err) {
    console.error('[/api/ai]', err)
    res.status(502).json({ error: '上游请求失败', detail: err.message })
  }
})

// ── /api/tts — MiniMax TTS 代理 ──
app.post('/api/tts', async (req, res) => {
  const apiKey = process.env.MINIMAX_TTS_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'MINIMAX_TTS_API_KEY 未配置' })
  }

  try {
    const upstream = await fetch('https://api.minimaxi.com/v1/t2a_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    })

    const data = await upstream.text()
    res.setHeader('Content-Type', 'application/json')
    res.status(upstream.status).send(data)
  } catch (err) {
    console.error('[/api/tts]', err)
    res.status(502).json({ error: '上游请求失败', detail: err.message })
  }
})

// ── SPA fallback（所有其他路由返回 index.html） ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`✅ 小暖服务已启动：http://localhost:${PORT}`)
})
