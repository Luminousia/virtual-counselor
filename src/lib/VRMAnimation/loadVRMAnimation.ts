/**
 * VRM Animation 加载函数
 * 参考 ChatVRM 实现
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMAnimation } from './VRMAnimation';
import { VRMAnimationLoaderPlugin } from './VRMAnimationLoaderPlugin';

const loader = new GLTFLoader();
loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

export async function loadVRMAnimation(url: string): Promise<VRMAnimation | null> {
  try {
    const gltf = await loader.loadAsync(url);

    const vrmAnimations: VRMAnimation[] = gltf.userData.vrmAnimations;
    const vrmAnimation: VRMAnimation | undefined = vrmAnimations?.[0];

    return vrmAnimation ?? null;
  } catch (error) {
    console.warn('[loadVRMAnimation] 加载动画失败:', error);
    return null;
  }
}
