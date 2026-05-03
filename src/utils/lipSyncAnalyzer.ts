/**
 * 口型同步分析器
 * 参考 AIRI 的口型同步实现，提供更精确的口型检测
 * 参考: packages/stage-ui-three/src/composables/vrm/lip-sync.ts
 */

export interface LipSyncResult {
  A: number
  E: number
  I: number
  O: number
  U: number
  volume: number
}

// 口型键映射到 VRM blendshape
export const BLENDSHAPE_MAP: Record<keyof Omit<LipSyncResult, 'volume'>, string> = {
  A: 'aa',
  E: 'ee',
  I: 'ih',
  O: 'oh',
  U: 'ou',
}

export class LipSyncAnalyzer {
  private analyser: AnalyserNode
  private dataArray: Uint8Array
  private smoothState: Record<keyof Omit<LipSyncResult, 'volume'>, number> = {
    A: 0,
    E: 0,
    I: 0,
    O: 0,
    U: 0,
  }

  // 参数配置（增强版）
  private readonly ATTACK = 80 // 移动到下一个口型的速度（更快响应）
  private readonly RELEASE = 40 // 结束当前口型的速度
  private readonly CAP = 1.0 // 最大口型强度（满幅度）
  private readonly SILENCE_VOL = 0.02 // 静音音量阈值（更灵敏）
  private readonly SILENCE_GAIN = 0.03 // 静音增益阈值（更灵敏）
  private readonly IDLE_MS = 100 // 静音持续时间（更快闭嘴）

  private lastActiveAt = 0

  constructor(analyser: AnalyserNode) {
    this.analyser = analyser
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.3
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
  }

  /**
   * 更新口型同步分析
   * 参考 AIRI 的 wlipsync 实现
   */
  update(delta: number = 0.016): LipSyncResult {
    // 获取频率数据
    this.analyser.getByteFrequencyData(this.dataArray)

    // 计算音量（简化版，基于频率数据）
    let volume = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      volume += this.dataArray[i]
    }
    volume = volume / (this.dataArray.length * 255) // 归一化到 0-1

    // 增强音量响应
    const amp = Math.min(volume * 2.5, 1) ** 0.5

    // 简化的口型检测（基于频率分析）
    // 实际应用中可以使用更复杂的算法（如 wlipsync）
    const projected: Record<keyof Omit<LipSyncResult, 'volume'>, number> = {
      A: 0,
      E: 0,
      I: 0,
      O: 0,
      U: 0,
    }

    // 基于频率分布估算口型
    // 低频（0-20%）：A, O
    // 中频（20-60%）：E, I
    // 高频（60-100%）：I, U
    const lowFreq = this.dataArray.slice(0, Math.floor(this.dataArray.length * 0.2))
    const midFreq = this.dataArray.slice(
      Math.floor(this.dataArray.length * 0.2),
      Math.floor(this.dataArray.length * 0.6)
    )
    const highFreq = this.dataArray.slice(Math.floor(this.dataArray.length * 0.6))

    const lowAvg = lowFreq.reduce((a, b) => a + b, 0) / lowFreq.length / 255
    const midAvg = midFreq.reduce((a, b) => a + b, 0) / midFreq.length / 255
    const highAvg = highFreq.reduce((a, b) => a + b, 0) / highFreq.length / 255

    // 映射到口型（增强幅度）
    projected.A = Math.min(1, lowAvg * amp * 3.0)  // 张大嘴
    projected.O = Math.min(1, lowAvg * amp * 2.5)  // 圆嘴
    projected.E = Math.min(1, midAvg * amp * 2.8)  // 微张
    projected.I = Math.min(1, (midAvg + highAvg) * amp * 2.2)  // 扁嘴
    projected.U = Math.min(1, highAvg * amp * 2.5)  // 嘟嘴

    // Winner + Runner 策略（只混合最大的两个口型）
    let winner: keyof Omit<LipSyncResult, 'volume'> = 'I'
    let runner: keyof Omit<LipSyncResult, 'volume'> = 'E'
    let winnerVal = -Infinity
    let runnerVal = -Infinity

    for (const key of ['A', 'E', 'I', 'O', 'U'] as const) {
      const val = projected[key]
      if (val > winnerVal) {
        runnerVal = winnerVal
        runner = winner
        winnerVal = val
        winner = key
      } else if (val > runnerVal) {
        runnerVal = val
        runner = key
      }
    }

    // 检测静音
    const now = performance.now()
    let silent = amp < this.SILENCE_VOL || winnerVal < this.SILENCE_GAIN
    if (!silent) {
      this.lastActiveAt = now
    }
    if (now - this.lastActiveAt > this.IDLE_MS) {
      silent = true
    }

    // 计算目标口型值
    const target: Record<keyof Omit<LipSyncResult, 'volume'>, number> = {
      A: 0,
      E: 0,
      I: 0,
      O: 0,
      U: 0,
    }

    if (!silent) {
      target[winner] = Math.min(this.CAP, winnerVal * 1.5)  // 主口型更强
      target[runner] = Math.min(this.CAP * 0.7, runnerVal * 0.9)  // 副口型也更强
    }

    // 平滑过渡
    for (const key of ['A', 'E', 'I', 'O', 'U'] as const) {
      const from = this.smoothState[key]
      const to = target[key]
      // 使用指数衰减进行平滑
      const rate = 1 - Math.exp(-(to > from ? this.ATTACK : this.RELEASE) * delta)
      this.smoothState[key] = from + (to - from) * rate
    }

    return {
      ...this.smoothState,
      volume: amp,
    }
  }

  /**
   * 重置口型状态
   */
  reset() {
    this.smoothState = { A: 0, E: 0, I: 0, O: 0, U: 0 }
    this.lastActiveAt = 0
  }
}
