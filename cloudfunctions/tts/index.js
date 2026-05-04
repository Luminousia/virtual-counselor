'use strict'

const express = require('express')
const https = require('https')

const MINIMAX_URL = 'https://api.minimaxi.com/v1/t2a_v2'
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
  const apiKey = process.env.MINIMAX_TTS_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'MINIMAX_TTS_KEY not configured on server' })
  }

  const body = req.body || {}
  try {
    const result = await post(MINIMAX_URL, body, apiKey)
    res.json(result)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

function post(url, data, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data)
    const u = new URL(url)
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
            return reject(new Error(`Upstream ${upRes.statusCode}: ${buf.slice(0, 400)}`))
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

app.listen(PORT, () => console.log(`[tts] listening on ${PORT}`))
