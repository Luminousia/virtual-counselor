/**
 * Services 聚合导出（便于按需 import）。
 * 主流程组件多直接深层路径引用本目录子模块。
 */

export { streamingAIService } from './ai/streamingAIService'
export { emotionAnalyzer } from './ai/emotionAnalyzer'
export { SentenceSplitter } from './ai/sentenceSplitter'
export { aiService } from './aiService'

export { ttsQueueManager } from './tts/ttsQueueManager'
export { MinimaxTTSService, minimaxTTSService, MINIMAX_VOICES } from './tts/minimaxTTSService'

export { indexedDBService } from './storage/indexedDBService'
