import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";

/**
 * 程序化的待机动画（呼吸、身体摇摆、头部微动等）
 * 增强版：让数字人看起来更有生命力
 */
export class IdleAnimation {
  private _vrm: VRM;
  private _time: number = 0;
  
  // 初始姿态缓存
  private _initialHipsPosition: THREE.Vector3 = new THREE.Vector3();
  private _initialHipsRotation: THREE.Euler = new THREE.Euler();
  private _initialSpineRotation: THREE.Euler = new THREE.Euler();
  private _initialChestRotation: THREE.Euler = new THREE.Euler();
  private _initialNeckRotation: THREE.Euler = new THREE.Euler();
  private _initialHeadRotation: THREE.Euler = new THREE.Euler();
  private _initialLeftShoulderRotation: THREE.Euler = new THREE.Euler();
  private _initialRightShoulderRotation: THREE.Euler = new THREE.Euler();
  
  // 随机偏移（让动画不那么机械）
  private _phaseOffset: number = Math.random() * Math.PI * 2;
  
  // 动画参数（可调节）
  private _params = {
    // 呼吸
    breathSpeed: 1.8,           // 呼吸频率（次/秒 * 2π）
    breathAmplitude: 0.006,     // 呼吸幅度
    chestBreathAmplitude: 0.012, // 胸部呼吸幅度
    
    // 身体摇摆（重心转移）
    swaySpeed: 0.4,             // 摇摆频率
    swayAmplitude: 0.008,       // 左右摇摆幅度
    swayForwardAmplitude: 0.003, // 前后摇摆幅度
    
    // 头部微动（增强以触发头发物理）
    headSwaySpeed: 0.25,        // 头部左右晃动频率
    headSwayAmplitude: 0.02,    // 头部左右晃动幅度（增加）
    headNodSpeed: 0.3,          // 头部点头频率
    headNodAmplitude: 0.012,    // 头部点头幅度（增加）
    headTiltSpeed: 0.18,        // 头部倾斜频率
    headTiltAmplitude: 0.01,    // 头部倾斜幅度（增加）
    
    // 肩膀微动
    shoulderSpeed: 0.35,        // 肩膀运动频率
    shoulderAmplitude: 0.004,   // 肩膀运动幅度
    
    // 微风效果（触发头发 SpringBone）
    windEnabled: true,          // 是否启用微风
    windSpeed: 0.8,             // 风的频率
    windAmplitude: 0.003,       // 风的强度（头部额外摆动）
  };

  constructor(vrm: VRM) {
    this._vrm = vrm;
    this.init();
  }

  private init() {
    const humanoid = this._vrm.humanoid;
    if (!humanoid) return;
    
    // 保存所有需要动画的骨骼初始姿态
    const hipsNode = humanoid.getNormalizedBoneNode("hips");
    const spineNode = humanoid.getNormalizedBoneNode("spine");
    const chestNode = humanoid.getNormalizedBoneNode("chest");
    const neckNode = humanoid.getNormalizedBoneNode("neck");
    const headNode = humanoid.getNormalizedBoneNode("head");
    const leftShoulderNode = humanoid.getNormalizedBoneNode("leftShoulder");
    const rightShoulderNode = humanoid.getNormalizedBoneNode("rightShoulder");

    if (hipsNode) {
      this._initialHipsPosition.copy(hipsNode.position);
      this._initialHipsRotation.copy(hipsNode.rotation);
    }
    if (spineNode) {
      this._initialSpineRotation.copy(spineNode.rotation);
    }
    if (chestNode) {
      this._initialChestRotation.copy(chestNode.rotation);
    }
    if (neckNode) {
      this._initialNeckRotation.copy(neckNode.rotation);
    }
    if (headNode) {
      this._initialHeadRotation.copy(headNode.rotation);
    }
    if (leftShoulderNode) {
      this._initialLeftShoulderRotation.copy(leftShoulderNode.rotation);
    }
    if (rightShoulderNode) {
      this._initialRightShoulderRotation.copy(rightShoulderNode.rotation);
    }
    
    console.log('[IdleAnimation] 初始化完成');
  }

  /**
   * 更新待机动画
   * @param delta 帧间隔时间（秒）
   */
  public update(delta: number) {
    this._time += delta;
    const t = this._time;
    const p = this._params;
    const offset = this._phaseOffset;

    const humanoid = this._vrm.humanoid;
    if (!humanoid) return;

    const hipsNode = humanoid.getNormalizedBoneNode("hips");
    const spineNode = humanoid.getNormalizedBoneNode("spine");
    const chestNode = humanoid.getNormalizedBoneNode("chest");
    const neckNode = humanoid.getNormalizedBoneNode("neck");
    const headNode = humanoid.getNormalizedBoneNode("head");
    const leftShoulderNode = humanoid.getNormalizedBoneNode("leftShoulder");
    const rightShoulderNode = humanoid.getNormalizedBoneNode("rightShoulder");

    // ============ 呼吸动画 ============
    // 呼吸周期（使用正弦波模拟）
    const breathPhase = Math.sin(t * p.breathSpeed + offset);
    const breathPhaseDelayed = Math.sin(t * p.breathSpeed + offset + 0.3);
    
    // 髋部：轻微上下移动（整体呼吸起伏）
    if (hipsNode) {
      const breathY = breathPhase * p.breathAmplitude;
      hipsNode.position.y = this._initialHipsPosition.y + breathY;
    }
    
    // 脊椎：轻微前倾（呼吸时胸部扩张）
    if (spineNode) {
      const spineBreath = breathPhaseDelayed * p.breathAmplitude * 0.8;
      spineNode.rotation.x = this._initialSpineRotation.x - spineBreath;
    }
    
    // 胸部：更明显的呼吸效果
    if (chestNode) {
      const chestBreath = breathPhase * p.chestBreathAmplitude;
      chestNode.rotation.x = this._initialChestRotation.x - chestBreath;
    }

    // ============ 身体摇摆（重心转移）============
    // 使用多个不同频率的正弦波叠加，让动作更自然
    const sway1 = Math.sin(t * p.swaySpeed + offset);
    const sway2 = Math.sin(t * p.swaySpeed * 0.7 + offset + 1.5);
    const combinedSway = (sway1 * 0.7 + sway2 * 0.3);
    
    if (hipsNode) {
      // 左右摇摆
      const swayZ = combinedSway * p.swayAmplitude;
      hipsNode.rotation.z = this._initialHipsRotation.z + swayZ;
      
      // 轻微前后摇摆
      const swayForward = Math.sin(t * p.swaySpeed * 0.5 + offset + 2) * p.swayForwardAmplitude;
      hipsNode.rotation.x = this._initialHipsRotation.x + swayForward;
    }

    // ============ 头部微动 ============
    // 头部动作使用更复杂的波形，模拟人自然的小动作
    if (neckNode) {
      // 颈部轻微转动（跟随身体摇摆，但有延迟）
      const neckSway = Math.sin(t * p.headSwaySpeed * 1.2 + offset) * p.headSwayAmplitude * 0.4;
      neckNode.rotation.y = this._initialNeckRotation.y + neckSway;
      
      // 颈部轻微点头
      const neckNod = Math.sin(t * p.headNodSpeed * 0.8 + offset + 1) * p.headNodAmplitude * 0.3;
      neckNode.rotation.x = this._initialNeckRotation.x + neckNod;
    }

    if (headNode) {
      // 头部左右转动（好奇地看周围）
      const headYaw = Math.sin(t * p.headSwaySpeed + offset) * p.headSwayAmplitude;
      // 添加随机性：使用另一个频率叠加
      const headYaw2 = Math.sin(t * p.headSwaySpeed * 1.7 + offset + 3) * p.headSwayAmplitude * 0.3;
      
      // 微风效果：添加更高频的小幅度摆动，触发头发物理
      let windEffect = 0;
      if (p.windEnabled) {
        // 使用多个频率叠加模拟不规则的风
        windEffect = Math.sin(t * p.windSpeed * 3 + offset) * p.windAmplitude
                   + Math.sin(t * p.windSpeed * 5.3 + offset + 1.2) * p.windAmplitude * 0.6
                   + Math.sin(t * p.windSpeed * 7.1 + offset + 2.5) * p.windAmplitude * 0.3;
      }
      
      headNode.rotation.y = this._initialHeadRotation.y + headYaw + headYaw2 + windEffect;
      
      // 头部点头（思考的样子）
      const headPitch = Math.sin(t * p.headNodSpeed + offset + 0.5) * p.headNodAmplitude;
      // 微风也影响前后方向
      const windPitch = p.windEnabled ? Math.sin(t * p.windSpeed * 4.2 + offset + 0.8) * p.windAmplitude * 0.5 : 0;
      headNode.rotation.x = this._initialHeadRotation.x + headPitch + windPitch;
      
      // 头部倾斜（可爱的歪头动作）
      const headTilt = Math.sin(t * p.headTiltSpeed + offset + 2) * p.headTiltAmplitude;
      headNode.rotation.z = this._initialHeadRotation.z + headTilt;
    }

    // ============ 肩膀微动 ============
    // 左右肩膀反向运动，模拟轻微的呼吸和放松
    if (leftShoulderNode) {
      const shoulderBreath = breathPhase * p.shoulderAmplitude;
      const shoulderSway = Math.sin(t * p.shoulderSpeed + offset) * p.shoulderAmplitude * 0.5;
      leftShoulderNode.rotation.z = this._initialLeftShoulderRotation.z + shoulderBreath + shoulderSway;
    }
    
    if (rightShoulderNode) {
      const shoulderBreath = breathPhase * p.shoulderAmplitude;
      const shoulderSway = Math.sin(t * p.shoulderSpeed + offset + Math.PI) * p.shoulderAmplitude * 0.5;
      rightShoulderNode.rotation.z = this._initialRightShoulderRotation.z - shoulderBreath - shoulderSway;
    }
  }

  /**
   * 设置动画参数
   */
  public setParams(params: Partial<typeof this._params>) {
    this._params = { ...this._params, ...params };
  }

  /**
   * 获取当前动画参数
   */
  public getParams() {
    return { ...this._params };
  }

  /**
   * 重置动画状态
   */
  public reset() {
    this._time = 0;
    this._phaseOffset = Math.random() * Math.PI * 2;
    
    const humanoid = this._vrm.humanoid;
    if (!humanoid) return;

    const hipsNode = humanoid.getNormalizedBoneNode("hips");
    const spineNode = humanoid.getNormalizedBoneNode("spine");
    const chestNode = humanoid.getNormalizedBoneNode("chest");
    const neckNode = humanoid.getNormalizedBoneNode("neck");
    const headNode = humanoid.getNormalizedBoneNode("head");
    const leftShoulderNode = humanoid.getNormalizedBoneNode("leftShoulder");
    const rightShoulderNode = humanoid.getNormalizedBoneNode("rightShoulder");

    if (hipsNode) {
      hipsNode.position.copy(this._initialHipsPosition);
      hipsNode.rotation.copy(this._initialHipsRotation);
    }
    if (spineNode) {
      spineNode.rotation.copy(this._initialSpineRotation);
    }
    if (chestNode) {
      chestNode.rotation.copy(this._initialChestRotation);
    }
    if (neckNode) {
      neckNode.rotation.copy(this._initialNeckRotation);
    }
    if (headNode) {
      headNode.rotation.copy(this._initialHeadRotation);
    }
    if (leftShoulderNode) {
      leftShoulderNode.rotation.copy(this._initialLeftShoulderRotation);
    }
    if (rightShoulderNode) {
      rightShoulderNode.rotation.copy(this._initialRightShoulderRotation);
    }
  }
}
