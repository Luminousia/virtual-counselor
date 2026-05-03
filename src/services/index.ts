/**
 * Services 模块导出
 * 统一导出所有服务模块
 */

// 语音识别服务
export { default as SpeechRecognitionService, type SpeechRecognitionConfig, type SpeechRecognitionEventMap } from './SpeechRecognition';

// 语音合成服务
export { default as SpeechSynthesisService, type SpeechSynthesisConfig, type SpeechSynthesisEvents } from './SpeechSynthesis';

// 导出类型
export type { VoiceInfo } from './SpeechSynthesis';
