/**
 * 流式 AI 服务 - 支持 DeepSeek / MiniMax 流式输出
 * 参考 ChatVRM/AIRI：实现边生成边输出，大幅减少首字响应时间
 */

import { useCharacterStore } from '../../store/characterStore'
import { useAIConfigStore } from '../../store/aiConfigStore'
import { BUILTIN_DEEPSEEK_AI_KEY, DEEPSEEK_API_URL } from '../../store/defaultConfig'

export interface StreamingMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

class StreamingAIService {
  private conversationHistory: StreamingMessage[] = []

  private getApiConfig() {
    const { aiConfig } = useAIConfigStore.getState()
    const apiKey = (aiConfig.apiKey || '').trim() || BUILTIN_DEEPSEEK_AI_KEY
    const model = aiConfig.model || 'deepseek-chat'
    // 生产环境：请求走 /api/ai（Key 在 Vercel 环境变量，不暴露到浏览器）
    const apiUrl = import.meta.env.PROD ? '/api/ai' : DEEPSEEK_API_URL
    console.log(`[StreamingAI] model=${model} prod=${import.meta.env.PROD} customKey=${!!aiConfig.apiKey}`)
    return { apiKey, apiUrl, model, temperature: 0.7, maxTokens: 500 }
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
      // 生产环境走 /api/ai，Key 由服务端注入，不在请求头里带
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (!import.meta.env.PROD) {
        headers['Authorization'] = `Bearer ${config.apiKey}`
      }

      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          stream: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`API 错误: ${response.status}`)
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
