/**
 * VRM动画管理器 - 负责动画循环和状态管理
 * 重构版：从VRMModel.tsx分离
 */

import { VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { LipSyncResult } from '../../utils/lipSyncAnalyzer';

export type EmotionType = 
  | 'neutral' 
  | 'happy' 
  | 'sad' 
  | 'angry' 
  | 'surprised' 
  | 'fearful' 
  | 'disgusted'
  | 'relaxed';

export interface AnimationState {
  emotion: EmotionType;
  textType: 'question' | 'emphasis' | 'greeting' | 'agreement' | 'normal';
  lipSyncData: LipSyncResult | null;
  isSpeaking: boolean;
}

export interface EmotionConfig {
  neutral: string[];
  happy: string[];
  sad: string[];
  angry: string[];
  surprised: string[];
  fearful: string[];
  disgusted: string[];
  relaxed: string[];
}

export class AnimationManager {
  private vrm: VRM | null = null;
  private animationState: AnimationState;
  
  // 表情配置
  private emotionConfig: EmotionConfig = {
    neutral: ['neutral'],
    happy: ['joy', 'happy'],
    sad: ['sorrow', 'sad'],
    angry: ['angry', 'frustrated'],
    surprised: ['surprised'],
    fearful: ['fearful', 'frightened'],
    disgusted: ['disgusted'],
    relaxed: ['relaxed', 'calm']
  };

  // 当前混合形状权重
  private currentWeights: Map<string, number> = new Map();
  private targetWeights: Map<string, number> = new Map();
  private blendSpeed: number = 10.0;

  constructor() {
    this.animationState = {
      emotion: 'neutral',
      textType: 'normal',
      lipSyncData: null,
      isSpeaking: false
    };
  }

  // 绑定VRM模型
  bindVRM(vrm: VRM): void {
    this.vrm = vrm;
    this.resetAllExpressions();
    console.log('[AnimationManager] VRM已绑定');
  }

  // 解绑VRM模型
  unbindVRM(): void {
    this.vrm = null;
    this.currentWeights.clear();
    this.targetWeights.clear();
  }

  // 设置情感状态
  setEmotion(emotion: EmotionType): void {
    this.animationState.emotion = emotion;
    this.updateExpressionWeights();
    console.log(`[AnimationManager] 情感切换: ${emotion}`);
  }

  // 设置文本类型
  setTextType(textType: AnimationState['textType']): void {
    this.animationState.textType = textType;
  }

  // 设置说话状态
  setSpeaking(isSpeaking: boolean): void {
    this.animationState.isSpeaking = isSpeaking;
  }

  // 设置口型数据
  setLipSyncData(data: LipSyncResult | null): void {
    this.animationState.lipSyncData = data;
  }

  // 设置自定义表情
  setCustomExpression(expressions: Record<string, number>): void {
    if (!this.vrm) return;

    // @pixiv/three-vrm v3 使用 expressionManager
    const blendShapeProxy = (this.vrm as any).expressionManager || (this.vrm as any).blendShapeProxy;
    if (!blendShapeProxy) return;

    // 应用自定义表情
    Object.entries(expressions).forEach(([name, value]) => {
      const getValue = blendShapeProxy.getValue;
      const setValue = blendShapeProxy.setValue;
      
      if (getValue && typeof getValue === 'function') {
        const currentValue = getValue.call(blendShapeProxy, name);
        if (currentValue !== undefined && setValue && typeof setValue === 'function') {
          setValue.call(blendShapeProxy, name, Math.max(0, Math.min(1, value)));
        }
      }
    });
  }

  // 重置所有表情
  resetAllExpressions(): void {
    if (!this.vrm) return;

    const blendShapeProxy = (this.vrm as any).expressionManager || (this.vrm as any).blendShapeProxy;
    if (!blendShapeProxy) return;

    // 重置所有BlendShape
    const clear = blendShapeProxy.clear;
    if (clear && typeof clear === 'function') {
      clear.call(blendShapeProxy);
    }
    this.currentWeights.clear();
    this.targetWeights.clear();

    console.log('[AnimationManager] 表情已重置');
  }

  // 更新表情权重
  private updateExpressionWeights(): void {
    if (!this.vrm) return;

    const emotion = this.animationState.emotion;
    const expressions = this.emotionConfig[emotion] || this.emotionConfig.neutral;

    // 设置目标权重
    this.targetWeights.clear();
    expressions.forEach((expr, index) => {
      // 第一个表情权重最高，后续递减
      const weight = 1.0 - (index * 0.15);
      this.targetWeights.set(expr, Math.max(0, weight));
    });
  }

  // 执行眨眼
  blink(): void {
    if (!this.vrm) return;

    const blendShapeProxy = (this.vrm as any).expressionManager || (this.vrm as any).blendShapeProxy;
    if (!blendShapeProxy) return;

    const getValue = blendShapeProxy.getValue?.bind(blendShapeProxy);
    const setValue = blendShapeProxy.setValue?.bind(blendShapeProxy);

    if (!getValue || !setValue) return;

    const blinkValue = getValue('blink') ?? 
                       getValue('blink_L') ?? 
                       getValue('blink_R') ?? 0;

    // 简单的眨眼动画
    const blink = () => {
      setValue('blink', 1);
      setTimeout(() => setValue('blink', 0), 150);
      setTimeout(() => setValue('blink', 1), 200);
      setTimeout(() => setValue('blink', 0), 350);
    };

    if (blinkValue < 0.1) {
      blink();
    }
  }

  // 执行问候表情
  performGreeting(): void {
    this.setEmotion('happy');
    
    setTimeout(() => {
      this.setEmotion('neutral');
    }, 1500);
  }

  // 执行点头
  performNod(): void {
    if (!this.vrm) return;

    const scene = this.vrm.scene;
    const originalY = scene.position.y;

    // 点头动画
    const nodDown = () => {
      scene.position.y = originalY - 0.05;
    };
    const nodUp = () => {
      scene.position.y = originalY;
    };

    nodDown();
    setTimeout(nodUp, 300);
    setTimeout(nodDown, 600);
    setTimeout(nodUp, 900);
  }

  // 更新动画（每帧调用）
  update(delta: number): void {
    if (!this.vrm) return;

    // ★★★ 关键：调用VRM的update方法来更新SpringBone等 ★★★
    this.vrm.update(delta);

    const blendShapeProxy = (this.vrm as any).expressionManager || (this.vrm as any).blendShapeProxy;
    if (!blendShapeProxy) return;

    const getValue = blendShapeProxy.getValue?.bind(blendShapeProxy);
    const setValue = blendShapeProxy.setValue?.bind(blendShapeProxy);

    if (!getValue || !setValue) return;

    // 平滑过渡表情权重
    this.targetWeights.forEach((targetWeight, expression) => {
      const currentWeight = this.currentWeights.get(expression) || 0;
      const newWeight = THREE.MathUtils.lerp(
        currentWeight, 
        targetWeight, 
        delta * this.blendSpeed
      );
      
      this.currentWeights.set(expression, newWeight);
      
      if (getValue(expression) !== undefined) {
        setValue(expression, newWeight);
      }
    });

    // 应用口型同步
    this.applyLipSync();

    // 随机眨眼（每3-6秒）
    this.randomBlink(delta);
  }

  // 应用口型同步
  private applyLipSync(): void {
    if (!this.vrm || !this.animationState.lipSyncData) return;

    const blendShapeProxy = (this.vrm as any).expressionManager || (this.vrm as any).blendShapeProxy;
    if (!blendShapeProxy) return;

    const getValue = blendShapeProxy.getValue?.bind(blendShapeProxy);
    const setValue = blendShapeProxy.setValue?.bind(blendShapeProxy);

    if (!getValue || !setValue) return;

    const lipSync = this.animationState.lipSyncData;
    const speaking = this.animationState.isSpeaking;

    if (speaking) {
      // 映射5元音到VRM BlendShape
      const vowelMapping: Record<number, string[]> = {
        0: ['A', 'a'],
        1: ['E', 'e'],
        2: ['I', 'i'],
        3: ['O', 'o'],
        4: ['U', 'u']
      };

      const values = [lipSync.A, lipSync.E, lipSync.I, lipSync.O, lipSync.U];
      const maxIndex = values.indexOf(Math.max(...values));

      // 应用最大权重的元音
      Object.entries(vowelMapping).forEach(([index, shapes]) => {
        const weight = parseInt(index) === maxIndex 
          ? values[maxIndex] 
          : values[parseInt(index)] * 0.3;
        
        shapes.forEach(shape => {
          if (getValue(shape) !== undefined) {
            setValue(shape, weight);
          }
        });
      });
    } else {
      // 非说话状态，快速闭合
      const vowels = ['A', 'a', 'E', 'e', 'I', 'i', 'O', 'o', 'U', 'u'];
      vowels.forEach(shape => {
        if (getValue(shape) !== undefined) {
          const current = getValue(shape) || 0;
          setValue(shape, THREE.MathUtils.lerp(current, 0, 0.3));
        }
      });
    }
  }

  // 随机眨眼
  private blinkTimer: number = 0;
  private nextBlinkTime: number = 3.0;

  private randomBlink(delta: number): void {
    this.blinkTimer += delta;

    if (this.blinkTimer >= this.nextBlinkTime) {
      this.blink();
      this.blinkTimer = 0;
      this.nextBlinkTime = 3.0 + Math.random() * 3.0; // 3-6秒后再次眨眼
    }
  }

  // 获取当前状态
  getState(): AnimationState {
    return { ...this.animationState };
  }

  // 设置混合速度
  setBlendSpeed(speed: number): void {
    this.blendSpeed = Math.max(1.0, Math.min(20.0, speed));
  }

  // 销毁
  dispose(): void {
    this.vrm = null;
    this.currentWeights.clear();
    this.targetWeights.clear();
    console.log('[AnimationManager] 已销毁');
  }
}
