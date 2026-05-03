/**
 * API配置Store - 统一导出（向后兼容）
 */

import { useTTSConfigStore as TTSStore, useTTSConfig, useTTSVoice, useTTSSpeed } from './ttsConfigStore';
import { useAIConfigStore as AIStore, useAIConfig, useAIApiKey, useAIModel, useAISystemPrompt, validateAIConfig } from './aiConfigStore';

export type { TTSConfigType } from './defaultConfig';
export type { AIConfigType } from './defaultConfig';
export type { TTSConfigType as TTSConfig } from './defaultConfig';

export const useTTSConfigStore = TTSStore;
export const useApiConfigStore = AIStore;

export { useTTSConfig, useTTSVoice, useTTSSpeed };
export { useAIConfig, useAIApiKey, useAIModel, useAISystemPrompt, validateAIConfig };

export interface ApiConfig {
  apiKey: string;
  model: string;
  systemPrompt: string;
}
