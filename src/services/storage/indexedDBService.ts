/**
 * IndexedDB 存储服务
 * 用于存储大文件：场景图片、VRM模型等
 */

const DB_NAME = 'VirtualHumanDB';
const DB_VERSION = 1;

// Store 名称
const STORES = {
  SCENES: 'scenes',      // 场景图片
  MODELS: 'models',      // VRM 模型
  THUMBNAILS: 'thumbnails' // 缩略图
};

export interface StoredFile {
  id: string;
  name: string;
  type: string;       // MIME type
  size: number;       // 文件大小（字节）
  data: Blob;         // 文件数据
  thumbnail?: string; // 缩略图 base64（仅图片）
  createdAt: number;
  updatedAt: number;
}

export interface FileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDB] 打开数据库失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDB] 数据库已打开');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建场景存储
        if (!db.objectStoreNames.contains(STORES.SCENES)) {
          const sceneStore = db.createObjectStore(STORES.SCENES, { keyPath: 'id' });
          sceneStore.createIndex('name', 'name', { unique: false });
          sceneStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 创建模型存储
        if (!db.objectStoreNames.contains(STORES.MODELS)) {
          const modelStore = db.createObjectStore(STORES.MODELS, { keyPath: 'id' });
          modelStore.createIndex('name', 'name', { unique: false });
          modelStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        console.log('[IndexedDB] 数据库结构已创建');
      };
    });

    return this.initPromise;
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error('数据库未初始化');
    return this.db;
  }

  /**
   * 生成唯一 ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 创建图片缩略图
   */
  private async createThumbnail(file: File, maxSize = 100): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          // 计算缩略图尺寸
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ==================== 场景图片操作 ====================

  /**
   * 保存场景图片
   */
  async saveScene(file: File, name?: string): Promise<StoredFile> {
    const db = await this.ensureDB();
    const id = this.generateId('scene');
    
    // 创建缩略图
    let thumbnail = '';
    if (file.type.startsWith('image/')) {
      thumbnail = await this.createThumbnail(file);
    }

    const storedFile: StoredFile = {
      id,
      name: name || file.name,
      type: file.type,
      size: file.size,
      data: file,
      thumbnail,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SCENES], 'readwrite');
      const store = transaction.objectStore(STORES.SCENES);
      const request = store.add(storedFile);

      request.onsuccess = () => {
        console.log('[IndexedDB] 场景图片已保存:', id);
        resolve(storedFile);
      };
      request.onerror = () => {
        console.error('[IndexedDB] 保存场景图片失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有场景图片元数据
   */
  async getAllScenes(): Promise<FileMetadata[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SCENES], 'readonly');
      const store = transaction.objectStore(STORES.SCENES);
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result as StoredFile[];
        // 返回元数据（不包含 data）
        const metadata = files.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          size: f.size,
          thumbnail: f.thumbnail,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt
        }));
        resolve(metadata);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取场景图片 Blob URL
   */
  async getSceneUrl(id: string): Promise<string | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SCENES], 'readonly');
      const store = transaction.objectStore(STORES.SCENES);
      const request = store.get(id);

      request.onsuccess = () => {
        const file = request.result as StoredFile | undefined;
        if (file?.data) {
          const url = URL.createObjectURL(file.data);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 删除场景图片
   */
  async deleteScene(id: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SCENES], 'readwrite');
      const store = transaction.objectStore(STORES.SCENES);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('[IndexedDB] 场景图片已删除:', id);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== VRM 模型操作 ====================

  /**
   * 保存 VRM 模型
   */
  async saveModel(file: File, name?: string): Promise<StoredFile> {
    const db = await this.ensureDB();
    const id = this.generateId('model');

    const storedFile: StoredFile = {
      id,
      name: name || file.name,
      type: file.type || 'model/gltf-binary',
      size: file.size,
      data: file,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.MODELS], 'readwrite');
      const store = transaction.objectStore(STORES.MODELS);
      const request = store.add(storedFile);

      request.onsuccess = () => {
        console.log('[IndexedDB] VRM 模型已保存:', id);
        resolve(storedFile);
      };
      request.onerror = () => {
        console.error('[IndexedDB] 保存 VRM 模型失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有 VRM 模型元数据
   */
  async getAllModels(): Promise<FileMetadata[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.MODELS], 'readonly');
      const store = transaction.objectStore(STORES.MODELS);
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result as StoredFile[];
        const metadata = files.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          size: f.size,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt
        }));
        resolve(metadata);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取 VRM 模型 Blob URL
   */
  async getModelUrl(id: string): Promise<string | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.MODELS], 'readonly');
      const store = transaction.objectStore(STORES.MODELS);
      const request = store.get(id);

      request.onsuccess = () => {
        const file = request.result as StoredFile | undefined;
        if (file?.data) {
          const url = URL.createObjectURL(file.data);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 删除 VRM 模型
   */
  async deleteModel(id: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.MODELS], 'readwrite');
      const store = transaction.objectStore(STORES.MODELS);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('[IndexedDB] VRM 模型已删除:', id);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 工具方法 ====================

  /**
   * 格式化文件大小
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * 获取存储使用情况
   */
  async getStorageUsage(): Promise<{ scenes: number; models: number; total: number }> {
    const scenes = await this.getAllScenes();
    const models = await this.getAllModels();
    
    const scenesSize = scenes.reduce((acc, s) => acc + s.size, 0);
    const modelsSize = models.reduce((acc, m) => acc + m.size, 0);
    
    return {
      scenes: scenesSize,
      models: modelsSize,
      total: scenesSize + modelsSize
    };
  }

  /**
   * 清空所有数据
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    
    const transaction = db.transaction([STORES.SCENES, STORES.MODELS], 'readwrite');
    
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(STORES.SCENES).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(STORES.MODELS).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);
    
    console.log('[IndexedDB] 所有数据已清空');
  }
}

// 导出单例
export const indexedDBService = new IndexedDBService();
