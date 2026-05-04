'use strict'

const https = require('https')
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

/**
 * 支持两种调用方式：
 *   1. CloudBase JS SDK callFunction → event 即传入的 data 对象（无 httpMethod）
 *   2. HTTP 访问服务（service.tcloudbase.com）→ event.body 为 JSON 字符串
 */
exports.main = async (event = {}) => {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return { error: 'DEEPSEEK_API_KEY not configured on server' }

  // 区分 SDK 调用 vs HTTP 调用
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
    // SDK 调用：event 就是 data
    body = event
  }

  body = { ...body, stream: false }

  try {
    const result = await postJsonUpstream(body, apiKey)
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
      (res) => {
        let buf = ''
        res.on('data', (d) => (buf += d))
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            let msg = buf.slice(0, 400)
            try { msg = JSON.parse(buf)?.error?.message || msg } catch { /**/ }
            return reject(new Error(`Upstream ${res.statusCode}: ${msg}`))
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
