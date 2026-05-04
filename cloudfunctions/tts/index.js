'use strict'

const https = require('https')

const MINIMAX_URL = 'https://api.minimaxi.com/v1/t2a_v2'

exports.main = async (event) => {
  const method = (event.httpMethod || '').toUpperCase()
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' }
  }

  const apiKey = process.env.MINIMAX_TTS_KEY
  if (!apiKey) {
    return errResp('MINIMAX_TTS_KEY not configured on server')
  }

  let body
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {})
  } catch {
    return errResp('Invalid JSON body', 400)
  }

  try {
    const result = await post(MINIMAX_URL, body, apiKey)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...cors() },
      body: JSON.stringify(result)
    }
  } catch (e) {
    return errResp(e.message)
  }
}

function post(url, data, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data)
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let buf = ''
      res.on('data', d => buf += d)
      res.on('end', () => {
        try { resolve(JSON.parse(buf)) }
        catch { reject(new Error(`上游返回非 JSON: ${buf.substring(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Max-Age': '86400',
  }
}

function errResp(msg, code = 500) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json', ...cors() },
    body: JSON.stringify({ error: msg })
  }
}
