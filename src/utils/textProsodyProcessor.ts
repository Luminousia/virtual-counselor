// 文本韵律处理器 - 增强语音感情和起伏

export interface ProsodyConfig {
  baseSpeed: number
  basePitch: number
  enableDynamic: boolean
}

/**
 * 分析文本情感和语气，添加韵律标记
 */
export class TextProsodyProcessor {
  /**
   * 预处理文本，添加停顿和强调标记以增强感情
   */
  static preprocessText(text: string): string {
    let processed = text
    
    // 1. 在句号、问号、感叹号后添加停顿（双换行）
    processed = processed.replace(/([。！？])\s*/g, '$1\n\n')
    
    // 2. 在逗号、顿号后添加短停顿（单换行）
    processed = processed.replace(/([，、])\s*/g, '$1\n')
    
    // 3. 在冒号、分号后添加中停顿
    processed = processed.replace(/([：；])\s*/g, '$1\n')
    
    // 4. 在引号内容前后添加轻微停顿
    processed = processed.replace(/(["""''「」『』])/g, '\n$1\n')
    
    // 5. 在情感词汇后添加强调（通过额外停顿）
    const emotionWords = [
      '真的', '非常', '特别', '很', '太', '极了', '极了',
      '吗', '呢', '吧', '啊', '呀', '哦', '嗯',
      '太好了', '太好了', '谢谢', '谢谢', '不客气', '不客气'
    ]
    emotionWords.forEach(word => {
      const regex = new RegExp(`(${word})`, 'g')
      processed = processed.replace(regex, '$1\n')
    })
    
    // 6. 移除多余的空行，但保留停顿
    processed = processed.replace(/\n{3,}/g, '\n\n')
    
    return processed.trim()
  }

  /**
   * 分析文本情感强度（0-1）
   * 返回情感类型和强度
   */
  static analyzeEmotion(text: string): { type: 'positive' | 'neutral' | 'negative', intensity: number } {
    const positiveWords = [
      '好', '棒', '赞', '棒极了', '太好了', '开心', '高兴', '快乐',
      '满意', '喜欢', '爱', '感谢', '谢谢', '感激', '惊喜',
      '温暖', '舒服', '安心', '放松', '轻松', '愉快', '兴奋'
    ]
    
    const negativeWords = [
      '不好', '糟糕', '难受', '难过', '痛苦', '焦虑', '担心', '害怕',
      '失望', '沮丧', '烦躁', '紧张', '不安', '疲惫', '累', '困'
    ]
    
    const lowerText = text.toLowerCase()
    let positiveCount = 0
    let negativeCount = 0
    
    positiveWords.forEach(word => {
      const count = (lowerText.match(new RegExp(word, 'g')) || []).length
      positiveCount += count
    })
    
    negativeWords.forEach(word => {
      const count = (lowerText.match(new RegExp(word, 'g')) || []).length
      negativeCount += count
    })
    
    const total = positiveCount + negativeCount
    if (total === 0) {
      return { type: 'neutral', intensity: 0.3 }
    }
    
    const intensity = Math.min(1.0, (total / text.length) * 10 + 0.3)
    
    if (positiveCount > negativeCount) {
      return { type: 'positive', intensity }
    } else if (negativeCount > positiveCount) {
      return { type: 'negative', intensity }
    } else {
      return { type: 'neutral', intensity: 0.5 }
    }
  }

  /**
   * 根据情感调整语速和音调
   */
  static adjustProsody(
    emotion: { type: 'positive' | 'neutral' | 'negative', intensity: number },
    baseSpeed: number = 0.85,
    basePitch: number = 0.98
  ): { speed: number, pitch: number } {
    const { type, intensity } = emotion
    
    let speed = baseSpeed
    let pitch = basePitch
    
    switch (type) {
      case 'positive':
        // 积极情感：稍快、音调稍高
        speed = baseSpeed + (intensity * 0.1)
        pitch = basePitch + (intensity * 0.05)
        break
      
      case 'negative':
        // 消极情感：稍慢、音调稍低（更温和、安慰）
        speed = baseSpeed - (intensity * 0.08)
        pitch = basePitch - (intensity * 0.03)
        break
      
      case 'neutral':
      default:
        // 中性情感：接近基准值，略有波动
        speed = baseSpeed + (Math.sin(intensity * Math.PI) * 0.05)
        pitch = basePitch + (Math.sin(intensity * Math.PI) * 0.02)
        break
    }
    
    // 限制范围
    speed = Math.max(0.7, Math.min(1.0, speed))
    pitch = Math.max(0.92, Math.min(1.05, pitch))
    
    return { speed, pitch }
  }

  /**
   * 将文本分段，每段使用不同的韵律参数
   * 这样可以产生更自然的起伏
   * 优化：限制分段数量，避免过多分段导致问题
   */
  static segmentText(text: string, maxSegmentLength: number = 100): string[] {
    // 如果文本较短，不分段
    if (text.length <= maxSegmentLength) {
      return [text]
    }
    
    // 先按句号、问号、感叹号分段
    const sentences = text.split(/([。！？])/).filter(s => s.trim().length > 0)
    const segments: string[] = []
    let currentSegment = ''
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const nextSegment = currentSegment + sentence
      
      if (nextSegment.length > maxSegmentLength && currentSegment.length > 0) {
        segments.push(currentSegment.trim())
        currentSegment = sentence
        
        // 限制最大分段数，避免过多分段
        if (segments.length >= 3) {
          // 如果已经分了很多段，将剩余内容合并到最后一段
          const remaining = sentences.slice(i).join('')
          if (remaining.trim().length > 0) {
            segments.push((currentSegment + remaining).trim())
          }
          break
        }
      } else {
        currentSegment = nextSegment
      }
    }
    
    if (currentSegment.trim().length > 0 && segments.length < 3) {
      segments.push(currentSegment.trim())
    }
    
    const result = segments.filter(s => s.length > 0)
    
    // 如果分段太多，合并成一段
    if (result.length > 3) {
      return [text]
    }
    
    return result
  }

  /**
   * 完整的文本处理和韵律分析
   */
  static processFullText(
    text: string,
    baseSpeed: number = 0.85,
    basePitch: number = 0.98
  ): {
    processedText: string
    segments: Array<{ text: string, speed: number, pitch: number }>
  } {
    // 预处理文本
    const processedText = this.preprocessText(text)
    
    // 分段
    const textSegments = this.segmentText(processedText, 80)
    
    // 为每段分析情感并调整韵律
    const segments = textSegments.map(segment => {
      const emotion = this.analyzeEmotion(segment)
      const prosody = this.adjustProsody(emotion, baseSpeed, basePitch)
      
      return {
        text: segment,
        speed: prosody.speed,
        pitch: prosody.pitch
      }
    })
    
    return {
      processedText,
      segments
    }
  }
}
