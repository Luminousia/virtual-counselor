'use strict'

const express = require('express')
const https = require('https')

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const PORT = process.env.PORT || 9000

const app = express()

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With')
  res.setHeader('Access-Control-Max-Age', '86400')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

app.use(express.json({ limit: '2mb' }))

app.post('*', async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured on server' })
  }

  const body = req.body || {}
  const wantStream = body.stream === true

  if (!wantStream) {
    try {
      const result = await postJsonUpstream({ ...body, stream: false }, apiKey)
      return res.json(result)
    } catch (e) {
      return res.status(502).json({ error: e.message })
    }
  }

  // SSE 透传
  try {
    const upRes = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, stream: true }),
    })

    if (!upRes.ok) {
      const txt = await upRes.text().catch(() => '')
      return res.status(upRes.status).json({ error: `Upstream ${upRes.status}: ${txt.slice(0, 400)}` })
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const reader = upRes.body.getReader()
    const dec = new TextDecoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(dec.decode(value, { stream: true }))
      }
    } finally {
      reader.releaseLock()
      res.end()
    }
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: e.message })
  }
})

function postJsonUpstream(data, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data)
    const u = new URL(DEEPSEEK_URL)
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (upRes) => {
        let buf = ''
        upRes.on('data', (d) => (buf += d))
        upRes.on('end', () => {
          if (upRes.statusCode < 200 || upRes.statusCode >= 300) {
            let msg = buf.slice(0, 400)
            try { msg = JSON.parse(buf)?.error?.message || msg } catch { /**/ }
            return reject(new Error(`Upstream ${upRes.statusCode}: ${msg}`))
          }
          try { resolve(JSON.parse(buf)) }
          catch { reject(new Error(`Upstream non-JSON: ${buf.slice(0, 200)}`)) }
        })
      }
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

app.listen(PORT, () => console.log(`[ai] listening on ${PORT}`))
