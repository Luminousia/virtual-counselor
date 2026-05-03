/**
 * 音频管理器
 * 参考 AIRI 的音频处理方式，提供统一的音频上下文和分析器管理
 */

export interface AudioManager {
  audioContext: AudioContext
  analyser: AnalyserNode
  dataBuffer: Float32Array
  frameId: number | null
  onVolumeChange?: (volume: number) => void
}

/**
 * 创建音频管理器
 * 参考 AIRI: packages/stage-ui/src/libs/audio/manager.ts
 */
export function createAudioManager(): AudioManager {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.3
  const dataBuffer = new Float32Array(analyser.frequencyBinCount)

  return {
    audioContext,
    analyser,
    dataBuffer,
    frameId: null,
    onVolumeChange: undefined,
  }
}

/**
 * 计算音量（使用 sigmoid 归一化）
 * 参考 AIRI: packages/stage-ui/src/libs/audio/manager.ts
 */
export function calculateVolume(manager: AudioManager): number {
  manager.analyser.getFloatTimeDomainData(manager.dataBuffer)

  // 计算峰值音量
  let volume = 0.0
  for (let i = 0; i < manager.dataBuffer.length; i++) {
    volume = Math.max(volume, Math.abs(manager.dataBuffer[i]))
  }

  // 使用 sigmoid 函数归一化（来自 pixiv 实现）
  volume = 1 / (1 + Math.exp(-45 * volume + 5))
  return volume < 0.1 ? 0 : volume
}

/**
 * 更新音量跟踪帧
 */
function updateFrame(manager: AudioManager) {
  if (manager.onVolumeChange) {
    manager.onVolumeChange(calculateVolume(manager))
  }
  manager.frameId = requestAnimationFrame(() => updateFrame(manager))
}

/**
 * 播放音频
 * 参考 AIRI: packages/stage-ui/src/components/scenes/Stage.vue
 */
export async function playAudio(
  manager: AudioManager,
  source: ArrayBuffer | string,
  onEnded?: () => void
): Promise<void> {
  try {
    const buffer = typeof source === 'string'
      ? await (await fetch(source)).arrayBuffer()
      : source

    const audioBuffer = await manager.audioContext.decodeAudioData(buffer)
    const bufferSource = manager.audioContext.createBufferSource()

    bufferSource.buffer = audioBuffer
    
    // 连接到多个节点
    bufferSource.connect(manager.audioContext.destination) // 输出到扬声器
    bufferSource.connect(manager.analyser) // 音量分析

    return new Promise((resolve) => {
      bufferSource.onended = () => {
        resolve()
        onEnded?.()
      }
      bufferSource.start(0)
    })
  } catch (error) {
    console.error('Error playing audio:', error)
    throw error
  }
}

/**
 * 开始音量跟踪
 */
export function startVolumeTracking(manager: AudioManager, callback: (volume: number) => void) {
  manager.onVolumeChange = callback
  if (manager.audioContext.state === 'suspended') {
    manager.audioContext.resume()
  }
  updateFrame(manager)
}

/**
 * 停止音量跟踪
 */
export function stopVolumeTracking(manager: AudioManager) {
  if (manager.frameId) {
    cancelAnimationFrame(manager.frameId)
    manager.frameId = null
  }
  manager.onVolumeChange = undefined
}

/**
 * 销毁音频管理器
 */
export function disposeAudioManager(manager: AudioManager) {
  stopVolumeTracking(manager)
  manager.audioContext.close()
}
