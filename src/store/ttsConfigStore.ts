/**
 * TTS配置状态管理 - Zustand Store（仅 MiniMax）
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  TTSConfigType,
  DEFAULT_TTS_CONFIG,
  DEFAULT_EMOTION_MAP,
  CustomEmotionMap,
  DetectedEmotion,
  TTSEmotion,
} from './defaultConfig';

interface TTSState {
  ttsConfig: TTSConfigType;
  setTTSConfig: (config: Partial<TTSConfigType>) => void;
  updateVoice: (voice: string) => void;
  updateSpeed: (speed: number) => void;
  updatePitch: (pitch: number) => void;
  updateVolume: (volume: number) => void;
  updateSentencePause: (ms: number) => void;
  updateEmotionSensitivity: (v: number) => void;
  updateEmotionMapEntry: (detected: DetectedEmotion, tts: TTSEmotion) => void;
  resetEmotionMap: () => void;
  resetConfig: () => void;
}

export const useTTSConfigStore = create<TTSState>()(
  persist(
    (set, get) => ({
      ttsConfig: { ...DEFAULT_TTS_CONFIG },

      setTTSConfig: (newConfig: Partial<TTSConfigType>) => {
        set({ ttsConfig: { ...get().ttsConfig, ...newConfig } });
      },

      updateVoice: (voice: string) => {
        set((s) => ({ ttsConfig: { ...s.ttsConfig, voice } }));
      },

      updateSpeed: (speed: number) => {
        set((s) => ({ ttsConfig: { ...s.ttsConfig, speed: Math.max(0.5, Math.min(2.0, speed)) } }));
      },

      updatePitch: (pitch: number) => {
        set((s) => ({ ttsConfig: { ...s.ttsConfig, pitch: Math.max(-12, Math.min(12, pitch)) } }));
      },

      updateVolume: (volume: number) => {
        set((s) => ({ ttsConfig: { ...s.ttsConfig, volume: Math.max(0, Math.min(1, volume)) } }));
      },

      updateSentencePause: (ms: number) => {
        set((s) => ({ ttsConfig: { ...s.ttsConfig, sentencePause: Math.max(0, Math.min(1000, ms)) } }));
      },

      updateEmotionSensitivity: (v: number) => {
        set((s) => ({ ttsConfig: { ...s.ttsConfig, emotionSensitivity: Math.max(0, Math.min(1, v)) } }));
      },

      updateEmotionMapEntry: (detected: DetectedEmotion, tts: TTSEmotion) => {
        set((s) => ({
          ttsConfig: {
            ...s.ttsConfig,
            customEmotionMap: { ...s.ttsConfig.customEmotionMap, [detected]: tts },
          },
        }));
      },

      resetEmotionMap: () => {
        set((s) => ({ ttsConfig: { ...s.ttsConfig, customEmotionMap: { ...DEFAULT_EMOTION_MAP } } }));
      },

      resetConfig: () => {
        set({ ttsConfig: { ...DEFAULT_TTS_CONFIG } });
      },
    }),
    {
      name: 'tts-config-storage',
      version: 2,
      migrate: (persisted: any) => {
        // 旧版本可能缺少新字段，用默认值补全
        return {
          ttsConfig: {
            ...DEFAULT_TTS_CONFIG,
            ...(persisted as any)?.ttsConfig,
          },
        };
      },
      partialize: (state) => ({ ttsConfig: state.ttsConfig }),
    }
  )
);

export const useTTSConfig = () => useTTSConfigStore((state) => state.ttsConfig);
export const useTTSVoice = () => useTTSConfigStore((state) => state.ttsConfig.voice);
export const useTTSSpeed = () => useTTSConfigStore((state) => state.ttsConfig.speed);
