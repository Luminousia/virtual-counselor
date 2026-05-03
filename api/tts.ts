/**
 * Vercel Edge Function — MiniMax TTS 代理
 * 浏览器 → /api/tts → MiniMax API（Key 存在服务端环境变量）
 */

export const config = { runtime: 'edge' }

const MINIMAX_TTS_URL = 'https://api.minimaxi.com/v1/t2a_v2'

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.MINIMAX_TTS_API_KEY
  if (!apiKey) {
    return json({ error: 'MINIMAX_TTS_API_KEY not configured on server' }, 500)
  }

  let body: string
  try {
    body = await request.text()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const upstream = await fetch(MINIMAX_TTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  })

  const data = await upstream.text()

  return new Response(data, {
    status: upstream.status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
    },
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
