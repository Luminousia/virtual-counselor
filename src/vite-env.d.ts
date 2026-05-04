/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 腾讯云 CloudBase 环境 ID → 自动生成 AI/TTS HTTP 域名（见 defaultConfig.ts） */
  readonly VITE_CLOUDBASE_ENV_ID?: string
  readonly VITE_CLOUDBASE_REGION?: string
  /** 可选：手写云函数 / 网关地址，覆盖自动生成 */
  readonly VITE_AI_API_URL?: string
  readonly VITE_TTS_API_URL?: string
  /** 生产环境下对 AI_PROXY_URL 启用 SSE（需新版 cloudfunctions/ai 透传）；默认关，走整块 JSON */
  readonly VITE_AI_SSE?: string

  readonly VITE_VOLCENGINE_API_KEY?: string
  readonly VITE_VOLCENGINE_APP_ID?: string
  readonly VITE_VOLCENGINE_ACCESS_KEY?: string
  readonly VITE_MINIMAX_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
