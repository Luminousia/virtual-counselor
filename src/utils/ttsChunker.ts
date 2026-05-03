/**
 * TTS 文本分块工具
 * 参考 AIRI 的文本分块策略，支持智能分段和特殊标记
 */

// 特殊字符定义
export const TTS_FLUSH_INSTRUCTION = '\u200B' // 零宽空格 - 强制刷新
export const TTS_SPECIAL_TOKEN = '\u2063' // 不可见分隔符 - 特殊标记（延迟、情绪等）

// 标点符号分类
const keptPunctuations = new Set('?？!！') // 保留在文本中的标点
const hardPunctuations = new Set('.。?？!！…⋯～~\n\t\r') // 硬标点 - 强制分段
const softPunctuations = new Set(',，、–—:：;；《》「」') // 软标点 - 建议分段

export interface TTSChunk {
  text: string
  words: number
  reason: 'boost' | 'limit' | 'hard' | 'flush' | 'special'
  special?: string | null
}

export interface TTSChunkOptions {
  boost?: number // 初始加速分块数量（减少延迟）
  minimumWords?: number // 最小单词数
  maximumWords?: number // 最大单词数
}

/**
 * 智能文本分块
 * 参考 AIRI: packages/stage-ui/src/utils/tts.ts
 */
export function* chunkTTSText(
  text: string,
  options?: TTSChunkOptions
): Generator<TTSChunk, void, unknown> {
  const {
    boost = 2,
    minimumWords = 4,
    maximumWords = 12,
  } = options ?? {}

  // 使用 Intl.Segmenter 进行单词分割（如果支持）
  let segmenter: Intl.Segmenter | null = null
  try {
    segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
  } catch (e) {
    // 如果不支持，使用简单的字符分割
    console.warn('Intl.Segmenter not supported, using simple segmentation')
  }

  let yieldCount = 0
  let buffer = ''
  let chunk = ''
  let chunkWordsCount = 0

  let previousValue: string | undefined

  for (let i = 0; i < text.length; i++) {
    const value = text[i]

    // 处理多字节字符
    if (value.length > 1) {
      previousValue = value
      continue
    }

    const flush = value === TTS_FLUSH_INSTRUCTION
    const special = value === TTS_SPECIAL_TOKEN
    const hard = hardPunctuations.has(value)
    const soft = softPunctuations.has(value)
    const kept = keptPunctuations.has(value)

    // 处理特殊字符
    if (flush || special || hard || soft) {
      // 处理数字中的小数点
      if ((value === '.' || value === ',') && previousValue !== undefined && /\d/.test(previousValue)) {
        const nextValue = text[i + 1]
        if (nextValue && /\d/.test(nextValue)) {
          // 这是小数点，保留在缓冲区中
          buffer += value
          previousValue = value
          continue
        }
      }

      // 处理省略号 "..."
      if (value === '.') {
        const nextValue = text[i + 1]
        const afterNextValue = text[i + 2]
        if (nextValue === '.' && afterNextValue === '.') {
          // 替换为省略号字符
          i += 2 // 跳过后续的点
          buffer += '…'
          previousValue = '…'
          continue
        }
      }

      // 如果缓冲区为空且是特殊标记
      if (buffer.length === 0) {
        if (special) {
          yield {
            text: '',
            words: 0,
            reason: 'special',
            special: null,
          }
          yieldCount++
          chunkWordsCount = 0
        }
        previousValue = value
        continue
      }

      // 计算单词数
      const words = segmenter
        ? [...segmenter.segment(buffer)].filter(w => w.isWordLike).length
        : buffer.split(/\s+/).filter(w => w.length > 0).length

      // 如果超过最大单词数，先输出当前块
      if (chunkWordsCount > minimumWords && chunkWordsCount + words.length > maximumWords) {
        const text = kept ? chunk.trim() + value : chunk.trim()
        yield {
          text,
          words: chunkWordsCount,
          reason: 'limit',
        }
        yieldCount++
        chunk = ''
        chunkWordsCount = 0
      }

      chunk += buffer + value
      chunkWordsCount += words

      buffer = ''

      // 处理特殊标记
      if (special) {
        const text = chunk.slice(0, -1).trim()
        yield {
          text,
          words: chunkWordsCount,
          reason: 'special',
          special: null, // 特殊标记值由调用者提供
        }
        yieldCount++
        chunk = ''
        chunkWordsCount = 0
      } else if (flush || hard || chunkWordsCount > maximumWords || yieldCount < boost) {
        const text = chunk.trim()
        yield {
          text,
          words: chunkWordsCount,
          reason: flush ? 'flush' : hard ? 'hard' : chunkWordsCount > maximumWords ? 'limit' : 'boost',
        }
        yieldCount++
        chunk = ''
        chunkWordsCount = 0
      }

      previousValue = value
      continue
    }

    // 普通字符，添加到缓冲区
    buffer += value
    previousValue = value
  }

  // 处理剩余的文本
  if (chunk.length > 0 || buffer.length > 0) {
    const words = segmenter
      ? [...segmenter.segment(buffer)].filter(w => w.isWordLike).length
      : buffer.split(/\s+/).filter(w => w.length > 0).length

    const text = (chunk + buffer).trim()
    yield {
      text,
      words: chunkWordsCount + words,
      reason: 'flush',
    }
  }
}

/**
 * 清理文本中的特殊标记
 */
export function sanitizeChunk(text: string): string {
  return text
    .replaceAll(TTS_SPECIAL_TOKEN, '')
    .replaceAll(TTS_FLUSH_INSTRUCTION, '')
    .trim()
}
