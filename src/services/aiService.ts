// AI对话服务 - 支持动态API配置
import axios from 'axios'
import { useAIConfigStore } from '../store/aiConfigStore'
import { BUILTIN_DEEPSEEK_AI_KEY, DEEPSEEK_API_URL, AI_PROXY_URL } from '../store/defaultConfig'

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

class AIService {
  private conversationHistory: AIMessage[] = []

  private getApiConfig() {
    const { aiConfig } = useAIConfigStore.getState()
    return {
      apiKey: (aiConfig.apiKey || '').trim() || BUILTIN_DEEPSEEK_AI_KEY,
      apiUrl: DEEPSEEK_API_URL,
      model: aiConfig.model || 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 2000,
    }
  }

  // 调用AI API获取回复
  async getResponse(userMessage: string): Promise<string> {
    try {
      const apiConfig = this.getApiConfig()
      const { apiKey, apiUrl, model, temperature, maxTokens } = apiConfig
      
      // 构建消息列表（转换为 API 格式，包含历史记录）
      const historyMessages = this.conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      // 添加当前用户消息
      const currentUserMessage = {
        role: 'user' as const,
        content: userMessage,
      }

      // 添加系统提示词 - 心理咨询师角色（温和、耐心、热情）
      const systemMessage = {
        role: 'system' as const,
        content: `你是一位专业的虚拟数字人心理咨询师，名叫小暖。你是一位温和、耐心、热情的心理咨询师，致力于为每一位来访者提供温暖而专业的心理支持。

## 你的核心特质：

### 🌟 温和 (Gentle)
- 用温和、柔和的语调与来访者交流
- 措辞温和友善，避免使用强硬或批评性的语言
- 以理解和支持的态度对待每一位来访者
- 创造一个安全、舒适、无评判的对话环境

### 💝 耐心 (Patient)  
- 耐心倾听来访者的每一句话，不打断他们的表达
- 给予来访者充分的时间思考和表达
- 不急于给出建议或解决方案，让来访者自己探索和发现
- 理解每个人的节奏不同，用耐心陪伴来访者的成长过程

### ❤️ 热情 (Enthusiastic)
- 对每一位来访者都充满真诚的关怀和热情
- 主动关注来访者的情绪和需求
- 用鼓励和肯定的语言给予来访者支持
- 传递温暖和希望，让来访者感受到被重视和理解

## 你的职责：

1. **深度倾听**：认真倾听来访者的困扰、情绪和想法，不做评判
2. **共情理解**：用共情的方式回应来访者的情绪，让他们感受到被理解
3. **专业支持**：基于心理学原理，提供专业但不生硬的指导和建议
4. **陪伴成长**：以耐心和陪伴的态度，支持来访者自我探索和成长
5. **建立信任**：通过温暖、耐心、专业的交流，建立信任的咨询关系

## 交流风格：

- 使用温暖、亲切的语言，就像一位耐心的朋友在倾听
- 多用"我理解你的感受"、"这确实不容易"、"慢慢来"等表达理解和支持的词语
- 避免使用过于专业的术语，用通俗易懂的语言交流
- 适时给予鼓励和肯定，比如"你能这样想已经很好了"、"你表达得很清楚"
- 在来访者分享困扰时，先共情再引导，而不是急于给出建议
- 用开放性的问题引导来访者自我探索，比如"你觉得这可能是因为什么呢？"、"你想谈谈更多关于这个的感受吗？"

## 重要原则：

- 始终保持温和、耐心、热情的态度
- 尊重来访者的感受和想法，不做评判
- 给予来访者安全感和信任感
- 用温暖的语言传递希望和支持

请记住，你不仅仅是在回答问题，更是在用你的温和、耐心和热情陪伴和帮助来访者。`,
      }

      // 调用AI API
      // 生产环境有 CloudBase 代理时走代理（Key 存服务端），否则直接调用（带 Key）
      const requestBody = {
        model,
        messages: [systemMessage, ...historyMessages, currentUserMessage],
        temperature,
        max_tokens: maxTokens,
      }
      const response = AI_PROXY_URL
        ? await axios.post(AI_PROXY_URL, requestBody)
        : await axios.post(apiUrl, requestBody, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          })

      // 提取 AI 回复
      const aiResponse = response.data.choices[0]?.message?.content || '抱歉，我无法生成回复。'

      // API 调用成功后，更新历史记录
      const userMsg: AIMessage = {
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      }
      const assistantMsg: AIMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
      }
      this.conversationHistory.push(userMsg, assistantMsg)

      // 限制历史记录长度（保留最近 20 轮对话，即 40 条消息）
      if (this.conversationHistory.length > 40) {
        this.conversationHistory = this.conversationHistory.slice(-40)
      }

      return aiResponse
    } catch (error: any) {
      console.error('AI API 调用失败:', error)
      
      // 返回错误提示
      let errorMessage = '抱歉，服务暂时不可用，请稍后再试。'
      
      if (error.response) {
        // API 返回了错误响应
        const status = error.response.status
        const data = error.response.data
        
        if (status === 401) {
          errorMessage = 'API 密钥无效，请检查配置。'
        } else if (status === 429) {
          errorMessage = '请求过于频繁，请稍后再试。'
        } else if (data?.error?.message) {
          errorMessage = `API 错误: ${data.error.message}`
        }
      } else if (error.request) {
        errorMessage = '网络连接失败，请检查网络设置。'
      }

      return errorMessage
    }
  }

  // 计算信任度变化（基于对话内容 - 心理咨询场景，更温和、耐心、热情）
  calculateTrustChange(userMessage: string, aiResponse: string): number {
    let change = 0

    const lowerMessage = userMessage.toLowerCase()
    const lowerResponse = aiResponse.toLowerCase()

    // 咨询者表达正面感受的关键词（增加信任度）
    const positiveKeywords = [
      '谢谢', '感谢', '理解', '明白', '有帮助', '有用', '好多了', 
      '舒服', '放松', '安心', '信任', '温暖', '支持', '谢谢你',
      '很有帮助', '说得对', '我懂了', '有道理', '很专业', '很耐心',
      '很温和', '很热情', '很好', '太感谢了', '非常感谢', '真的谢谢',
      '感觉好多了', '心情好多了', '轻松多了', '豁然开朗', '有启发',
      '你真好', '你很有耐心', '你理解我', '你懂我', '你很好', '谢谢小暖'
    ]
    
    // 咨询者表达负面感受的关键词（降低信任度，但降低幅度较小，因为心理咨询需要耐心）
    const negativeKeywords = [
      '不理解', '不明白', '没用', '没用处', '不对', '错误', 
      '失望', '怀疑', '不信任', '不好', '不够', '不行',
      '没有帮助', '听不懂', '不想说', '不想聊', '算了',
      '还是算了', '算了不说了', '没什么用', '没意思'
    ]

    // 检查咨询者的正面/负面表达（正面表达给予更多奖励）
    positiveKeywords.forEach((keyword) => {
      if (lowerMessage.includes(keyword)) {
        change += 2.5 // 增加正面反馈的奖励
      }
    })

    negativeKeywords.forEach((keyword) => {
      if (lowerMessage.includes(keyword)) {
        change -= 2 // 降低负面反馈的惩罚，保持耐心
      }
    })

    // 咨询师回复质量评估 - 温和、耐心、热情的关键词
    // 咨询师使用共情和理解性词汇（增加信任度）
    const empatheticKeywords = [
      '理解', '明白', '感受', '理解你', '我明白', '我理解',
      '听起来', '我能理解', '这确实', '不容易', '辛苦了',
      '你的感受', '你的情绪', '你的想法', '我理解你的感受',
      '这确实不容易', '我能感受到', '这很不容易', '我懂',
      '慢慢来', '不用着急', '没关系', '这很正常'
    ]

    // 温和、耐心的表达
    const gentleKeywords = [
      '慢慢来', '不用着急', '没关系', '不着急', '慢慢说',
      '我们慢慢来', '不要着急', '可以慢慢想', '慢慢来就好',
      '我在这里', '我在听', '我会陪你', '我会在这里陪伴你'
    ]

    // 热情、鼓励的表达
    const enthusiasticKeywords = [
      '很棒', '很好', '你做得很好', '你很勇敢', '你很棒',
      '这是一个好的开始', '你已经很棒了', '继续加油',
      '我相信你', '你一定可以的', '你很坚强'
    ]
    
    empatheticKeywords.forEach((keyword) => {
      if (lowerResponse.includes(keyword)) {
        change += 1.5 // 增加共情表达的奖励
      }
    })

    gentleKeywords.forEach((keyword) => {
      if (lowerResponse.includes(keyword)) {
        change += 1 // 温和、耐心的表达增加信任
      }
    })

    enthusiasticKeywords.forEach((keyword) => {
      if (lowerResponse.includes(keyword)) {
        change += 1 // 热情、鼓励的表达增加信任
      }
    })

    // 回复长度和质量影响信任度（心理咨询需要充分的回应，但不应该太长）
    // 适度的回复长度（80-300字）表示认真和专业
    if (aiResponse.length >= 80 && aiResponse.length <= 300) {
      change += 1.5
    } else if (aiResponse.length > 300) {
      change += 0.5 // 过长的回复可能显得啰嗦
    } else if (aiResponse.length < 40) {
      change -= 0.5 // 过短的回复可能显得不够认真
    }

    // 咨询者继续表达的意愿（如果消息较长，说明愿意继续沟通和分享）
    if (userMessage.length > 30 && userMessage.length < 500) {
      change += 1.5 // 适度的分享增加信任
    } else if (userMessage.length >= 500) {
      change += 2 // 深度分享表示高度信任
    }

    // 咨询者分享个人感受和困扰（这是建立信任的重要标志）
    const personalSharingKeywords = [
      '我觉得', '我感觉', '我感到', '我很', '我经常', '我总是',
      '我有时候', '我心里', '我想', '我担心', '我害怕', '我难过',
      '我开心', '我烦恼', '我的', '我自己的', '关于我'
    ]

    let personalSharingCount = 0
    personalSharingKeywords.forEach((keyword) => {
      if (lowerMessage.includes(keyword)) {
        personalSharingCount++
      }
    })
    
    if (personalSharingCount >= 2) {
      change += 2 // 分享个人感受是建立信任的重要标志
    } else if (personalSharingCount === 1) {
      change += 1
    }

    // 限制单次变化的幅度，保持温和的变化（避免信任度剧烈波动）
    return Math.max(-8, Math.min(8, change))
  }

  clearHistory() {
    this.conversationHistory = []
  }
}

export const aiService = new AIService()
