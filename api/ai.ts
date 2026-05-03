/**
 * Vercel Edge Function — DeepSeek AI 流式代理
 * 浏览器 → /api/ai → DeepSeek API（Key 存在服务端环境变量）
 */

export const config = { runtime: 'edge' }

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

export default async function handler(request: Request): Promise<Response> {
  // 只允许 POST
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return json({ error: 'DEEPSEEK_API_KEY not configured on server' }, 500)
  }

  let body: string
  try {
    body = await request.text()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const upstream = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  })

  // 直接透传响应流（保持 SSE 格式）
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...corsHeaders(),
      'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
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
