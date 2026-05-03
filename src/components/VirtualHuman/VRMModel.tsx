/**
 * VRM虚拟人组件 - 3D渲染与交互
 * 包含：模型加载、眨眼、呼吸、口型同步、表情控制
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRM, VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LipSyncResult, BLENDSHAPE_MAP } from '../../utils/lipSyncAnalyzer';
import { setNaturalPose, maintainArmPose } from '../../features/animation/naturalPose';
import './VRMModel.css';

export type EmotionType = 
  | 'neutral' 
  | 'happy' 
  | 'sad' 
  | 'angry' 
  | 'surprised' 
  | 'fearful' 
  | 'disgusted'
  | 'relaxed';

interface VRMModelProps {
  modelUrl: string;
  isSpeaking: boolean;
  volume?: number;
  lipSyncData?: LipSyncResult | null;
  emotion?: EmotionType;
  textType?: 'question' | 'emphasis' | 'greeting' | 'agreement' | 'normal';
  transparent?: boolean; // 是否使用透明背景
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onLoadProgress?: (progress: number) => void;
}

const VRMModel: React.FC<VRMModelProps> = ({
  modelUrl,
  isSpeaking,
  volume = 0.5,
  lipSyncData = null,
  emotion = 'neutral',
  textType = 'normal',
  transparent = false,
  onLoad,
  onError,
  onLoadProgress
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const animationIdRef = useRef<number | null>(null);
  const lookAtTargetRef = useRef<THREE.Object3D | null>(null);  // 视线目标对象
  
  // 动画状态 refs（避免闭包问题）
  const blinkTimeRef = useRef(0);
  const nextBlinkRef = useRef(3 + Math.random() * 4);
  const breathTimeRef = useRef(0);
  
  // 眼球扫视（Saccade）状态 - 参考ChatVRM
  const saccadeTimerRef = useRef(0);
  const saccadeYawRef = useRef(0);    // 水平方向偏移
  const saccadePitchRef = useRef(0);  // 垂直方向偏移
  const nextSaccadeTimeRef = useRef(0.5 + Math.random() * 1.5);  // 下次扫视时间
  
  // 口型和情感状态 refs（用于在渲染循环中访问最新值）
  const lipSyncDataRef = useRef<LipSyncResult | null>(null);
  const isSpeakingRef = useRef(false);
  const emotionRef = useRef<EmotionType>('neutral');
  
  // 缓存找到的有效口型表情名称
  const validExpressionsRef = useRef<Record<string, string>>({});

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 程序化待机动画 - 丰富的肢体动作
  // 咨询师风格：亲切、自然、有活力
  const idleTimeRef = useRef(0);
  
  const updateIdleAnimation = (vrm: VRM, delta: number) => {
    const humanoid = vrm.humanoid;
    if (!humanoid) return;
    
    idleTimeRef.current += delta;
    const t = idleTimeRef.current;
    
    // === 呼吸动画（基础层）===
    // 呼吸周期：约 4 秒
    const breathCycle = Math.sin(t * 1.5) * 0.5 + 0.5; // 0 ~ 1
    // 第二层呼吸，稍微错开相位
    const breathCycle2 = Math.sin(t * 1.5 + 0.5) * 0.5 + 0.5;
    
    // 脊椎呼吸起伏（增大幅度）
    const spine = humanoid.getRawBoneNode('spine');
    if (spine) {
      spine.rotation.x = breathCycle * 0.03;
    }
    
    // 胸部起伏（更明显）
    const chest = humanoid.getRawBoneNode('chest');
    if (chest) {
      chest.rotation.x = breathCycle * 0.04;
    }
    
    // 上胸部
    const upperChest = humanoid.getRawBoneNode('upperChest');
    if (upperChest) {
      upperChest.rotation.x = breathCycle2 * 0.025;
    }
    
    // === 身体重心转移（慢周期）===
    // 模拟站立时自然的重心左右转移（增大幅度）
    const weightShift = Math.sin(t * 0.6) * 0.02;
    const weightShift2 = Math.sin(t * 0.4) * 0.015;
    
    const hips = humanoid.getRawBoneNode('hips');
    if (hips) {
      hips.rotation.z = weightShift;
      hips.rotation.y = weightShift2; // 轻微转动
    }
    
    // === 头部动作（自然微动）===
    const head = humanoid.getRawBoneNode('head');
    if (head) {
      // 非常轻微的前后（几乎不动，只是呼吸带动）
      const headNod = breathCycle * 0.005;
      // 缓慢的左右看（主要动作，像在观察或思考）
      const headTurn = Math.sin(t * 0.15) * 0.025;
      // 轻微的歪头（显得亲切、有兴趣的样子）
      const headTilt = Math.sin(t * 0.12) * 0.02;
      
      head.rotation.x = headNod;
      head.rotation.y = headTurn;
      head.rotation.z = headTilt;
    }
    
    // 颈部配合头部（更自然的延迟跟随）
    const neck = humanoid.getRawBoneNode('neck');
    if (neck) {
      // 颈部的动作比头部小且有延迟
      neck.rotation.x = breathCycle * 0.003;
      neck.rotation.y = Math.sin(t * 0.15 - 0.3) * 0.012; // 轻微延迟跟随头部转向
    }
    
    // === 肩膀动作 ===
    const leftShoulder = humanoid.getRawBoneNode('leftShoulder');
    const rightShoulder = humanoid.getRawBoneNode('rightShoulder');
    
    // 呼吸带动肩膀起伏
    if (leftShoulder) {
      leftShoulder.rotation.z = breathCycle * 0.008;
      leftShoulder.rotation.x = Math.sin(t * 0.7) * 0.005;
    }
    if (rightShoulder) {
      rightShoulder.rotation.z = -breathCycle * 0.008;
      rightShoulder.rotation.x = Math.sin(t * 0.7 + 0.3) * 0.005;
    }
    
    // === 手臂微动（在咨询师姿势基础上添加）===
    // 左上臂轻微摆动
    const leftUpperArm = humanoid.getRawBoneNode('leftUpperArm');
    if (leftUpperArm) {
      // 在基础姿势上添加摆动（增大幅度）
      const armSway = Math.sin(t * 0.5) * 0.04;
      leftUpperArm.rotation.x = 0.3 + armSway; // 基础值 + 摆动
    }
    
    // 右上臂轻微摆动（相位略有不同）
    const rightUpperArm = humanoid.getRawBoneNode('rightUpperArm');
    if (rightUpperArm) {
      const armSway = Math.sin(t * 0.5 + 0.5) * 0.04;
      rightUpperArm.rotation.x = 0.3 + armSway;
    }
    
    // === 手腕/手部微动 ===
    const leftHand = humanoid.getRawBoneNode('leftHand');
    const rightHand = humanoid.getRawBoneNode('rightHand');
    
    if (leftHand) {
      // 手腕轻微转动
      leftHand.rotation.z = Math.sin(t * 0.8) * 0.03;
    }
    if (rightHand) {
      rightHand.rotation.z = Math.sin(t * 0.8 + 0.4) * 0.03;
    }
    
    // === 腿部微动（重心转移配合）===
    const leftUpperLeg = humanoid.getRawBoneNode('leftUpperLeg');
    const rightUpperLeg = humanoid.getRawBoneNode('rightUpperLeg');
    
    if (leftUpperLeg) {
      // 重心转移时腿部微调
      leftUpperLeg.rotation.z = -weightShift * 0.3;
    }
    if (rightUpperLeg) {
      rightUpperLeg.rotation.z = weightShift * 0.3;
    }
  };

  // 同步 props 到 refs
  useEffect(() => {
    lipSyncDataRef.current = lipSyncData;
  }, [lipSyncData]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    emotionRef.current = emotion;
  }, [emotion]);

  // 初始化场景和加载模型
  useEffect(() => {
    if (!containerRef.current) return;

    // effect 每次重新运行时重置卸载标记（清理阶段会把它设为 true，
    // 但新一轮 effect 必须从 false 开始，否则眨眼 setTimeout 全被跳过）
    unmountedRef.current = false;

    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 500;

    console.log('[VRMModel] 初始化, 容器尺寸:', width, 'x', height);

    // 创建场景 - 支持透明背景
    const scene = new THREE.Scene();
    if (!transparent) {
      scene.background = new THREE.Color(0xfffbf7);
    } else {
      scene.background = null; // 透明背景
    }
    sceneRef.current = scene;

    // 创建相机（参考ChatVRM: position(0, 1.3, 1.5)）
    const camera = new THREE.PerspectiveCamera(20, width / height, 0.1, 20);
    camera.position.set(0, 1.3, 1.5);  // 相机高度与头部平齐
    cameraRef.current = camera;
    
    // 创建视线目标对象（参考ChatVRM的AutoLookAt实现）
    // 将视线目标添加到相机上，这样模型会看向相机方向
    const lookAtTarget = new THREE.Object3D();
    camera.add(lookAtTarget);
    lookAtTargetRef.current = lookAtTarget;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      premultipliedAlpha: false 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    if (transparent) {
      renderer.setClearColor(0x000000, 0);
    }
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ============ 日系动漫偶像打光（暖粉均匀风格）============
    // 参考：前方均匀暖白主光 + 左侧柔和补光 + 头顶纯白发丝高光
    //       + 樱花粉天光 / 暖肤地面反射，整体无死角硬阴影

    // 主光 - 正前方偏右上，暖白色（面部充分照亮）
    const keyLight = new THREE.DirectionalLight(0xFFF5EE, 1.5);
    keyLight.position.set(0.4, 1.2, 2.0);
    scene.add(keyLight);

    // 补光 - 左侧前方，暖粉色（填满面部阴影）
    const fillLight = new THREE.DirectionalLight(0xFFDDD8, 0.7);
    fillLight.position.set(-1.2, 0.5, 1.5);
    scene.add(fillLight);

    // 头发高光 - 正上方偏前，纯白（模拟头顶白色反射带）
    const hairLight = new THREE.DirectionalLight(0xFFFFFF, 0.6);
    hairLight.position.set(0, 3, 0.8);
    scene.add(hairLight);

    // 半球光 - 樱花粉天空 / 暖肤地面（背景粉色反弹）
    const hemiLight = new THREE.HemisphereLight(
      0xFFD8E4,  // 天空：樱花粉
      0xEED4C4,  // 地面：暖肤
      0.6
    );
    scene.add(hemiLight);

    // 环境光 - 暖粉白（高强度，消除残余暗角）
    const ambientLight = new THREE.AmbientLight(0xFFECE4, 0.55);
    scene.add(ambientLight);

    // 加载VRM模型
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    console.log('[VRMModel] 开始加载模型:', modelUrl);

    // 用 async IIFE 处理 .gz 解压，因为 useEffect 回调本身不能是 async
    (async () => {
      // 若为 .gz 压缩包，先在浏览器端解压再交给 GLTFLoader
      let resolvedModelUrl = modelUrl;
      if (modelUrl.endsWith('.gz')) {
        try {
          console.log('[VRMModel] 检测到 .gz，正在下载并解压...');
          const resp = await fetch(modelUrl);
          console.log('[VRMModel] 响应状态:', resp.status, resp.headers.get('content-type'));
          if (!resp.ok || !resp.body) throw new Error(`下载模型失败: HTTP ${resp.status}`);
          const ct = resp.headers.get('content-type') || '';
          if (ct.includes('text/html')) throw new Error(`模型文件未部署到CDN (返回了HTML, status=${resp.status})`);
          const ds = new DecompressionStream('gzip');
          const blob = await new Response(resp.body.pipeThrough(ds)).blob();
          console.log('[VRMModel] 解压完成, blob size:', blob.size);
          resolvedModelUrl = URL.createObjectURL(blob);
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          console.error('[VRMModel] 模型预处理失败:', err);
          setError(err.message);
          onError?.(err);
          return;
        }
      }

      loader.load(
        resolvedModelUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          const err = new Error('无法解析VRM数据');
          setError(err.message);
          onError?.(err);
          return;
        }

        console.log('[VRMModel] VRM解析成功');
        
        // 打印可用的表情列表（用于调试口型同步）
        if (vrm.expressionManager) {
          const expressions = vrm.expressionManager.expressions;
          const expressionNames = expressions.map(e => e.expressionName);
          console.log('[VRMModel] 可用表情:', expressionNames);
          
          // 重置缓存的有效表情
          validExpressionsRef.current = {};
        }

        // 旋转模型（VRM0兼容）
        VRMUtils.rotateVRM0(vrm);

        // 添加到场景
        scene.add(vrm.scene);
        vrmRef.current = vrm;
        
        // ============ 调整 SpringBone 参数增加头发飘动 ============
        if (vrm.springBoneManager) {
          console.log('[VRMModel] 检测到 SpringBone，正在调整飘动参数...');
          
          // 遍历所有 SpringBone 关节（joints 是 Set 类型）
          const joints = vrm.springBoneManager.joints;
          if (joints && joints.size > 0) {
            console.log(`[VRMModel] 找到 ${joints.size} 个 SpringBone 关节`);
            
            joints.forEach((joint: any) => {
              // 降低刚度 - 让头发更柔软，飘动更大
              if (joint.settings) {
                const originalStiffness = joint.settings.stiffness;
                const originalGravityPower = joint.settings.gravityPower;
                const originalDragForce = joint.settings.dragForce;
                
                // 降低刚度（原来的 50%），让头发更软
                joint.settings.stiffness = originalStiffness * 0.4;
                // 稍微降低重力，让头发更轻盈
                joint.settings.gravityPower = originalGravityPower * 0.6;
                // 降低阻力，让飘动更持久
                joint.settings.dragForce = originalDragForce * 0.5;
              }
            });
            
            console.log('[VRMModel] SpringBone 参数已调整，头发飘动幅度增加');
          }
        } else {
          console.log('[VRMModel] 未检测到 SpringBone，头发可能不会物理飘动');
        }

        // 调整模型位置
        vrm.scene.position.y = 0;
        vrm.scene.scale.set(1, 1, 1);
        
        // 让模型面朝相机（旋转180度）
        vrm.scene.rotation.y = Math.PI;

        // 遍历模型，禁用裁剪
        vrm.scene.traverse((obj) => {
          obj.frustumCulled = false;
        });

        // 动态调整相机位置，使其与头部平齐（参考ChatVRM的resetCamera）
        const head = vrm.humanoid?.getNormalizedBoneNode('head');
        if (head) {
          const headPos = new THREE.Vector3();
          head.getWorldPosition(headPos);
          
          // 相机Y位置设为头部高度，保持与头部平视
          camera.position.set(0, headPos.y, 1.5);
          // 相机看向头部位置
          camera.lookAt(headPos.x, headPos.y, headPos.z);
          
          console.log('[VRMModel] 相机位置调整到头部高度:', headPos.y);
        }
        
        // 设置模型视线看向相机（参考ChatVRM的AutoLookAt实现）
        if (vrm.lookAt && lookAtTargetRef.current) {
          vrm.lookAt.target = lookAtTargetRef.current;
          console.log('[VRMModel] 设置视线跟随相机');
        }
        
        // 设置咨询师亲和力姿势
        setNaturalPose(vrm);
        console.log('[VRMModel] 已设置咨询师亲和力姿势');
        
        // 使用程序化待机动画
        console.log('[VRMModel] 使用程序化待机动画，角色面向玩家');

        setIsLoaded(true);
        setLoadProgress(100);
        onLoad?.();

        console.log('[VRMModel] 模型加载完成');
      },
      (progress) => {
        if (progress.total > 0) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          setLoadProgress(percent);
          onLoadProgress?.(percent);
        }
      },
      (err) => {
        console.error('[VRMModel] 加载失败:', err);
        const error = err instanceof Error ? err : new Error('加载失败');
        setError(error.message);
        onError?.(error);
      }
    );
    })(); // 结束 async IIFE

    // 渲染循环
    let frameCount = 0;
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Fix 1: 限制 delta 上限，防止切后台/恢复时一帧暴增导致 SpringBone 抖飞
      const rawDelta = clockRef.current.getDelta();
      const delta = Math.min(rawDelta, 0.05); // 最多 50ms / 帧 ≈ 20fps 下限

      try {
        const vrm = vrmRef.current;

        if (vrm) {
          // 1. 表情类（不影响骨骼，在 vrm.update 前后均可）
          updateBlink(vrm, delta);
          updateLipSync(vrm);
          updateEyeSaccade(vrm, delta);

          // 2. vrm.update：humanoid 同步 raw 骨骼 → LookAt → ExpressionManager → SpringBone
          vrm.update(delta);

          // 3. pose/idle 必须在 vrm.update 之后写 raw 骨骼
          // 否则 humanoid.update() 会用 T-pose 覆盖手动设置的姿势
          maintainArmPose(vrm);
          updateIdleAnimation(vrm, delta);

          frameCount++;
          if (frameCount % 120 === 0 && lipSyncDataRef.current && isSpeakingRef.current) {
            console.log('[VRMModel] 口型数据:', lipSyncDataRef.current);
          }
        }

        // Fix 3: render 在 try 内，确保逻辑错误不影响画面输出
        renderer.render(scene, camera);
      } catch (err) {
        console.error('[VRMModel] 渲染帧错误:', err);
        // 出错后仍渲染上一帧画面，不让画面"卡死"
        try { renderer.render(scene, camera); } catch (_) {}
      }
    };
    animate();

    // 窗口大小变化
    const handleResize = () => {
      const newWidth = container.clientWidth || 400;
      const newHeight = container.clientHeight || 500;
      
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // 清理
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }

      // 清理lookAtTarget
      if (lookAtTargetRef.current) {
        camera.remove(lookAtTargetRef.current);
        lookAtTargetRef.current = null;
      }

      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        vrmRef.current.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(m => m.dispose());
            } else {
              mesh.material?.dispose();
            }
          }
        });
      }

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      unmountedRef.current = true;
      console.log('[VRMModel] 资源已清理');
    };
  }, [modelUrl, transparent]);

  // 眨眼状态（帧驱动，无 setTimeout）
  const blinkExpressionRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);
  const blinkActiveRef = useRef(false);     // 是否正在执行眨眼动画
  const blinkProgressRef = useRef(0);       // 0→1 覆盖整个眨眼过程
  const pendingDoubleBlinkRef = useRef(false); // 是否需要连眨第二次

  // 自动眨眼（帧驱动，平滑曲线，无 setTimeout）
  // 动画曲线：0-35% 闭眼，35-65% 保持闭合，65-100% 睁开
  const BLINK_DURATION = 0.22; // 单次眨眼总时长（秒）
  
  const updateBlink = (vrm: VRM, delta: number) => {
    const expressionManager = vrm.expressionManager;
    if (!expressionManager) return;

    // 查找眨眼表情（只查找一次）
    if (blinkExpressionRef.current === null) {
      const blinkNames = ['Blink', 'blink', 'Blink_L', 'Blink_R'];
      for (const name of blinkNames) {
        if (expressionManager.getExpression(name)) {
          blinkExpressionRef.current = name;
          console.log(`[Blink] ✓ 找到眨眼表情: ${name}`);
          break;
        }
      }
      if (!blinkExpressionRef.current) {
        blinkExpressionRef.current = '__NOT_FOUND__';
        console.warn('[Blink] ✗ 未找到眨眼表情');
      }
    }

    const blinkName = blinkExpressionRef.current;
    if (!blinkName || blinkName === '__NOT_FOUND__') return;

    if (blinkActiveRef.current) {
      // 推进眨眼动画
      blinkProgressRef.current = Math.min(1, blinkProgressRef.current + delta / BLINK_DURATION);
      const p = blinkProgressRef.current;

      // 分段曲线：快闭（35%）→ 停留（30%）→ 慢开（35%）
      let value: number;
      if (p < 0.35) {
        value = p / 0.35;                         // 线性闭合
      } else if (p < 0.65) {
        value = 1;                                // 闭合保持
      } else {
        value = 1 - (p - 0.65) / 0.35;           // 线性睁开
      }

      expressionManager.setValue(blinkName as VRMExpressionPresetName, Math.max(0, value));

      // 动画完成
      if (p >= 1) {
        blinkActiveRef.current = false;
        blinkProgressRef.current = 0;
        expressionManager.setValue(blinkName as VRMExpressionPresetName, 0);

        if (pendingDoubleBlinkRef.current) {
          // 连眨第二次：120ms 后再触发
          pendingDoubleBlinkRef.current = false;
          blinkTimeRef.current = -(0.12);
          nextBlinkRef.current = 0;
        } else {
          // 正常间隔 2.5-5s
          blinkTimeRef.current = 0;
          nextBlinkRef.current = 2.5 + Math.random() * 2.5;
        }
      }
    } else {
      // 等待下次眨眼
      blinkTimeRef.current += delta;
      if (blinkTimeRef.current >= nextBlinkRef.current) {
        blinkActiveRef.current = true;
        blinkProgressRef.current = 0;
        // 20% 概率连眨两次
        pendingDoubleBlinkRef.current = Math.random() < 0.2;
      }
    }
  };

  // 眼球扫视动画（Saccade）- 通过移动lookAt目标实现
  // 让眼睛自然地小幅度转动，看起来更生动
  // 减小幅度，让角色主要看向玩家
  const SACCADE_RADIUS = 0.05;  // 扫视范围（减小，让视线更集中）
  const SACCADE_MIN_INTERVAL = 1.5;  // 最小间隔（增加，减少扫视频率）
  
  const updateEyeSaccade = (vrm: VRM, delta: number) => {
    // 只在有lookAt目标时才进行扫视
    if (!vrm.lookAt || !lookAtTargetRef.current) return;
    
    saccadeTimerRef.current += delta;
    
    // 随机触发新的扫视
    if (saccadeTimerRef.current >= nextSaccadeTimeRef.current) {
      // 生成新的扫视方向（小幅度偏移，主要看向正前方）
      // 70% 的概率回到中心，30% 的概率小幅偏移
      if (Math.random() < 0.7) {
        saccadeYawRef.current = 0;
        saccadePitchRef.current = 0;
      } else {
        saccadeYawRef.current = (Math.random() * 2 - 1) * SACCADE_RADIUS;
        saccadePitchRef.current = (Math.random() * 2 - 1) * SACCADE_RADIUS * 0.5;
      }
      saccadeTimerRef.current = 0;
      nextSaccadeTimeRef.current = SACCADE_MIN_INTERVAL + Math.random() * 2;
    }
    
    // 平滑移动lookAt目标位置
    const target = lookAtTargetRef.current;
    const smoothFactor = 0.08;  // 稍快的平滑速度
    
    // 目标位置（基础位置 + 扫视偏移）
    const targetX = saccadeYawRef.current;
    const targetY = saccadePitchRef.current;
    
    // 平滑过渡
    target.position.x += (targetX - target.position.x) * smoothFactor;
    target.position.y += (targetY - target.position.y) * smoothFactor;
  };

  // 调试计数器
  const lipSyncDebugCountRef = useRef(0);

  // 口型同步：用 A/E/I/O/U 全部五个元音驱动对应 VRM blendshape
  const updateLipSync = (vrm: VRM) => {
    const expressionManager = vrm.expressionManager;
    if (!expressionManager) return;

    const lipSync = lipSyncDataRef.current;
    const speaking = isSpeakingRef.current;
    const active = speaking && lipSync && lipSync.volume > 0.02;

    lipSyncDebugCountRef.current++;
    const shouldLog = lipSyncDebugCountRef.current % 120 === 0;

    // 首次初始化：验证哪些 VRM blendshape 实际存在
    if (!validExpressionsRef.current['_init']) {
      validExpressionsRef.current['_init'] = 'done';
      const available = new Set(expressionManager.expressions.map(e => e.expressionName));
      console.log('[LipSync] 可用口型表情:', [...available]);

      // 为每个元音记录实际有效的名称
      for (const [vowel, vrmName] of Object.entries(BLENDSHAPE_MAP)) {
        // BLENDSHAPE_MAP: A→aa, E→ee, I→ih, O→oh, U→ou
        if (available.has(vrmName)) {
          validExpressionsRef.current[vowel] = vrmName;
        } else {
          // 兜底：尝试大写（VRM 0.x 有时不转换）
          const upper = vowel; // 'A','E','I','O','U'
          if (available.has(upper)) {
            validExpressionsRef.current[vowel] = upper;
          }
        }
      }
      console.log('[LipSync] 有效元音映射:', { ...validExpressionsRef.current });
    }

    // 逐元音更新 blendshape
    // 上限压低：aa(A) 主嘴型 ≤ 0.3，其余 ≤ 0.2，避免张嘴过大
    const VOWEL_CAP: Record<string, number> = { A: 0.3, E: 0.2, I: 0.2, O: 0.2, U: 0.2 };
    for (const [vowel, vrmName] of Object.entries(BLENDSHAPE_MAP)) {
      const actualName = validExpressionsRef.current[vowel];
      if (!actualName) continue;

      const cap = VOWEL_CAP[vowel] ?? 0.2;
      const targetWeight = active
        ? Math.min((lipSync as LipSyncResult)[vowel as keyof LipSyncResult] as number, cap)
        : 0;

      const currentWeight = expressionManager.getValue(actualName as VRMExpressionPresetName) ?? 0;
      // 张嘴稍快、闭嘴略慢，动作更柔和
      const smoothSpeed = targetWeight > currentWeight ? 0.3 : 0.18;
      const newWeight = currentWeight + (targetWeight - currentWeight) * smoothSpeed;
      expressionManager.setValue(actualName as VRMExpressionPresetName, newWeight);
    }

    if (shouldLog && speaking) {
      console.log('[LipSync]', { vol: lipSync?.volume?.toFixed(3), A: lipSync?.A?.toFixed(3), E: lipSync?.E?.toFixed(3) });
    }
  };

  // 表情控制（当emotion prop变化时触发）
  useEffect(() => {
    const vrm = vrmRef.current;
    if (!vrm || !vrm.expressionManager) return;

    const expressionManager = vrm.expressionManager;
    
    // 情感到表情的映射（VRM 1.0 preset names + VRM 0.x 转换后的名称）
    const emotionToExpression: Record<EmotionType, string[]> = {
      neutral: ['neutral', 'Neutral'],
      happy:    ['happy', 'joy', 'Joy', 'Fcl_ALL_Joy'],
      sad:      ['sad', 'sorrow', 'Sorrow', 'Fcl_ALL_Sorrow'],
      angry:    ['angry', 'Angry', 'Fcl_ALL_Angry'],
      surprised:['surprised', 'Surprised', 'Fcl_ALL_Surprised'],
      fearful:  ['fearful', 'scared', 'Scared'],
      disgusted:['disgusted'],
      relaxed:  ['relaxed', 'fun', 'Fun'],
    };

    const allNames = Object.values(emotionToExpression).flat();

    // 先重置所有情感表情为 0
    allNames.forEach(name => {
      if (expressionManager.getExpression(name as VRMExpressionPresetName)) {
        expressionManager.setValue(name as VRMExpressionPresetName, 0);
      }
    });

    // neutral = 模型默认状态，重置即可，不主动 setValue
    // 原因：neutral 表情常带 overrideBlink:block，应用后眨眼被永久屏蔽
    if (emotion === 'neutral') return;

    const targetNames = emotionToExpression[emotion] ?? [];

    // 应用目标表情，强度 0.65（避免 happy 眯眼过强看起来像闭眼）
    let applied = false;
    for (const name of targetNames) {
      if (expressionManager.getExpression(name as VRMExpressionPresetName)) {
        // 0.15：仅轻微眼角上扬暗示，不压低眼睑，保持参考图的含蓄开朗感
        expressionManager.setValue(name as VRMExpressionPresetName, 0.15);
        console.log('[VRMModel] 应用表情:', name, '强度: 0.15');
        applied = true;
        break;
      }
    }

    if (!applied) {
      const available = expressionManager.expressions.map(e => e.expressionName);
      console.warn('[VRMModel] 未找到匹配表情，emotion:', emotion, '可用列表:', available);
    }
  }, [emotion]);

  return (
    <div 
      ref={containerRef}
      className="vrm-container" 
      style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%', 
        minHeight: '400px',
        minWidth: '300px',
        background: transparent ? 'transparent' : '#fffbf7'
      }}
    >
      {/* 加载中覆盖层：transparent 模式下透明背景，保持场景可见 */}
      {!isLoaded && !error && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: transparent ? 'rgba(0,0,0,0.2)' : 'linear-gradient(135deg, #fef9f3 0%, #fff5f8 100%)'
        }}>
          <div className="vrm-loading-spinner" />
          <div className="vrm-loading-text" style={{ color: transparent ? '#fff' : undefined }}>
            {loadProgress > 0 ? `虚拟人加载中... ${loadProgress}%` : '正在初始化...'}
          </div>
          {loadProgress > 0 && (
            <div className="vrm-loading-progress">
              <div className="vrm-loading-progress-bar" style={{ width: `${loadProgress}%` }} />
            </div>
          )}
        </div>
      )}
      {/* 错误状态：transparent 模式下不遮挡场景 */}
      {error && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '8px 16px',
          color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span>⚠️</span>
          <span>模型加载失败</span>
          <button onClick={() => window.location.reload()} style={{
            marginLeft: 8, padding: '2px 8px', borderRadius: 4, border: 'none',
            background: '#e88bb5', color: '#fff', cursor: 'pointer', fontSize: 12
          }}>重试</button>
        </div>
      )}
    </div>
  );
};

export default VRMModel;
