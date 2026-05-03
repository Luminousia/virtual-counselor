import * as THREE from "three";
import {
  VRM,
  VRMExpressionManager,
  VRMExpressionPresetName,
} from "@pixiv/three-vrm";
import { AutoBlink } from "./autoBlink";
import { AutoLookAt } from "./autoLookAt";

/**
 * 表情状态定义（参考 AIRI）
 */
interface EmotionState {
  expression?: {
    name: string;
    value: number;
    duration?: number;
  }[];
  blendDuration?: number; // 过渡时长（秒）
}

/**
 * Expressionを管理するクラス
 * 改进：参考 AIRI 的表情处理方式，添加平滑过渡、自动重置等功能
 */
export class ExpressionController {
  // 参考ChatVRM：使用AutoLookAt设置注视目标（仅在构造函数中使用）
  // @ts-ignore - AutoLookAt 在构造函数中初始化，用于设置 vrm.lookAt.target
  private _autoLookAt: AutoLookAt;
  private _autoBlink?: AutoBlink;
  private _expressionManager?: VRMExpressionManager;
  private _currentEmotion: VRMExpressionPresetName;
  private _currentLipSync: {
    preset: VRMExpressionPresetName;
    value: number;
  } | null;
  private _lipSyncWeights: Map<VRMExpressionPresetName, number>;
  
  // 平滑过渡相关（参考 AIRI）
  private _isTransitioning: boolean = false;
  private _transitionProgress: number = 0;
  private _currentExpressionValues: Map<string, number> = new Map();
  private _targetExpressionValues: Map<string, number> = new Map();
  private _resetTimeout: number | null = null;
  
  // 表情状态定义（参考 AIRI）
  private _emotionStates: Map<string, EmotionState> = new Map([
    ['happy', {
      expression: [
        { name: 'happy', value: 0.6 }, // 减弱开心表情强度
      ],
      blendDuration: 0.3,
    }],
    ['sad', {
      expression: [
        { name: 'sad', value: 1.0 },
        { name: 'oh', value: 0.2 },
      ],
      blendDuration: 0.3,
    }],
    ['angry', {
      expression: [
        { name: 'angry', value: 1.0 },
        { name: 'ee', value: 0.4 },
      ],
      blendDuration: 0.2,
    }],
    ['surprised', {
      expression: [
        { name: 'Surprised', value: 1.0 },
        { name: 'oh', value: 0.6 },
      ],
      blendDuration: 0.1,
    }],
    ['thinking', {
      expression: [
        { name: 'neutral', value: 0.8 },
        { name: 'ee', value: 0.2 }, // 轻微抿嘴
      ],
      blendDuration: 0.4,
    }],
    ['neutral', {
      expression: [
        { name: 'neutral', value: 1.0 },
        { name: 'aa', value: 0.05 }, // 嘴巴微微张开
      ],
      blendDuration: 0.5,
    }],
  ]);
  
  constructor(vrm: VRM, camera: THREE.Object3D) {
    // 参考ChatVRM：使用AutoLookAt设置注视目标
    this._autoLookAt = new AutoLookAt(vrm, camera);
    this._currentEmotion = "neutral";
    this._currentLipSync = null;
    this._lipSyncWeights = new Map();
    if (vrm.expressionManager) {
      this._expressionManager = vrm.expressionManager;
      this._autoBlink = new AutoBlink(vrm.expressionManager);
    }
  }

  /**
   * 工具函数：线性插值
   */
  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * 工具函数：缓动函数（easeInOutCubic）
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  /**
   * 清除重置定时器
   */
  private clearResetTimeout() {
    if (this._resetTimeout !== null) {
      clearTimeout(this._resetTimeout);
      this._resetTimeout = null;
    }
  }

  /**
   * 设置表情（改进版，支持平滑过渡）
   * 参考 AIRI: packages/stage-ui-three/src/composables/vrm/expression.ts
   */
  public setEmotion(emotionName: string, intensity: number = 1.0) {
    this.clearResetTimeout();

    // 检查表情是否存在
    if (!this._emotionStates.has(emotionName)) {
      // 如果不存在，使用旧的直接设置方式（向后兼容）
      this.playEmotion(emotionName as VRMExpressionPresetName, intensity);
      return;
    }

    const emotionState = this._emotionStates.get(emotionName)!;
    this._currentEmotion = emotionName as VRMExpressionPresetName;
    this._isTransitioning = true;
    this._transitionProgress = 0;

    // 重置所有现有表达式为 0
    if (this._expressionManager) {
      const expressionNames = Object.keys(this._expressionManager.expressionMap);
      for (const name of expressionNames) {
        // 先保存当前值作为起始点
        const currentValue = this._expressionManager.getValue(name) || 0;
        this._currentExpressionValues.set(name, currentValue);
      }
    }

    // 清空目标值
    this._targetExpressionValues.clear();

    // 设置目标值（应用强度）
    for (const expr of emotionState.expression || []) {
      this._targetExpressionValues.set(expr.name, expr.value * intensity);
    }

    // 处理眨眼
    if (emotionName === 'neutral') {
      this._autoBlink?.setEnable(true);
    } else {
      this._autoBlink?.setEnable(false);
    }
  }

  /**
   * 设置表情并在指定时间后自动重置为中性
   * 参考 AIRI: setEmotionWithResetAfter
   */
  public setEmotionWithResetAfter(emotionName: string, ms: number, intensity: number = 1.0) {
    this.clearResetTimeout();
    this.setEmotion(emotionName, intensity);

    // 设置定时器自动重置
    this._resetTimeout = setTimeout(() => {
      this.setEmotion('neutral', 1.0);
      this._resetTimeout = null;
    }, ms) as unknown as number;
  }

  /**
   * 播放表情（保持向后兼容）
   */
  public playEmotion(preset: VRMExpressionPresetName, intensity: number = 1.0) {
    // 使用新的平滑过渡方式
    this.setEmotion(preset, intensity);
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    // 支持多个口型同时应用（参考 AIRI）
    if (value > 0) {
      this._lipSyncWeights.set(preset, value);
    } else {
      this._lipSyncWeights.delete(preset);
    }
    
    // 保持向后兼容
    if (this._lipSyncWeights.size > 0) {
      // 使用权重最大的作为主要口型（用于向后兼容）
      let maxPreset: VRMExpressionPresetName = preset;
      let maxValue = value;
      for (const [p, v] of this._lipSyncWeights.entries()) {
        if (v > maxValue) {
          maxValue = v;
          maxPreset = p;
        }
      }
      this._currentLipSync = {
        preset: maxPreset,
        value: maxValue,
      };
    } else {
      // 清除所有口型
      if (this._currentLipSync) {
        this._expressionManager?.setValue(this._currentLipSync.preset, 0);
      }
      this._currentLipSync = null;
    }
  }
  
  /**
   * 设置多个口型权重（改进版，参考 AIRI）
   */
  public setLipSyncWeights(weights: Map<VRMExpressionPresetName, number> | Record<string, number>) {
    // 清除旧权重
    for (const preset of this._lipSyncWeights.keys()) {
      this._expressionManager?.setValue(preset, 0);
    }
    this._lipSyncWeights.clear();
    
    // 设置新权重
    if (weights instanceof Map) {
      this._lipSyncWeights = new Map(weights);
    } else {
      for (const [preset, value] of Object.entries(weights)) {
        if (value > 0) {
          this._lipSyncWeights.set(preset as VRMExpressionPresetName, value);
        }
      }
    }
    
    // 更新当前口型（用于向后兼容）
    if (this._lipSyncWeights.size > 0) {
      let maxPreset: VRMExpressionPresetName = 'aa';
      let maxValue = 0;
      for (const [p, v] of this._lipSyncWeights.entries()) {
        if (v > maxValue) {
          maxValue = v;
          maxPreset = p;
        }
      }
      this._currentLipSync = {
        preset: maxPreset,
        value: maxValue,
      };
    } else {
      this._currentLipSync = null;
    }
  }

  public update(delta: number) {
    if (this._autoBlink) {
      this._autoBlink.update(delta);
    }

    // 处理表情平滑过渡（参考 AIRI）
    if (this._isTransitioning && this._currentEmotion) {
      const emotionState = this._emotionStates.get(this._currentEmotion);
      if (emotionState) {
        const blendDuration = emotionState.blendDuration || 0.3;
        
        // 更新过渡进度
        this._transitionProgress += delta / blendDuration;
        if (this._transitionProgress >= 1.0) {
          this._transitionProgress = 1.0;
          this._isTransitioning = false;
        }

        // 更新所有表达式值（使用缓动函数）
        for (const [exprName, targetValue] of this._targetExpressionValues.entries()) {
          const startValue = this._currentExpressionValues.get(exprName) || 0;
          const currentValue = this.lerp(
            startValue,
            targetValue,
            this.easeInOutCubic(this._transitionProgress)
          );
          this._expressionManager?.setValue(exprName, currentValue);
        }
      }
    }

    // 应用所有口型权重（参考 AIRI 的多口型混合）
    if (this._lipSyncWeights.size > 0) {
      const emotionFactor = this._currentEmotion === "neutral" ? 0.5 : 0.25;
      for (const [preset, value] of this._lipSyncWeights.entries()) {
        const weight = value * emotionFactor;
        this._expressionManager?.setValue(preset, weight);
      }
    } else if (this._currentLipSync) {
      // 向后兼容：使用单个口型
      const weight =
        this._currentEmotion === "neutral"
          ? this._currentLipSync.value * 0.5
          : this._currentLipSync.value * 0.25;
      this._expressionManager?.setValue(this._currentLipSync.preset, weight);
    }
  }

  /**
   * 添加自定义表情状态
   */
  public addEmotionState(emotionName: string, state: EmotionState) {
    this._emotionStates.set(emotionName, state);
  }

  /**
   * 移除表情状态
   */
  public removeEmotionState(emotionName: string) {
    this._emotionStates.delete(emotionName);
  }

  /**
   * 清理资源
   */
  public dispose() {
    this.clearResetTimeout();
  }
}
