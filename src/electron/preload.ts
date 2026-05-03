/**
 * Preload Script - 预加载脚本
 * 在渲染进程中安全地暴露主进程 API
 */
import { contextBridge, ipcRenderer, IpcRendererEvent, OpenDialogOptions, SaveDialogOptions, MessageBoxOptions } from 'electron';
import * as path from 'path';

// ========== 窗口控制 API ==========
const windowAPI = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  restore: () => ipcRenderer.send('window:restore'),
  focus: () => ipcRenderer.send('window:focus'),
  hide: () => ipcRenderer.send('window:hide'),
  show: () => ipcRenderer.send('window:show'),
  
  // 监听窗口状态变化
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_event: IpcRendererEvent, isMaximized: boolean) => callback(isMaximized));
  },
  
  onMinimizedChange: (callback: (isMinimized: boolean) => void) => {
    ipcRenderer.on('window:minimized', (_event: IpcRendererEvent, isMinimized: boolean) => callback(isMinimized));
  },
  
  onFocusChange: (callback: (isFocused: boolean) => void) => {
    ipcRenderer.on('window:focused', (_event: IpcRendererEvent, isFocused: boolean) => callback(isFocused));
  },
};

// ========== 文件系统 API ==========
const fileAPI = {
  // 打开文件对话框
  showOpenDialog: (options: OpenDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }> => {
    return ipcRenderer.invoke('dialog:open', options);
  },
  
  // 保存文件对话框
  showSaveDialog: (options: SaveDialogOptions): Promise<{ canceled: boolean; filePath?: string }> => {
    return ipcRenderer.invoke('dialog:save', options);
  },
  
  // 消息框
  showMessageBox: (options: MessageBoxOptions): Promise<{ response: number; checkboxChecked: boolean }> => {
    return ipcRenderer.invoke('dialog:message', options);
  },
  
  // 通知
  showNotification: (title: string, body: string): void => {
    ipcRenderer.send('notification:show', { title, body });
  },
  
  // 读取文件
  readFile: (filePath: string): Promise<string> => {
    return ipcRenderer.invoke('file:read', filePath);
  },
  
  // 写入文件
  writeFile: (filePath: string, content: string): Promise<void> => {
    return ipcRenderer.invoke('file:write', { filePath, content });
  },
  
  // 选择 VRM 模型文件
  selectVRMFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('file:select-vrm');
  },
  
  // 选择图片文件
  selectImageFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('file:select-image');
  },
};

// ========== 系统 API ==========
const systemAPI = {
  // 获取平台信息
  getPlatform: (): string => {
    return ipcRenderer.sendSync('system:platform');
  },
  
  // 获取版本信息
  getVersion: (): string => {
    return ipcRenderer.sendSync('system:version');
  },
  
  // 获取 CPU 架构
  getArch: (): string => {
    return ipcRenderer.sendSync('system:arch');
  },
  
  // 获取内存使用情况
  getMemoryUsage: (): Promise<{ heapUsed: number; heapTotal: number; external: number }> => {
    return ipcRenderer.invoke('system:memory');
  },
  
  // 获取剪贴板文本
  readClipboardText: (): string => {
    return ipcRenderer.sendSync('clipboard:text');
  },
  
  // 设置剪贴板文本
  writeClipboardText: (text: string): void => {
    ipcRenderer.send('clipboard:text', text);
  },
  
  // 打开外部链接
  openExternal: (url: string): void => {
    ipcRenderer.send('system:open-external', url);
  },
  
  // 打开路径
  openPath: (path: string): void => {
    ipcRenderer.send('system:open-path', path);
  },
};

// ========== 应用 API ==========
const appAPI = {
  // 获取应用路径
  getPath: (name: 'home' | 'appData' | 'userData' | 'temp' | 'exe' | 'module'): string => {
    return ipcRenderer.sendSync('app:get-path', name);
  },
  
  // 获取应用版本
  getVersion: (): string => {
    return ipcRenderer.sendSync('app:version');
  },
  
  // 退出应用
  quit: (): void => {
    ipcRenderer.send('app:quit');
  },
  
  // 重启应用
  relaunch: (): void => {
    ipcRenderer.send('app:relaunch');
  },
  
  // 显示关于对话框
  showAboutPanel: (): void => {
    ipcRenderer.send('app:show-about');
  },
  
  // 设置应用徽章
  setBadgeCount: (count: number): void => {
    ipcRenderer.send('app:set-badge', count);
  },
  
  // 监听应用事件
  onActivate: (callback: () => void) => {
    ipcRenderer.on('app:activate', callback);
  },
  
  onBeforeQuit: (callback: () => void) => {
    ipcRenderer.on('app:before-quit', callback);
  },
};

// ========== 存储 API ==========
const storeAPI = {
  // 获取值
  get: <T>(key: string, defaultValue?: T): T => {
    return ipcRenderer.sendSync('store:get', { key, defaultValue });
  },
  
  // 设置值
  set: (key: string, value: any): void => {
    ipcRenderer.send('store:set', { key, value });
  },
  
  // 删除值
  delete: (key: string): void => {
    ipcRenderer.send('store:delete', key);
  },
  
  // 检查是否存在
  has: (key: string): boolean => {
    return ipcRenderer.sendSync('store:has', key);
  },
  
  // 获取所有键
  keys: (): string[] => {
    return ipcRenderer.sendSync('store:keys');
  },
  
  // 清空存储
  clear: (): void => {
    ipcRenderer.send('store:clear');
  },
};

// ========== 语音 API ==========
const voiceAPI = {
  // 开始语音识别
  startSpeechRecording: (): Promise<void> => {
    return ipcRenderer.invoke('speech:start-recording');
  },
  
  // 停止语音识别
  stopSpeechRecording: (): Promise<void> => {
    return ipcRenderer.invoke('speech:stop-recording');
  },
  
  // 中止语音识别
  abortSpeechRecording: (): Promise<void> => {
    return ipcRenderer.invoke('speech:abort-recording');
  },
  
  // 开始语音合成
  startSpeechSynthesis: (options: {
    text: string;
    language?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
  }): Promise<void> => {
    return ipcRenderer.invoke('speech:synthesis:start', options);
  },
  
  // 停止语音合成
  stopSpeechSynthesis: (): Promise<void> => {
    return ipcRenderer.invoke('speech:synthesis:stop');
  },
  
  // 暂停语音合成
  pauseSpeechSynthesis: (): Promise<void> => {
    return ipcRenderer.invoke('speech:synthesis:pause');
  },
  
  // 恢复语音合成
  resumeSpeechSynthesis: (): Promise<void> => {
    return ipcRenderer.invoke('speech:synthesis:resume');
  },
  
  // 监听语音识别结果
  onSpeechResult: (callback: (text: string, isFinal: boolean) => void) => {
    ipcRenderer.on('speech:result', (_event: IpcRendererEvent, text: string, isFinal: boolean) => callback(text, isFinal));
  },
  
  // 监听语音识别错误
  onSpeechError: (callback: (error: string) => void) => {
    ipcRenderer.on('speech:error', (_event: IpcRendererEvent, error: string) => callback(error));
  },
  
  // 监听语音合成结束
  onSpeechSynthesisEnd: (callback: () => void) => {
    ipcRenderer.on('speech:synthesis:end', callback);
  },
  
  // 监听语音合成错误
  onSpeechSynthesisError: (callback: (error: string) => void) => {
    ipcRenderer.on('speech:synthesis:error', (_event: IpcRendererEvent, error: string) => callback(error));
  },
};

// ========== 更新 API ==========
const updateAPI = {
  // 检查更新
  checkForUpdates: (): Promise<void> => {
    return ipcRenderer.invoke('update:check');
  },
  
  // 下载更新
  downloadUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('update:download');
  },
  
  // 安装更新
  installUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('update:install');
  },
  
  // 取消更新
  cancelUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('update:cancel');
  },
  
  // 获取更新状态
  getStatus: (): Promise<{
    isChecking: boolean;
    isDownloading: boolean;
    lastCheck: { hasUpdate: boolean; version?: string } | null;
    currentVersion: string;
  }> => {
    return ipcRenderer.invoke('update:get-status');
  },
  
  // 监听更新事件
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update:available', (_event: IpcRendererEvent, info: { version: string }) => callback(info.version));
  },
  
  onUpdateDownloaded: (callback: (version: string) => void) => {
    ipcRenderer.on('update:downloaded', (_event: IpcRendererEvent, info: { version: string }) => callback(info.version));
  },
  
  onUpdateProgress: (callback: (progress: { percent: number }) => void) => {
    ipcRenderer.on('update:download-progress', (_event: IpcRendererEvent, progress: { percent: number }) => callback(progress));
  },
};

// ========== 快捷键 API ==========
const shortcutAPI = {
  // 注册快捷键
  register: (name: string, accelerator: string): boolean => {
    return ipcRenderer.sendSync('shortcut:register', { name, accelerator });
  },
  
  // 注销快捷键
  unregister: (name: string): void => {
    ipcRenderer.send('shortcut:unregister', name);
  },
  
  // 监听快捷键触发
  onTriggered: (callback: (name: string) => void) => {
    ipcRenderer.on('shortcut:triggered', (_event: IpcRendererEvent, name: string) => callback(name));
  },
  
  // 获取所有快捷键
  getAll: (): { name: string; accelerator: string }[] => {
    return ipcRenderer.sendSync('shortcut:get-all');
  },
};

// ========== 暴露 API 到渲染进程 ==========
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口
  window: windowAPI,
  
  // 文件
  file: fileAPI,
  
  // 系统
  system: systemAPI,
  
  // 应用
  app: appAPI,
  
  // 存储
  store: storeAPI,
  
  // 语音
  speech: voiceAPI,
  
  // 更新
  update: updateAPI,
  
  // 快捷键
  shortcut: shortcutAPI,
  
  // 工具函数
  path: path,
  
  // 日志
  log: {
    info: (message: string) => ipcRenderer.send('log:info', message),
    warn: (message: string) => ipcRenderer.send('log:warn', message),
    error: (message: string) => ipcRenderer.send('log:error', message),
  },
});

// ========== 类型声明 ==========
declare global {
  interface Window {
    electronAPI: {
      window: typeof windowAPI;
      file: typeof fileAPI;
      system: typeof systemAPI;
      app: typeof appAPI;
      store: typeof storeAPI;
      speech: typeof voiceAPI;
      update: typeof updateAPI;
      shortcut: typeof shortcutAPI;
      path: typeof path;
      log: {
        info: (message: string) => void;
        warn: (message: string) => void;
        error: (message: string) => void;
      };
    };
  }
}
