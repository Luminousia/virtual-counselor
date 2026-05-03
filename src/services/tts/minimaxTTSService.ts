/**
 * MiniMax TTS 服务适配器
 * 通过 HTTP 调用 MiniMax API 生成语音
 */

export interface MinimaxTTSConfig {
  apiKey: string
  voice: string // 音色 ID，如 'female-shaonv', 'female-tianmei' 等
  emotion: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'neutral'
  speed: number // 0.5-2.0
  pitch: number // -12 to 12
  volume: number // 0-10
}

// MiniMax 中文推荐音色
export const MINIMAX_VOICES = {
  // 女性音色
  'female-shaonv': '少女音色',
  'female-yujie': '御姐音色',
  'female-chengshu': '成熟女性音色',
  'female-tianmei': '甜美女性音色',
  'female-shaonv-jingpin': '少女音色-beta',
  'female-tianmei-jingpin': '甜美女性音色-beta',
  
  // 特色女性音色
  'tianxin_xiaoling': '甜心小玲',
  'qiaopi_mengmei': '俏皮萌妹',
  'wumei_yujie': '妩媚御姐',
  'diadia_xuemei': '嗲嗲学妹',
  'danya_xuejie': '淡雅学姐',
  
  // 中文普通话女性
  'Chinese (Mandarin)_Warm_Girl': '温暖少女',
  'Chinese (Mandarin)_Sweet_Lady': '甜美女声',
  'Chinese (Mandarin)_Warm_Bestie': '温暖闺蜜',
  'Chinese (Mandarin)_Gentle_Senior': '温柔学姐',
  'Chinese (Mandarin)_Soft_Girl': '软软女孩',
  'Chinese (Mandarin)_Crisp_Girl': '清脆少女',
  
  // 男性音色
  'male-qn-qingse': '青涩青年音色',
  'male-qn-jingying': '精英青年音色',
  'male-qn-daxuesheng': '青年大学生音色',
  'Chinese (Mandarin)_Gentle_Youth': '温润青年',
  'Chinese (Mandarin)_Sincere_Adult': '真诚青年',
} as const

export type MinimaxVoiceId = keyof typeof MINIMAX_VOICES

// 默认配置
export const DEFAULT_MINIMAX_CONFIG: MinimaxTTSConfig = {
  apiKey: '', // 需要用户配置
  voice: 'female-shaonv',
  emotion: 'happy',
  speed: 1.0,
  pitch: 0,
  volume: 1,
}

/**
 * MiniMax TTS 服务类
 * 注意：此服务通过 MCP 工具调用，无法直接在浏览器中使用
 * 需要通过后端代理或 Electron 主进程调用
 */
export class MinimaxTTSService {
  private config: MinimaxTTSConfig
  private apiHost = 'https://api.minimax.chat'
  
  constructor(config: Partial<MinimaxTTSConfig> = {}) {
    this.config = { ...DEFAULT_MINIMAX_CONFIG, ...config }
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<MinimaxTTSConfig>) {
    this.config = { ...this.config, ...config }
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): MinimaxTTSConfig {
    return { ...this.config }
  }
  
  /**
   * 通过 MiniMax API 生成语音
   * 注意：此方法需要在支持 CORS 的环境中使用，或通过后端代理
   */
  async generateSpeech(text: string): Promise<ArrayBuffer> {
    if (!this.config.apiKey) {
      throw new Error('MiniMax API Key 未配置')
    }
    
    const groupId = this.extractGroupId(this.config.apiKey)
    const url = `${this.apiHost}/v1/t2a_v2?GroupId=${groupId}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'speech-01-turbo',
        text,
        stream: false,
        voice_setting: {
          voice_id: this.config.voice,
          speed: this.config.speed,
          vol: this.config.volume,
          pitch: this.config.pitch,
          emotion: this.config.emotion,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
        },
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`MiniMax TTS API 错误: ${response.status} - ${error}`)
    }
    
    const data = await response.json()
    
    if (data.base_resp?.status_code !== 0) {
      throw new Error(`MiniMax TTS 错误: ${data.base_resp?.status_msg || '未知错误'}`)
    }
    
    // 解码 base64 音频数据
    const audioData = data.data?.audio
    if (!audioData) {
      throw new Error('MiniMax TTS 返回数据中没有音频')
    }
    
    // 将 hex 字符串转换为 ArrayBuffer
    const bytes = new Uint8Array(audioData.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)))
    return bytes.buffer
  }
  
  /**
   * 从 API Key 中提取 Group ID
   */
  private extractGroupId(apiKey: string): string {
    // MiniMax API Key 格式通常包含 group id
    // 如果无法提取，返回空字符串（API 可能不需要）
    return ''
  }
}

// 单例导出
export const minimaxTTSService = new MinimaxTTSService()
