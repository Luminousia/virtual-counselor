/**
 * VRM场景渲染器 - 负责Three.js场景管理
 * 重构版：从VRMModel.tsx分离
 */

import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';

export interface SceneConfig {
  backgroundColor: number;
  fogColor: number | null;
  fogNear: number;
  fogFar: number;
}

export class SceneRenderer {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private animationId: number | null = null;
  
  // 光照
  private directionalLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private topLight: THREE.DirectionalLight | null = null;
  
  // 配置
  private config: SceneConfig;
  private isDisposed: boolean = false;

  constructor(container: HTMLElement, config?: Partial<SceneConfig>) {
    this.config = {
      backgroundColor: 0xfef9f3,
      fogColor: null,
      fogNear: 0.1,
      fogFar: 100,
      ...config
    };

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.config.backgroundColor);

    // 添加雾效果（可选）
    if (this.config.fogColor !== null) {
      this.scene.fog = new THREE.Fog(
        this.config.fogColor,
        this.config.fogNear,
        this.config.fogFar
      );
    }

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    });
    
    // 确保容器有尺寸，否则使用默认值
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 500;
    
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    
    console.log('[SceneRenderer] 渲染器尺寸:', width, 'x', height);

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      20.0,
      width / height,
      0.1,
      20.0
    );
    this.camera.position.set(0, 1.4, 1.6);

    // 创建时钟
    this.clock = new THREE.Clock();
    this.clock.start();

    // 添加光照
    this.setupLighting();

    // 窗口大小变化
    this.setupResizeHandler(container);

    console.log('[SceneRenderer] 初始化完成');
  }

  // 设置光照
  private setupLighting(): void {
    // 主方向光
    this.directionalLight = new THREE.DirectionalLight(0xfff0f5, 1.2);
    this.directionalLight.position.set(1.0, 1.0, 1.0).normalize();
    this.scene.add(this.directionalLight);

    // 环境光
    this.ambientLight = new THREE.AmbientLight(0xfff5f8, 0.85);
    this.scene.add(this.ambientLight);

    // 补光
    this.fillLight = new THREE.DirectionalLight(0xfff0f5, 0.4);
    this.fillLight.position.set(-0.8, 0.5, 0.8).normalize();
    this.scene.add(this.fillLight);

    // 顶部光
    this.topLight = new THREE.DirectionalLight(0xfff8fa, 0.3);
    this.topLight.position.set(0, 1, 0).normalize();
    this.scene.add(this.topLight);
  }

  // 设置窗口大小变化监听
  private setupResizeHandler(container: HTMLElement): void {
    const handleResize = () => {
      if (this.isDisposed) return;
      
      const width = container.clientWidth || 400;
      const height = container.clientHeight || 600;
      
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(width, height);
      
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);
  }

  // 启动渲染循环
  startRenderLoop(renderCallback?: (delta: number) => void): void {
    const animate = () => {
      if (this.isDisposed) return;
      
      this.animationId = requestAnimationFrame(animate);
      
      const delta = this.clock.getDelta();
      
      // 回调渲染函数
      renderCallback?.(delta);
      
      // 执行渲染
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  // 停止渲染循环
  stopRenderLoop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // 添加VRM模型到场景
  addVRM(vrm: VRM): void {
    vrm.scene.name = 'VRMRoot';
    vrm.scene.position.set(0, 0, 0);
    
    // 禁用视锥剔除
    vrm.scene.traverse((obj: THREE.Object3D) => {
      obj.frustumCulled = false;
    });
    
    this.scene.add(vrm.scene);
  }

  // 设置背景颜色
  setBackgroundColor(color: number): void {
    this.scene.background = new THREE.Color(color);
  }

  // 设置背景图片
  async setBackgroundImage(url: string): Promise<void> {
    const loader = new THREE.TextureLoader();
    
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.mapping = THREE.EquirectangularReflectionMapping;
          this.scene.background = texture;
          resolve();
        },
        undefined,
        reject
      );
    });
  }

  // 设置光照强度
  setLightIntensity(intensity: number): void {
    if (this.directionalLight) {
      this.directionalLight.intensity = intensity * 1.2;
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = intensity * 0.85;
    }
  }

  // 设置光照颜色
  setLightColor(color: number): void {
    if (this.directionalLight) {
      this.directionalLight.color.setHex(color);
    }
  }

  // 重置相机位置
  resetCameraPosition(headNode: THREE.Object3D): void {
    const headWPos = headNode.getWorldPosition(new THREE.Vector3());
    this.camera.position.set(
      this.camera.position.x,
      headWPos.y,
      this.camera.position.z
    );
    this.camera.lookAt(headWPos.x, headWPos.y, headWPos.z);
  }

  // 获取场景
  getScene(): THREE.Scene {
    return this.scene;
  }

  // 获取相机
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  // 获取渲染器
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  // 获取时钟
  getClock(): THREE.Clock {
    return this.clock;
  }

  // 截图
  takeScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  // 销毁资源
  dispose(): void {
    this.isDisposed = true;
    this.stopRenderLoop();

    // 清理渲染器
    if (this.renderer) {
      this.renderer.dispose();
      // 注意：不移除domElement，由父组件管理
    }

    // 清理光照
    this.directionalLight?.dispose();
    this.ambientLight?.dispose();
    this.fillLight?.dispose();
    this.topLight?.dispose();

    console.log('[SceneRenderer] 资源已清理');
  }
}
