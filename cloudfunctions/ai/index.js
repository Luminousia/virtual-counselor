'use strict'

const https = require('https')

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

exports.main = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' }
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return errResp('DEEPSEEK_API_KEY not configured on server')
  }

  let body
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {})
  } catch {
    return errResp('Invalid JSON body', 400)
  }

  // 云函数不支持 SSE 流式，强制关闭
  body = { ...body, stream: false }

  try {
    const result = await post(DEEPSEEK_URL, body, apiKey)
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
}

function errResp(msg, code = 500) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json', ...cors() },
    body: JSON.stringify({ error: msg })
  }
}
