/**
 * 分句器 - 将流式文本分割为可朗读的句子单元
 * 参考 ChatVRM/AIRI：实现边生成边播放
 */

export interface SentenceChunk {
  text: string
  isComplete: boolean // 是否是完整句子
}

export class SentenceSplitter {
  private buffer = ''
  private minSentenceLength = 5 // 最小句子长度
  
  // 句子结束标点
  private sentenceEnders = /([。！？.!?])/
  // 次要分隔符（逗号、分号等，用于长句分割）
  private secondaryDelimiters = /([，；,;])/
  private maxChunkLength = 50 // 最大 chunk 长度
  
  /**
   * 输入文本块，返回可以朗读的句子
   */
  feed(chunk: string): SentenceChunk[] {
    this.buffer += chunk
    const sentences: SentenceChunk[] = []
    
    // 首先按主要标点分割
    let lastIndex = 0
    let match: RegExpExecArray | null
    
    const regex = new RegExp(this.sentenceEnders.source, 'g')
    while ((match = regex.exec(this.buffer)) !== null) {
      const endIndex = match.index + match[0].length
      const sentence = this.buffer.slice(lastIndex, endIndex).trim()
      
      if (sentence.length >= this.minSentenceLength) {
        sentences.push({
          text: sentence,
          isComplete: true
        })
      }
      lastIndex = endIndex
    }
    
    // 更新 buffer，保留未完成的部分
    this.buffer = this.buffer.slice(lastIndex)
    
    // 如果 buffer 太长，按次要分隔符分割
    if (this.buffer.length > this.maxChunkLength) {
      const secondaryMatch = this.secondaryDelimiters.exec(this.buffer)
      if (secondaryMatch) {
        const endIndex = secondaryMatch.index + secondaryMatch[0].length
        const sentence = this.buffer.slice(0, endIndex).trim()
        
        if (sentence.length >= this.minSentenceLength) {
          sentences.push({
            text: sentence,
            isComplete: false // 不是完整句子，但可以先播放
          })
          this.buffer = this.buffer.slice(endIndex)
        }
      }
    }
    
    return sentences
  }
  
  /**
   * 刷新 buffer，返回剩余内容
   */
  flush(): SentenceChunk | null {
    const remaining = this.buffer.trim()
    this.buffer = ''
    
    if (remaining.length >= this.minSentenceLength) {
      return {
        text: remaining,
        isComplete: true
      }
    }
    
    return null
  }
  
  /**
   * 重置状态
   */
  reset() {
    this.buffer = ''
  }
  
  /**
   * 获取当前 buffer 内容
   */
  getBuffer(): string {
    return this.buffer
  }
}
