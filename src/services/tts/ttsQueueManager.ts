/**
 * TTS 队列管理器 - 实现边生成边播放
 * 支持 Genie-TTS（本地）和 MiniMax（云端）
 */

import { LipSyncAnalyzer, LipSyncResult } from '../../utils/lipSyncAnalyzer'
import { useTTSConfigStore, TTSConfig } from '../../store/apiConfigStore'
import { BUILTIN_MINIMAX_TTS_KEY, DEFAULT_EMOTION_MAP, TTS_PROXY_URL } from '../../store/defaultConfig'
import { callCloudFunction, isCloudBaseEnv } from '../cloudbaseClient'

export interface AudioChunk {
  text: string
  emotion: string
  audio: ArrayBuffer | null
  status: 'pending' | 'generating' | 'ready' | 'playing' | 'done' | 'error'
}

/** 从 store 读取用户自定义映射，回退到默认 */
function resolveEmotion(detected: string, config: TTSConfig): string {
  const map = (config as any).customEmotionMap ?? DEFAULT_EMOTION_MAP
  return map[detected] ?? DEFAULT_EMOTION_MAP[detected as keyof typeof DEFAULT_EMOTION_MAP] ?? 'happy'
}

export class TTSQueueManager {
  private queue: AudioChunk[] = []
  private isPlaying = false
  private currentIndex = 0
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  
  // 回调函数
  private onAudioStart?: () => void
  private onAudioEnd?: () => void
  private onVolumeUpdate?: (volume: number) => void
  private onLipSyncUpdate?: (result: LipSyncResult) => void
  
  private analyser: AnalyserNode | null = null
  private lipSyncAnalyzer: LipSyncAnalyzer | null = null
  private volumeFrameId: number | null = null
  
  constructor() {
    this.initAudioContext()
  }
  
  private initAudioContext() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.3
      this.analyser.connect(this.audioContext.destination)
      
      // 初始化口型同步分析器
      this.lipSyncAnalyzer = new LipSyncAnalyzer(this.analyser)
      
      console.log('[TTSQueue] AudioContext 初始化完成')
    }
  }
  
  /**
   * 确保 AudioContext 处于运行状态
   */
  private async ensureAudioContextRunning() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      console.log('[TTSQueue] 恢复 AudioContext...')
      await this.audioContext.resume()
      console.log('[TTSQueue] AudioContext 已恢复')
    }
  }
  
  /**
   * 设置回调
   */
  setCallbacks(callbacks: {
    onAudioStart?: () => void
    onAudioEnd?: () => void
    onVolumeUpdate?: (volume: number) => void
    onLipSyncUpdate?: (result: LipSyncResult) => void
  }) {
    this.onAudioStart = callbacks.onAudioStart
    this.onAudioEnd = callbacks.onAudioEnd
    this.onVolumeUpdate = callbacks.onVolumeUpdate
    this.onLipSyncUpdate = callbacks.onLipSyncUpdate
  }
  
  /**
   * 添加句子到队列并开始生成
   * @param emotion 由 emotionAnalyzer 检测到的情感，留空则使用 neutral
   */
  async addSentence(text: string, emotion = 'neutral') {
    // 确保 AudioContext 准备就绪
    await this.ensureAudioContextRunning()

    const config = this.getTTSConfig()
    const chunk: AudioChunk = {
      text,
      emotion: resolveEmotion(emotion, config),
      audio: null,
      status: 'pending'
    }
    
    this.queue.push(chunk)
    const index = this.queue.length - 1
    
    console.log(`[TTSQueue] 添加句子 [${index}]: "${text.substring(0, 20)}..."`)
    
    // 异步生成音频
    this.generateAudio(index)
    
    // 如果没有在播放，开始播放
    if (!this.isPlaying) {
      this.playNext()
    }
  }
  
  /**
   * 生成单个句子的音频
   */
  private async generateAudio(index: number) {
    const chunk = this.queue[index]
    if (!chunk || chunk.status !== 'pending') return
    
    chunk.status = 'generating'
    
    try {
      const config = this.getTTSConfig()
      const audio = await this.fetchTTS(chunk.text, chunk.emotion, config)
      chunk.audio = audio
      chunk.status = 'ready'
      
      // 如果这是当前要播放的，触发播放
      if (index === this.currentIndex && !this.isPlaying) {
        this.playNext()
      }
    } catch (error) {
      console.error(`TTS 生成失败 [${index}]:`, error)
      chunk.status = 'error'
      // 跳过错误的，播放下一个
      if (index === this.currentIndex) {
        this.currentIndex++
        this.playNext()
      }
    }
  }
  
  /**
   * 播放下一个音频
   */
  private async playNext() {
    if (this.currentIndex >= this.queue.length) {
      // 队列播放完成
      this.isPlaying = false
      this.onAudioEnd?.()
      return
    }
    
    const chunk = this.queue[this.currentIndex]
    
    if (chunk.status === 'ready' && chunk.audio) {
      this.isPlaying = true
      chunk.status = 'playing'
      
      // 浏览器 TTS 返回空 ArrayBuffer，已经在 useBrowserTTS 中播放了
      if (chunk.audio.byteLength === 0) {
        // 浏览器 TTS 已经播放完成
        chunk.status = 'done'
        this.currentIndex++
        this.onAudioEnd?.()
        this.playNext()
        return
      }
      
      // 每次播放都触发 onAudioStart（确保 isSpeaking 状态正确）
      this.onAudioStart?.()
      
      try {
        await this.playAudioBuffer(chunk.audio)
        chunk.status = 'done'
        this.currentIndex++
        // 句间停顿
        const pause = (this.getTTSConfig() as any).sentencePause ?? 0
        if (pause > 0) await new Promise(r => setTimeout(r, pause))
        this.playNext()
      } catch (error) {
        console.error('播放失败:', error)
        chunk.status = 'error'
        this.currentIndex++
        this.playNext()
      }
    } else if (chunk.status === 'generating' || chunk.status === 'pending') {
      // 等待生成完成
      this.isPlaying = false
    } else if (chunk.status === 'error') {
      // 跳过错误
      this.currentIndex++
      this.playNext()
    }
  }
  
  /**
   * 播放 ArrayBuffer
   */
  private playAudioBuffer(buffer: ArrayBuffer): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this.audioContext || !this.analyser) {
        // 尝试重新初始化
        this.initAudioContext()
        if (!this.audioContext || !this.analyser) {
          reject(new Error('AudioContext 未初始化'))
          return
        }
      }
      
      try {
        // 确保 AudioContext 处于运行状态
        await this.ensureAudioContextRunning()
        
        const audioBuffer = await this.audioContext.decodeAudioData(buffer.slice(0))
        const source = this.audioContext.createBufferSource()
        source.buffer = audioBuffer
        
        source.connect(this.analyser)
        this.currentSource = source
        
        console.log('[TTSQueue] 开始播放音频, 时长:', audioBuffer.duration.toFixed(2), '秒')
        
        // 开始音量跟踪
        this.startVolumeTracking()
        
        source.onended = () => {
          console.log('[TTSQueue] 音频播放完成')
          this.stopVolumeTracking()
          this.currentSource = null
          resolve()
        }
        
        source.start(0)
      } catch (error) {
        console.error('[TTSQueue] 播放音频失败:', error)
        this.stopVolumeTracking()
        reject(error)
      }
    })
  }
  
  /**
   * 开始音量和口型同步跟踪
   */
  private startVolumeTracking() {
    // 如果已经在跟踪，先停止
    if (this.volumeFrameId) {
      cancelAnimationFrame(this.volumeFrameId)
      this.volumeFrameId = null
    }
    
    if (!this.analyser) {
      console.warn('[TTSQueue] Analyser 未初始化，无法跟踪口型')
      return
    }
    
    // 重置口型分析器状态
    if (this.lipSyncAnalyzer) {
      this.lipSyncAnalyzer.reset()
    }
    
    let lastTime = performance.now()
    let frameCount = 0
    
    const updateVolume = () => {
      if (!this.analyser || !this.currentSource) {
        // 如果没有音频源，停止跟踪
        this.volumeFrameId = null
        return
      }
      
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now
      frameCount++
      
      // 使用口型同步分析器进行精确分析
      if (this.lipSyncAnalyzer && this.onLipSyncUpdate) {
        const lipSyncResult = this.lipSyncAnalyzer.update(delta)
        
        // 每 60 帧打印一次调试信息
        if (frameCount % 60 === 0) {
          console.log('[TTSQueue] 口型数据:', 
            'A:', lipSyncResult.A.toFixed(2),
            'E:', lipSyncResult.E.toFixed(2),
            'I:', lipSyncResult.I.toFixed(2),
            'O:', lipSyncResult.O.toFixed(2),
            'U:', lipSyncResult.U.toFixed(2),
            'vol:', lipSyncResult.volume.toFixed(2)
          )
        }
        
        this.onLipSyncUpdate(lipSyncResult)
        this.onVolumeUpdate?.(lipSyncResult.volume)
      } else if (this.onVolumeUpdate) {
        // 降级为简单音量检测
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
        this.analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const average = sum / dataArray.length
        const volume = Math.min(1, average / 128)
        this.onVolumeUpdate(volume)
      }
      
      this.volumeFrameId = requestAnimationFrame(updateVolume)
    }
    
    console.log('[TTSQueue] 开始口型跟踪')
    updateVolume()
  }
  
  /**
   * 停止音量跟踪
   */
  private stopVolumeTracking() {
    console.log('[TTSQueue] 停止口型跟踪')
    
    if (this.volumeFrameId) {
      cancelAnimationFrame(this.volumeFrameId)
      this.volumeFrameId = null
    }
    
    // 重置口型（延迟一帧，确保最后的状态被正确处理）
    requestAnimationFrame(() => {
      if (this.lipSyncAnalyzer) {
        this.lipSyncAnalyzer.reset()
      }
      if (this.onLipSyncUpdate) {
        this.onLipSyncUpdate({ A: 0, E: 0, I: 0, O: 0, U: 0, volume: 0 })
      }
      this.onVolumeUpdate?.(0)
    })
  }
  
  /**
   * 获取 TTS 配置
   */
  private getTTSConfig(): TTSConfig {
    return useTTSConfigStore.getState().ttsConfig
  }
  
  /**
   * 调用 TTS API
   */
  private async fetchTTS(text: string, emotion: string, config: TTSConfig): Promise<ArrayBuffer> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await this.fetchMinimaxTTS(text, emotion, config, controller.signal)
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`TTS API 错误: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      if (data.base_resp?.status_code !== 0) {
        throw new Error(`MiniMax TTS 错误: ${data.base_resp?.status_msg || '未知错误'}`)
      }

      const audioHex = data.data?.audio
      if (!audioHex) {
        throw new Error('MiniMax TTS 返回数据中没有音频')
      }

      const bytes = new Uint8Array(
        audioHex.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16))
      )
      return bytes.buffer
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('TTS 请求超时')
      }
      throw error
    }
  }
  
  /**
   * 调用 MiniMax TTS API
   */
  private async fetchMinimaxTTS(
    text: string,
    emotion: string,
    config: TTSConfig,
    signal: AbortSignal
  ): Promise<Response> {
    const requestBody = {
      model: 'speech-01-turbo',
      text,
      stream: false,
      voice_setting: {
        voice_id: config.voice || 'female-shaonv',
        speed: config.speed || 1.0,
        vol: (config.volume || 1) * 10,
        pitch: config.pitch || 0,
        emotion,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
      },
    }

    // ── CloudBase SDK 调用：绕过 CORS ──
    if (isCloudBaseEnv()) {
      type TTSResult = { data?: { audio?: string }; base_resp?: { status_code?: number; status_msg?: string } }
      const result = await callCloudFunction<TTSResult>('tts', requestBody as unknown as Record<string, unknown>)
      if (!result) throw new Error('CloudBase TTS 调用失败（callFunction 返回 null）')
      if (result.base_resp?.status_code !== 0) {
        throw new Error(`MiniMax TTS 错误: ${result.base_resp?.status_msg || '未知'}`)
      }
      const audio = result.data?.audio
      if (!audio) throw new Error('CloudBase TTS 返回数据中没有音频')
      // 将 base64 包装成 Response 供后续统一处理
      const jsonStr = JSON.stringify(result)
      return new Response(jsonStr, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // ── HTTP 调用（开发或非 CloudBase 生产）──
    const isProd = import.meta.env.PROD
    const url = isProd ? TTS_PROXY_URL : '/__minimax-tts/v1/t2a_v2'
    const apiKey = isProd ? '' : ((config.apiKey || '').trim() || BUILTIN_MINIMAX_TTS_KEY)

    console.log('[TTSQueue] 调用 MiniMax TTS:', { voice: config.voice, emotion, textLength: text.length })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal,
    })
  }
  
  /**
   * 停止播放并清空队列
   */
  stop() {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
        this.currentSource.disconnect()
      } catch {}
      this.currentSource = null
    }
    
    this.stopVolumeTracking()
    this.queue = []
    this.currentIndex = 0
    this.isPlaying = false
  }
  
  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      currentIndex: this.currentIndex,
      isPlaying: this.isPlaying,
      pendingCount: this.queue.filter(c => c.status === 'pending').length,
      generatingCount: this.queue.filter(c => c.status === 'generating').length,
      readyCount: this.queue.filter(c => c.status === 'ready').length,
    }
  }
}

// 单例导出
export const ttsQueueManager = new TTSQueueManager()
