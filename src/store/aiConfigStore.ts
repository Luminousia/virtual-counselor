/**
 * AI配置状态管理 - Zustand Store（DeepSeek 专用）
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AIConfigType, DEFAULT_AI_CONFIG } from './defaultConfig';

interface AIState {
  aiConfig: AIConfigType;
  setAIConfig: (config: Partial<AIConfigType>) => void;
  updateApiKey: (apiKey: string) => void;
  updateModel: (model: string) => void;
  resetConfig: () => void;
}

export const useAIConfigStore = create<AIState>()(
  persist(
    (set, get) => ({
      aiConfig: { ...DEFAULT_AI_CONFIG },

      setAIConfig: (newConfig: Partial<AIConfigType>) => {
        set({ aiConfig: { ...get().aiConfig, ...newConfig } });
      },

      updateApiKey: (apiKey: string) => {
        set((state) => ({ aiConfig: { ...state.aiConfig, apiKey } }));
      },

      updateModel: (model: string) => {
        set((state) => ({ aiConfig: { ...state.aiConfig, model } }));
      },

      resetConfig: () => {
        set({ aiConfig: { ...DEFAULT_AI_CONFIG } });
      },
    }),
    {
      name: 'ai-config-storage',
      partialize: (state) => ({ aiConfig: state.aiConfig })
    }
  )
);

export const useAIConfig = () => useAIConfigStore((state) => state.aiConfig);
export const useAIApiKey = () => useAIConfigStore((state) => state.aiConfig.apiKey);
export const useAIModel = () => useAIConfigStore((state) => state.aiConfig.model);
export const useAISystemPrompt = () => useAIConfigStore((state) => state.aiConfig.systemPrompt);

export const validateAIConfig = (): { valid: boolean; errors: string[] } => {
  const config = useAIConfigStore.getState().aiConfig;
  const errors: string[] = [];
  if (!config.model) errors.push('未选择模型');
  return { valid: errors.length === 0, errors };
};
