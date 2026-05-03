/**
 * Cloudflare Pages Function — MiniMax TTS 代理
 */

interface Env {
  MINIMAX_TTS_API_KEY: string
}

const MINIMAX_TTS_URL = 'https://api.minimaxi.com/v1/t2a_v2'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const apiKey = env.MINIMAX_TTS_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'MINIMAX_TTS_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await request.text()

  const upstream = await fetch(MINIMAX_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  })

  const data = await upstream.text()

  return new Response(data, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
