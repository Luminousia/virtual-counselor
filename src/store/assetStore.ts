/**
 * 资源管理 Store
 * 管理场景图片和 VRM 模型的状态
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { indexedDBService, FileMetadata } from '../services/storage/indexedDBService';

// ==================== 类型定义 ====================

interface AssetState {
  // 场景列表
  scenes: FileMetadata[];
  currentSceneId: string | null;      // IndexedDB 自定义场景
  currentSceneUrl: string | null;
  currentPresetSceneId: string;       // 预设场景 ID（'counseling-room' / 'none' / gradient-xxx）

  // 模型列表
  models: FileMetadata[];
  currentModelId: string | null;
  currentModelUrl: string | null;
  
  // 加载状态
  isLoading: boolean;
  
  // 初始化
  init: () => Promise<void>;
  
  // 场景操作
  loadScenes: () => Promise<void>;
  addScene: (file: File, name?: string) => Promise<void>;
  deleteScene: (id: string) => Promise<void>;
  selectScene: (id: string | null) => Promise<void>;
  selectPresetScene: (id: string) => void;
  
  // 模型操作
  loadModels: () => Promise<void>;
  addModel: (file: File, name?: string) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  selectModel: (id: string | null) => Promise<void>;
  
  // 存储信息
  getStorageInfo: () => Promise<{ scenes: number; models: number; total: number; formatted: string }>;
  clearAll: () => Promise<void>;
}

// ==================== 创建 Store ====================

export const useAssetStore = create<AssetState>()(
  persist(
    (set, get) => ({
      scenes: [],
      currentSceneId: null,
      currentSceneUrl: null,
      currentPresetSceneId: 'counseling-room',
      models: [],
      currentModelId: null,
      currentModelUrl: null,
      isLoading: false,

      init: async () => {
        await indexedDBService.init();
        await get().loadScenes();
        await get().loadModels();
        
        // 恢复上次选择的场景
        const { currentSceneId } = get();
        if (currentSceneId) {
          const url = await indexedDBService.getSceneUrl(currentSceneId);
          set({ currentSceneUrl: url });
        }
        
        // 恢复上次选择的模型
        const { currentModelId } = get();
        if (currentModelId) {
          const url = await indexedDBService.getModelUrl(currentModelId);
          set({ currentModelUrl: url });
        }
      },

      // ==================== 场景操作 ====================

      loadScenes: async () => {
        set({ isLoading: true });
        try {
          const scenes = await indexedDBService.getAllScenes();
          set({ scenes, isLoading: false });
        } catch (error) {
          console.error('[AssetStore] 加载场景失败:', error);
          set({ isLoading: false });
        }
      },

      addScene: async (file: File, name?: string) => {
        set({ isLoading: true });
        try {
          await indexedDBService.saveScene(file, name);
          await get().loadScenes();
        } catch (error) {
          console.error('[AssetStore] 添加场景失败:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      deleteScene: async (id: string) => {
        try {
          await indexedDBService.deleteScene(id);
          const { currentSceneId } = get();
          if (currentSceneId === id) {
            set({ currentSceneId: null, currentSceneUrl: null });
          }
          await get().loadScenes();
        } catch (error) {
          console.error('[AssetStore] 删除场景失败:', error);
          throw error;
        }
      },

      selectScene: async (id: string | null) => {
        if (id === null) {
          set({ currentSceneId: null, currentSceneUrl: null });
          return;
        }
        
        try {
          const url = await indexedDBService.getSceneUrl(id);
          set({ currentSceneId: id, currentSceneUrl: url });
        } catch (error) {
          console.error('[AssetStore] 选择场景失败:', error);
        }
      },

      selectPresetScene: (id: string) => {
        set({ currentPresetSceneId: id, currentSceneId: null, currentSceneUrl: null });
      },

      // ==================== 模型操作 ====================

      loadModels: async () => {
        set({ isLoading: true });
        try {
          const models = await indexedDBService.getAllModels();
          set({ models, isLoading: false });
        } catch (error) {
          console.error('[AssetStore] 加载模型失败:', error);
          set({ isLoading: false });
        }
      },

      addModel: async (file: File, name?: string) => {
        set({ isLoading: true });
        try {
          await indexedDBService.saveModel(file, name);
          await get().loadModels();
        } catch (error) {
          console.error('[AssetStore] 添加模型失败:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      deleteModel: async (id: string) => {
        try {
          await indexedDBService.deleteModel(id);
          const { currentModelId } = get();
          if (currentModelId === id) {
            set({ currentModelId: null, currentModelUrl: null });
          }
          await get().loadModels();
        } catch (error) {
          console.error('[AssetStore] 删除模型失败:', error);
          throw error;
        }
      },

      selectModel: async (id: string | null) => {
        if (id === null) {
          set({ currentModelId: null, currentModelUrl: null });
          return;
        }
        
        try {
          const url = await indexedDBService.getModelUrl(id);
          set({ currentModelId: id, currentModelUrl: url });
        } catch (error) {
          console.error('[AssetStore] 选择模型失败:', error);
        }
      },

      // ==================== 存储信息 ====================

      getStorageInfo: async () => {
        const usage = await indexedDBService.getStorageUsage();
        return {
          ...usage,
          formatted: indexedDBService.formatSize(usage.total)
        };
      },

      clearAll: async () => {
        await indexedDBService.clearAll();
        set({
          scenes: [],
          currentSceneId: null,
          currentSceneUrl: null,
          models: [],
          currentModelId: null,
          currentModelUrl: null
        });
      }
    }),
    {
      name: 'asset-store',
      partialize: (state) => ({
        currentSceneId: state.currentSceneId,
        currentPresetSceneId: state.currentPresetSceneId,
        currentModelId: state.currentModelId
      })
    }
  )
);

// ==================== Selector Hooks ====================

export const useScenes = () => useAssetStore((state) => state.scenes);
export const useCurrentScene = () => useAssetStore((state) => ({
  id: state.currentSceneId,
  url: state.currentSceneUrl
}));
export const useModels = () => useAssetStore((state) => state.models);
export const useCurrentModel = () => useAssetStore((state) => ({
  id: state.currentModelId,
  url: state.currentModelUrl
}));
