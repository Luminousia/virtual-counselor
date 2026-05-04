'use strict'

const https = require('https')
const MINIMAX_URL = 'https://api.minimaxi.com/v1/t2a_v2'

/**
 * 支持两种调用方式：
 *   1. CloudBase JS SDK callFunction → event 即传入的 data 对象（无 httpMethod）
 *   2. HTTP 访问服务 → event.body 为 JSON 字符串
 */
exports.main = async (event = {}) => {
  const apiKey = process.env.MINIMAX_TTS_KEY
  if (!apiKey) return { error: 'MINIMAX_TTS_KEY not configured on server' }

  let body
  if (event.httpMethod) {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: corsHeaders(), body: '' }
    }
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {})
    } catch {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Invalid JSON body' }) }
    }
  } else {
    body = event
  }

  try {
    const result = await post(MINIMAX_URL, body, apiKey)
    if (event.httpMethod) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        body: JSON.stringify(result),
      }
    }
    return result
  } catch (e) {
    if (event.httpMethod) {
      return { statusCode: 502, headers: corsHeaders(), body: JSON.stringify({ error: e.message }) }
    }
    return { error: e.message }
  }
}

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
      (res) => {
        let buf = ''
        res.on('data', (d) => (buf += d))
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Upstream ${res.statusCode}: ${buf.slice(0, 400)}`))
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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Max-Age': '86400',
  }
}
