/**
 * 情感分析器 - 分析文本中的情感
 * 用于驱动 VRM 模型的表情变化
 */

export type EmotionType = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking'

export interface EmotionAnalysisResult {
  emotion: EmotionType
  intensity: number // 0-1
  keywords: string[]
}

// 情感关键词映射
// 原则：检测的是"说话方式"的情感色彩，而非"话题内容"
// 话题词（压力/焦虑/累等）不属于语气词，不触发 sad
const EMOTION_KEYWORDS: Record<EmotionType, string[]> = {
  happy: [
    // 明确正向情感
    '开心', '高兴', '快乐', '幸福', '太好了', '棒', '真好', '感谢', '谢谢',
    '喜欢', '期待', '兴奋', '欢迎', '恭喜', '祝贺', '加油', '支持',
    '美好', '愉快', '享受', '满足', '感动', '欣慰', '骄傲',
    // 温暖陪伴语气（咨询师常用）
    '陪', '陪伴', '一起', '我在', '我在这里', '没关系', '慢慢来',
    '放心', '不用担心', '你很棒', '做得很好', '相信你', '你可以',
    '温暖', '爱', '❤️', '💕', '✨',
    '😊', '😄', '🎉'
  ],
  // sad 只保留明确的语气词，去掉话题词
  sad: [
    '难过', '伤心', '悲伤', '失望', '遗憾', '抱歉', '对不起', '可惜',
    '痛苦', '委屈', '沮丧', '失落', '低落',
    '😢', '😔', '💔', '😞'
  ],
  angry: [
    '生气', '愤怒', '烦', '讨厌', '恨', '不满', '抱怨', '批评',
    '可恶', '该死', '混蛋', '受够了', '无语', '郁闷',
    '😠', '😡', '💢'
  ],
  surprised: [
    '惊讶', '震惊', '没想到', '竟然', '居然', '真的吗', '不可思议',
    '天哪', '哇', '太神奇了', '出乎意料', '意想不到',
    '😲', '😮', '🤯', '❗'
  ],
  thinking: [
    '思考', '考虑', '或许', '可能', '也许', '大概',
    '让我想想', '这个问题', '分析',
    '🤔', '💭'
  ],
  neutral: []
}

// 问句标识
const QUESTION_PATTERNS = [
  '吗', '呢', '吧', '？', '?',
  '什么', '怎么', '为什么', '哪里', '谁', '哪个', '多少', '如何'
]

// 强调/感叹标识
const EMPHASIS_PATTERNS = [
  '！', '!', '真的', '非常', '特别', '极其', '太', '超级', '绝对'
]

// 问候标识
const GREETING_PATTERNS = [
  '你好', '嗨', '早上好', '晚上好', '下午好', '早安', '晚安',
  '很高兴', '欢迎', '再见', '拜拜'
]

// 肯定/同意标识
const AGREEMENT_PATTERNS = [
  '是的', '对', '没错', '确实', '同意', '明白', '理解', '好的', '可以',
  '当然', '肯定', '一定'
]

export class EmotionAnalyzer {
  /**
   * 分析文本中的情感
   * @param text 待分析文本
   * @param sensitivity 灵敏度 0-1，越高越容易触发情绪变化（默认 0.5）
   *   - 0.0 (低)：需要 ≥3 个关键词才触发非 neutral
   *   - 0.5 (中)：需要 ≥2 个关键词
   *   - 1.0 (高)：1 个关键词即触发
   */
  analyze(text: string, sensitivity = 0.5): EmotionAnalysisResult {
    const normalizedText = text.toLowerCase()
    
    // sensitivity → 最低触发关键词数量（1-3）
    const threshold = Math.max(1, Math.round(3 - sensitivity * 2))
    
    // 统计各情感的关键词匹配数
    const emotionScores: Record<EmotionType, { count: number; keywords: string[] }> = {
      happy: { count: 0, keywords: [] },
      sad: { count: 0, keywords: [] },
      angry: { count: 0, keywords: [] },
      surprised: { count: 0, keywords: [] },
      thinking: { count: 0, keywords: [] },
      neutral: { count: 0, keywords: [] }
    }
    
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (normalizedText.includes(keyword.toLowerCase())) {
          emotionScores[emotion as EmotionType].count++
          emotionScores[emotion as EmotionType].keywords.push(keyword)
        }
      }
    }
    
    // 找出得分最高且超过阈值的情感
    let maxEmotion: EmotionType = 'neutral'
    let maxCount = 0
    
    for (const [emotion, data] of Object.entries(emotionScores)) {
      if (emotion === 'neutral') continue
      if (data.count >= threshold && data.count > maxCount) {
        maxCount = data.count
        maxEmotion = emotion as EmotionType
      }
    }
    
    // 计算强度（基于关键词匹配数量）
    const intensity = Math.min(1, maxCount / 3)
    
    return {
      emotion: maxEmotion,
      intensity: intensity > 0 ? Math.max(0.5, intensity) : 0.3,
      keywords: emotionScores[maxEmotion].keywords
    }
  }
  
  /**
   * 检测文本类型（用于语境动作）
   */
  detectTextType(text: string): 'question' | 'emphasis' | 'greeting' | 'agreement' | 'normal' {
    // 问句
    for (const pattern of QUESTION_PATTERNS) {
      if (text.includes(pattern)) {
        return 'question'
      }
    }
    
    // 问候
    for (const pattern of GREETING_PATTERNS) {
      if (text.includes(pattern)) {
        return 'greeting'
      }
    }
    
    // 同意/肯定
    for (const pattern of AGREEMENT_PATTERNS) {
      if (text.includes(pattern)) {
        return 'agreement'
      }
    }
    
    // 强调/感叹
    for (const pattern of EMPHASIS_PATTERNS) {
      if (text.includes(pattern)) {
        return 'emphasis'
      }
    }
    
    return 'normal'
  }
}

export const emotionAnalyzer = new EmotionAnalyzer()
