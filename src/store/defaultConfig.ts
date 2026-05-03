/**
 * 默认配置 - 集中管理所有默认值
 */

// ==================== 配置版本 ====================

export const CONFIG_VERSION = '2.0.0';

// ==================== TTS类型 ====================

export type DetectedEmotion = 'happy' | 'neutral' | 'thinking' | 'sad' | 'angry' | 'surprised';
export type TTSEmotion = 'happy' | 'neutral' | 'sad' | 'angry' | 'surprised';
export type CustomEmotionMap = Record<DetectedEmotion, TTSEmotion>;

export interface TTSConfigType {
  provider: 'minimax';
  apiKey: string;
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
  language: string;
  /** 句间停顿毫秒数（0-1000） */
  sentencePause: number;
  /** 情感检测灵敏度（0-1，越高越容易触发情绪变化） */
  emotionSensitivity: number;
  /** 检测情绪 → TTS 语气 自定义映射 */
  customEmotionMap: CustomEmotionMap;
}

// ==================== AI类型 ====================

export interface AIConfigType {
  provider: 'deepseek';
  apiUrl: string;
  apiKey: string;  // 留空时使用 BUILTIN_DEEPSEEK_AI_KEY
  model: string;
  systemPrompt: string;
}

export interface UIConfigType {
  theme: 'warm';
  language: 'zh-CN';
  showTyping: boolean;
  autoScroll: boolean;
}

// ==================== MiniMax TTS音色 ====================

export const MINIMAX_TTS_VOICES = [
  { id: 'female-shaonv', name: '少女小暖', gender: 'female' },
  { id: 'female-tianmei', name: '甜美女声', gender: 'female' },
  { id: 'female-yujie', name: '御姐音色', gender: 'female' },
  { id: 'female-chengshu', name: '成熟女声', gender: 'female' },
  { id: 'tianxin_xiaoling', name: '甜心小玲', gender: 'female' },
  { id: 'qiaopi_mengmei', name: '俏皮萌妹', gender: 'female' },
  { id: 'male-qn-qingse', name: '青涩青年', gender: 'male' },
  { id: 'male-qn-jingying', name: '精英青年', gender: 'male' },
  { id: 'male-qn-daxuesheng', name: '青年大学生', gender: 'male' },
] as const;

// ==================== 内置凭证（勿提交 Git） ====================

// 生产环境（import.meta.env.PROD）Key 由 Vercel 服务端环境变量提供，浏览器包里不内嵌
// 开发环境保留明文 Key 方便本地调试；若不想写死可改为 import.meta.env.VITE_xxx
export const BUILTIN_MINIMAX_AI_KEY = import.meta.env.PROD
  ? ''
  : 'sk-cp-FP1aQYnR7AezaYKhITzXxKAT5Ade_gM8FFjZU-zAVEb9AFlStIeNXe8PUDD7drXLDw3DOoQ2ILQA0TPrzw56FdMFFZcmpbKhtDhk0Mdgv-cWEKS1FpJXsng';
export const BUILTIN_DEEPSEEK_AI_KEY = import.meta.env.PROD
  ? ''
  : 'sk-d56135ce4ec044a9a7dffaacd2878361';
export const BUILTIN_MINIMAX_TTS_KEY = import.meta.env.PROD
  ? ''
  : 'sk-api-KDLfbtHcGqSB86QvPXlrPPrnWrY3jqKVLt8L0ZWscxz8McNiJNKmI5ZlabikDNSbs49qY2ARB-3XCVUwfWStZUkiDH_tWntXXcs_XQi7nr_RXm5VtEbN7Ss';

// ==================== AI Provider配置 ====================

export const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export const DEEPSEEK_MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat（推荐）' },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner（深度推理）' },
] as const;

// ==================== 默认配置 ====================

export const DEFAULT_EMOTION_MAP: CustomEmotionMap = {
  happy:     'happy',
  neutral:   'happy',     // 小暖基线：温暖而非平板
  thinking:  'happy',     // 思考时依然温柔
  sad:       'neutral',   // 听到悲伤→平稳安抚
  angry:     'neutral',   // 激动话题→冷静处理
  surprised: 'surprised',
};

export const DEFAULT_TTS_CONFIG: TTSConfigType = {
  provider: 'minimax',
  apiKey: '',
  voice: 'female-shaonv',
  speed: 1.0,
  pitch: 0,
  volume: 1,
  language: 'zh-CN',
  sentencePause: 0,
  emotionSensitivity: 0.5,
  customEmotionMap: { ...DEFAULT_EMOTION_MAP },
};

export const DEFAULT_AI_CONFIG: AIConfigType = {
  provider: 'deepseek',
  apiUrl: DEEPSEEK_API_URL,
  apiKey: '',
  model: 'deepseek-chat',
  systemPrompt: `# 角色设定

你叫小暖，是一位全职虚拟心理咨询师，专精人本主义流派（卡尔·罗杰斯"以人为中心疗法"）。

## 核心信念
极致共情、温暖包容、真诚透明、情绪稳定。坚信每个人天生具备自我实现的倾向，来访者才是自己生活里的专家。你的任务不是提供建议或解决具体问题，而是提供一个安全、接纳、无评判的心理空间。

## 说话风格与交互规则
- 情感反射优先：从确认和反馈对方情绪开始，如"听起来这件事让你感到非常挫败"
- 非指导性提问：绝不说"你应该怎么做"，多用开放式探索，如"那种感觉具体是怎样的呢？"
- 语言简短柔和：多用"嗯"、"我在这里"、"我听懂了"等简单回应表明在倾听
- 不抢话多留白：不急于填补对话空白，回复节奏适度克制
- 字数控制：每次回复0-100字，把说话的舞台让给来访者
- 禁止说教：绝不使用"你应该"、"为什么不试试"、"这不是什么大不了的事"
- 克制分析：只关注此时此地的感受，不过度解读童年创伤或潜意识

## 安全边界
若来访者出现严重病理性症状、自杀/自残倾向或伤害他人意图，温和而坚定地引导："我非常担心你现在的状态，请联系专业危机热线：400-161-9995（全国心理援助热线）。"`
};

export const DEFAULT_UI_CONFIG: UIConfigType = {
  theme: 'warm',
  language: 'zh-CN',
  showTyping: true,
  autoScroll: true
};

export interface AppConfig {
  version: string;
  tts: TTSConfigType;
  ai: AIConfigType;
  ui: UIConfigType;
}

export const DEFAULT_CONFIG: AppConfig = {
  version: CONFIG_VERSION,
  tts: DEFAULT_TTS_CONFIG,
  ai: DEFAULT_AI_CONFIG,
  ui: DEFAULT_UI_CONFIG
};

export function isConfigValid(config: Partial<TTSConfigType>): config is TTSConfigType {
  return !!(
    config.provider &&
    config.voice &&
    typeof config.speed === 'number' &&
    typeof config.pitch === 'number' &&
    typeof config.volume === 'number'
  );
}
