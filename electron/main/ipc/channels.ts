// IPC通信通道定义

export const IPC_CHANNELS = {
  // 窗口控制
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  
  // 文件系统
  FILE_SELECT_VRM: 'file:select-vrm',
  FILE_SELECT_AUDIO: 'file:select-audio',
  FILE_SAVE_DIALOG: 'file:save-dialog',
  FILE_READ_LOCAL: 'file:read-local',
  
  // 系统功能
  SYSTEM_NOTIFICATION: 'system:notification',
  SYSTEM_GET_INFO: 'system:get-info',
  SYSTEM_OPEN_PATH: 'system:open-path',
  
  // AI服务（本地化）
  AI_START_LOCAL: 'ai:start-local',
  AI_STOP_LOCAL: 'ai:stop-local',
  AI_GET_STATUS: 'ai:get-status',
  
  // TTS服务（本地化）
  TTS_START_LOCAL: 'tts:start-local',
  TTS_STOP_LOCAL: 'tts:stop-local',
  TTS_GET_VOICES: 'tts:get-voices',
  
  // 语音识别
  SPEECH_START_RECORDING: 'speech:start-recording',
  SPEECH_STOP_RECORDING: 'speech:stop-recording',
  SPEECH_IS_RECOGNIZING: 'speech:is-recognizing',
  
  // 自动更新
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_GET_STATUS: 'updater:get-status',
  
  // 数据持久化
  DATA_SAVE: 'data:save',
  DATA_LOAD: 'data:load',
  DATA_DELETE: 'data:delete'
} as const;

// 类型定义
export type WindowControl = {
  minimize: () => Promise<void>;
  maximize: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
};

export type FileSystem = {
  selectVRM: () => Promise<string | null>;
  selectAudio: () => Promise<string | null>;
  saveDialog: (options: Electron.SaveDialogOptions) => Promise<string | null>;
  readLocal: (path: string) => Promise<string>;
};

export type System = {
  notify: (title: string, body: string) => Promise<void>;
  getInfo: () => Promise<Electron.SystemInfo>;
  openPath: (path: string) => Promise<void>;
};

export type LocalAI = {
  start: (config: AIConfig) => Promise<void>;
  stop: () => Promise<void>;
  getStatus: () => Promise<AIStatus>;
};

export type LocalTTS = {
  speak: (text: string, voice: string) => Promise<Buffer>;
  stop: () => Promise<void>;
  getVoices: () => Promise<TTSVoice[]>;
};

export type SpeechRecognition = {
  start: () => Promise<void>;
  stop: () => Promise<string>;
  isRecognizing: () => Promise<boolean>;
};

export type AutoUpdater = {
  check: () => Promise<void>;
  download: () => Promise<void>;
  getStatus: () => Promise<UpdateStatus>;
};

export type DataStore = {
  save: (key: string, data: unknown) => Promise<void>;
  load: <T>(key: string) => Promise<T | null>;
  delete: (key: string) => Promise<void>;
};

// 事件名称
export const IPC_EVENTS = {
  WINDOW_MAXIMIZED_CHANGED: 'window:maximized-changed',
  SPEECH_RESULT: 'speech:result',
  SPEECH_STATE_CHANGED: 'speech:state-changed',
  UPDATER_STATUS_CHANGED: 'updater:status-changed'
} as const;
