/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VOLCENGINE_API_KEY?: string
  readonly VITE_VOLCENGINE_APP_ID?: string
  readonly VITE_VOLCENGINE_ACCESS_KEY?: string
  /** MiniMax 语音/对话 API Key */
  readonly VITE_MINIMAX_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
