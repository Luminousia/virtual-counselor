'use strict'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

exports.main = async (event, context = {}) => {
  const method = (event.httpMethod || '').toUpperCase()
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' }
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return errResp('DEEPSEEK_API_KEY not configured on server')
  }

  let body
  try {
    body =
      typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {}
  } catch {
    return errResp('Invalid JSON body', 400)
  }

  const wantStream = body.stream === true

  if (!wantStream) {
    body = { ...body, stream: false }
    try {
      const result = await postJsonUpstream(body, apiKey)
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...cors() },
        body: JSON.stringify(result),
      }
    } catch (e) {
      return errResp(e.message)
    }
  }

  body = { ...body, stream: true }

  try {
    const upstreamRes = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const errTxt = upstreamRes.ok ? '' : await upstreamRes.text().catch(() => '')
    if (!upstreamRes.ok) {
      return errResp(
        errTxt.slice(0, 800) ? `Upstream ${upstreamRes.status}: ${errTxt.slice(0, 800)}` : `Upstream HTTP ${upstreamRes.status}`,
        upstreamRes.status >= 400 && upstreamRes.status < 600 ? upstreamRes.status : 502
      )
    }

    if (typeof context.sse === 'function') {
      const sseInst = context.sse({
        keepalive: true,
        headers: {
          ...cors(),
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
      if (sseInst && !sseInst.closed) {
        await forwardReadableToSse(upstreamRes.body, sseInst)
        return ''
      }
    }

    const fullText = await accumulateFromSseReadable(upstreamRes.body)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...cors() },
      body: JSON.stringify(chatCompletionEnvelope(fullText)),
    }
  } catch (e) {
    return errResp(e.message)
  }
}

function postJsonUpstream(data, apiKey) {
  return new Promise((resolve, reject) => {
    const https = require('https')
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
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              let msg = buf.substring(0, 800)
              try {
                const j = JSON.parse(buf)
                if (j?.error?.message) msg = j.error.message
              } catch {
                //
              }
              reject(new Error(`Upstream ${res.statusCode}: ${msg}`))
              return
            }
            resolve(JSON.parse(buf))
          } catch {
            reject(new Error(`Upstream non-JSON response: ${buf.substring(0, 200)}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function forwardReadableToSse(readableBody, sse) {
  const reader = readableBody.getReader()
  const decoder = new TextDecoder()
  let carry = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (value && value.byteLength) carry += decoder.decode(value, { stream: true })
      if (done) {
        carry += decoder.decode()
        break
      }

      while (carry.includes('\n')) {
        const i = carry.indexOf('\n')
        const raw = carry.slice(0, i).replace(/\r$/, '').trimEnd()
        carry = carry.slice(i + 1)
        if (!raw.startsWith('data:')) continue
        const payload = raw.slice(5).trimStart()
        if (payload && typeof sse.send === 'function') {
          sse.send({ data: payload })
        }
      }
    }
    const tail = carry.replace(/\r$/, '').trimEnd()
    if (tail.startsWith('data:')) {
      const payload = tail.slice(5).trimStart()
      if (payload && typeof sse.send === 'function') sse.send({ data: payload })
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      //
    }
    if (typeof sse.end === 'function') sse.end()
  }
}

async function accumulateFromSseReadable(readableBody) {
  const reader = readableBody.getReader()
  const decoder = new TextDecoder()
  let carry = ''
  let full = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (value && value.byteLength) carry += decoder.decode(value, { stream: true })
      if (done) {
        carry += decoder.decode()
        break
      }

      while (carry.includes('\n')) {
        const i = carry.indexOf('\n')
        const raw = carry.slice(0, i).replace(/\r$/, '').trimEnd()
        carry = carry.slice(i + 1)
        if (!raw.startsWith('data:')) continue
        const payload = raw.slice(5).trimStart()
        if (!payload || payload === '[DONE]') continue
        try {
          const j = JSON.parse(payload)
          const c = j.choices?.[0]?.delta?.content
          if (typeof c === 'string' && c) full += c
        } catch {
          //
        }
      }
    }
    const tail = carry.replace(/\r$/, '').trimEnd()
    if (tail.startsWith('data:')) {
      const payload = tail.slice(5).trimStart()
      if (payload && payload !== '[DONE]') {
        try {
          const j = JSON.parse(payload)
          const c = j.choices?.[0]?.delta?.content
          if (typeof c === 'string' && c) full += c
        } catch {
          //
        }
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      //
    }
  }
  return full
}

function chatCompletionEnvelope(content) {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: `chatcmpl-cloudbase-${now}`,
    object: 'chat.completion',
    created: now,
    model: '',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
  }
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
    body: JSON.stringify({ error: msg }),
  }
}
