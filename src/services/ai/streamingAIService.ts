/**
 * 流式 AI 服务 - 支持 DeepSeek / MiniMax 流式输出
 * 参考 ChatVRM/AIRI：实现边生成边输出，大幅减少首字响应时间
 */

import { useCharacterStore } from '../../store/characterStore'
import { useAIConfigStore } from '../../store/aiConfigStore'
import { BUILTIN_DEEPSEEK_AI_KEY, DEEPSEEK_API_URL, AI_PROXY_URL } from '../../store/defaultConfig'
import { callCloudFunction, isCloudBaseEnv } from '../cloudbaseClient'

export interface StreamingMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

class StreamingAIService {
  private conversationHistory: StreamingMessage[] = []

  private getAiEndpoint(): { url: string; jsonMode: boolean } {
    if (!import.meta.env.PROD) {
      return { url: DEEPSEEK_API_URL, jsonMode: false }
    }
    if (AI_PROXY_URL) {
      /** 设为 true 时走 CloudBase / 自定义网关的 SSE 透传（需部署新版 ai 云函数）；默认 false（整块 JSON，兼容最全） */
      const cloudStream = import.meta.env.VITE_AI_SSE === 'true'
      return { url: AI_PROXY_URL, jsonMode: !cloudStream }
    }
    return { url: '/api/ai', jsonMode: false }
  }

  private getApiConfig() {
    const { aiConfig } = useAIConfigStore.getState()
    const apiKey = (aiConfig.apiKey || '').trim() || BUILTIN_DEEPSEEK_AI_KEY
    const model = aiConfig.model || 'deepseek-chat'
    const { url: apiUrl, jsonMode } = this.getAiEndpoint()
    console.log(
      `[StreamingAI] model=${model} prod=${import.meta.env.PROD} cloudJson=${jsonMode} cloudSse=${import.meta.env.VITE_AI_SSE === 'true'} customKey=${!!aiConfig.apiKey}`
    )
    return { apiKey, apiUrl, model, temperature: 0.7, maxTokens: 500, jsonMode }
  }

  /**
   * 获取当前系统提示词（从人设配置中生成）
   */
  private getSystemPrompt(): string {
    // 从 store 获取人设配置
    const store = useCharacterStore.getState()
    return store.getSystemPrompt()
  }

  /**
   * 流式获取 AI 响应
   * @param userMessage 用户消息
   * @param onChunk 每个 chunk 的回调
   * @param onComplete 完成时的回调
   */
  async streamResponse(
    userMessage: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string) => void
  ): Promise<void> {
    const config = this.getApiConfig()
    const systemPrompt = this.getSystemPrompt()
    
    console.log('[StreamingAI] 使用系统提示词:', systemPrompt.substring(0, 100) + '...')
    
    // 构建消息
    const messages: StreamingMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory,
      { role: 'user', content: userMessage }
    ]

    try {
      const { apiUrl, apiKey, model, temperature, maxTokens, jsonMode } = config

      // ── CloudBase SDK 调用（生产环境 + VITE_CLOUDBASE_ENV_ID）：绕过 CORS ──
      if (isCloudBaseEnv()) {
        type AIResult = { choices?: Array<{ message?: { content?: string } }> }
        const data = await callCloudFunction<AIResult>('ai', {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        })
        const fullText = data?.choices?.[0]?.message?.content?.trim() ?? ''
        if (fullText) onChunk(fullText)
        this.conversationHistory.push({ role: 'user', content: userMessage })
        if (fullText) this.conversationHistory.push({ role: 'assistant', content: fullText })
        if (this.conversationHistory.length > 20) this.conversationHistory = this.conversationHistory.slice(-20)
        onComplete(fullText)
        return
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (!import.meta.env.PROD) {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      // ── CloudBase / 远端 JSON 网关：一次请求整块回复（与服务端 cloudfunctions/ai 对齐）──
      if (jsonMode) {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false,
          }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const errMsg = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error || data)
          throw new Error(`API 错误: ${response.status} ${errMsg}`)
        }
        if (data?.error && typeof data.error === 'object' && data.error.message) {
          throw new Error(String(data.error.message))
        }

        const fullText =
          (data?.choices?.[0]?.message?.content as string | undefined)?.trim?.() ??
          ''

        // 单次回调：UI/TTS 与流式收口一致（无打字机效果）
        if (fullText) onChunk(fullText)

        this.conversationHistory.push({ role: 'user', content: userMessage })
        if (fullText) {
          this.conversationHistory.push({ role: 'assistant', content: fullText })
        }
        if (this.conversationHistory.length > 20) {
          this.conversationHistory = this.conversationHistory.slice(-20)
        }
        onComplete(fullText)
        return
      }

      // ── 同源 /api/ai 或直连 DeepSeek：SSE 流式 ──

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`API 错误: ${response.status}`)
      }

      /** 同上 AI_PROXY：`context.sse` 不可用时云函数会将流式聚合为整块 JSON（仍走此 SSE 分支） */
      const contentType = (response.headers.get('Content-Type') || '').toLowerCase()
      if (contentType.includes('application/json')) {
        const data = await response.json().catch(() => ({}))
        const rawErr = (data as { error?: { message?: string } | string })?.error
        if (rawErr !== undefined && rawErr !== null) {
          const errMsg =
            typeof rawErr === 'string'
              ? rawErr
              : typeof rawErr === 'object' && rawErr.message
                ? String(rawErr.message)
                : JSON.stringify(rawErr)
          throw new Error(`API 错误: ${response.status} ${errMsg}`)
        }
        const fullTextRaw = (data as { choices?: Array<{ message?: { content?: string } }> })
          ?.choices?.[0]?.message?.content
        const fullText = typeof fullTextRaw === 'string' ? fullTextRaw.trim() : ''
        if (fullText) onChunk(fullText)
        this.conversationHistory.push({ role: 'user', content: userMessage })
        if (fullText) {
          this.conversationHistory.push({ role: 'assistant', content: fullText })
        }
        if (this.conversationHistory.length > 20) {
          this.conversationHistory = this.conversationHistory.slice(-20)
        }
        onComplete(fullText)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const content = json.choices?.[0]?.delta?.content
              if (content) {
                fullText += content
                onChunk(content)
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 更新历史记录
      this.conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: fullText }
      )

      // 限制历史记录长度
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20)
      }

      onComplete(fullText)
    } catch (error) {
      console.error('流式 AI 请求失败:', error)
      throw error
    }
  }

  /**
   * 非流式获取响应（备用）
   */
  async getResponse(userMessage: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let fullText = ''
      this.streamResponse(
        userMessage,
        (chunk) => { fullText += chunk },
        (text) => resolve(text)
      ).catch(reject)
    })
  }

  clearHistory() {
    this.conversationHistory = []
  }
}

export const streamingAIService = new StreamingAIService()
