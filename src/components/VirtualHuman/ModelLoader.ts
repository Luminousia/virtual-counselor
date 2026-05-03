/**
 * VRM模型加载器 - 负责VRM模型异步加载
 * 重构版：从VRMModel.tsx分离
 * 使用 @pixiv/three-vrm v3 API
 */

import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { setNaturalPose } from '../../features/animation/naturalPose';

export interface LoadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface LoadResult {
  vrm: VRM;
  headBone: THREE.Object3D;
}

export class ModelLoader {
  private loader: GLTFLoader;
  private loadPromise: Promise<LoadResult> | null = null;
  private isCancelled: boolean = false;

  constructor() {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  // 将 .gz URL 解压并返回 Blob Object URL
  private async decompressGz(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`下载失败: ${response.status}`);
    const ds = new DecompressionStream('gzip');
    const blob = await new Response(response.body.pipeThrough(ds)).blob();
    return URL.createObjectURL(blob);
  }

  // 加载VRM模型
  async load(url: string, onProgress?: (progress: LoadProgress) => void): Promise<LoadResult> {
    // 取消之前的加载
    this.cancel();

    this.isCancelled = false;
    console.log('[ModelLoader] 开始加载:', url);

    // 若是 gz 压缩包，先在浏览器解压
    let resolvedUrl = url;
    if (url.endsWith('.gz')) {
      console.log('[ModelLoader] 检测到 .gz，正在解压...');
      resolvedUrl = await this.decompressGz(url);
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        resolvedUrl,
        (gltf) => {
          if (this.isCancelled) {
            reject(new Error('加载已取消'));
            return;
          }

          const vrm = gltf.userData.vrm as VRM;
          if (!vrm) {
            reject(new Error('无法解析VRM数据'));
            return;
          }

          // 旋转模型（VRM0兼容）
          VRMUtils.rotateVRM0(vrm);
          
          // 设置自然姿势
          setNaturalPose(vrm);

          // 查找头部骨骼
          const headBone = this.findHeadBone(vrm.scene);
          if (!headBone) {
            console.warn('[ModelLoader] 未找到头部骨骼，使用场景根节点');
          }

          console.log('[ModelLoader] 加载完成');
          resolve({ vrm, headBone: headBone || vrm.scene });
        },
        (progress) => {
          if (progress.total > 0) {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            onProgress?.({ loaded: progress.loaded, total: progress.total, percentage });
          }
        },
        (error) => {
          if (this.isCancelled) {
            console.log('[ModelLoader] 加载已取消');
          } else {
            console.error('[ModelLoader] 加载失败:', error);
          }
          reject(error);
        }
      );
    });
  }

  // 取消加载
  cancel(): void {
    this.isCancelled = true;
    // 注意：VRMLoader不支持直接取消，这里标记状态
    console.log('[ModelLoader] 标记取消加载');
  }

  // 查找头部骨骼
  private findHeadBone(scene: THREE.Object3D): THREE.Object3D | null {
    const requiredBoneNames = ['Head', 'head', 'Neck', 'neck'];
    
    let headBone: THREE.Object3D | null = null;
    
    scene.traverse((object) => {
      if (headBone) return;
      
      if (object instanceof THREE.Bone && requiredBoneNames.includes(object.name)) {
        headBone = object;
      }
    });
    
    return headBone;
  }

  // 加载GLB/VRM贴图
  async loadTexture(url: string): Promise<THREE.Texture> {
    const textureLoader = new THREE.TextureLoader();
    
    return new Promise((resolve, reject) => {
      textureLoader.load(url, resolve, undefined, reject);
    });
  }

  // 清理资源
  dispose(): void {
    this.loadPromise = null;
    console.log('[ModelLoader] 已清理');
  }
}
