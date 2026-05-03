import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../main/ipc/channels.js';

// 安全API暴露
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  window: {
    control: {
      minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
      maximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
      close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
      isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED)
    },
    
    // 监听窗口状态变化
    onMaximizedChange: (callback: (maximized: boolean) => void) => {
      ipcRenderer.on('window:maximized-changed', (_, maximized) => callback(maximized));
      return () => ipcRenderer.removeAllListeners('window:maximized-changed');
    }
  },
  
  // 文件系统
  fs: {
    selectVRM: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_VRM),
    selectAudio: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_AUDIO),
    saveDialog: (options: Electron.SaveDialogOptions) => 
      ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE_DIALOG, options),
    readLocal: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_READ_LOCAL, path)
  },
  
  // 系统功能
  system: {
    notify: (title: string, body: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_NOTIFICATION, title, body),
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO),
    openPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_PATH)
  },
  
  // 自动更新
  updater: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_DOWNLOAD),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_GET_STATUS),
    
    onStatusChange: (callback: (status: UpdateStatus) => void) => {
      ipcRenderer.on('updater:status-changed', (_, status) => callback(status));
      return () => ipcRenderer.removeAllListeners('updater:status-changed');
    }
  },
  
  // 数据持久化
  data: {
    save: (key: string, data: unknown) => 
      ipcRenderer.invoke(IPC_CHANNELS.DATA_SAVE, key, data),
    load: <T>(key: string) => ipcRenderer.invoke(IPC_CHANNELS.DATA_LOAD, key) as Promise<T | null>,
    delete: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.DATA_DELETE, key)
  },
  
  // 监听器
  listeners: {
    onTrayQuickMessage: (callback: () => void) => {
      ipcRenderer.on('tray:quick-message', () => callback());
      return () => ipcRenderer.removeAllListeners('tray:quick-message');
    },
    
    onTrayOpenHelp: (callback: () => void) => {
      ipcRenderer.on('tray:open-help', () => callback());
      return () => ipcRenderer.removeAllListeners('tray:open-help');
    },
    
    onTrayShowAbout: (callback: () => void) => {
      ipcRenderer.on('tray:show-about', () => callback());
      return () => ipcRenderer.removeAllListeners('tray:show-about');
    },
    
    onShortcutStopSpeech: (callback: () => void) => {
      ipcRenderer.on('shortcut:stop-speech', () => callback());
      return () => ipcRenderer.removeAllListeners('shortcut:stop-speech');
    },
    
    onShortcutToggleMute: (callback: () => void) => {
      ipcRenderer.on('shortcut:toggle-mute', () => callback());
      return () => ipcRenderer.removeAllListeners('shortcut:toggle-mute');
    },
    
    onShortcutOpenSettings: (callback: () => void) => {
      ipcRenderer.on('shortcut:open-settings', () => callback());
      return () => ipcRenderer.removeAllListeners('shortcut:open-settings');
    },
    
    onShortcutCaptureScreen: (callback: () => void) => {
      ipcRenderer.on('shortcut:capture-screen', () => callback());
      return () => ipcRenderer.removeAllListeners('shortcut:capture-screen');
    },
    
    onShortcutOpenHelp: (callback: () => void) => {
      ipcRenderer.on('shortcut:open-help', () => callback());
      return () => ipcRenderer.removeAllListeners('shortcut:open-help');
    }
  }
});

// 类型声明
interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloaded: boolean;
  progress: number;
  version: string;
  error: string | null;
}

declare global {
  interface Window {
    electronAPI: {
      window: {
        control: {
          minimize: () => Promise<void>;
          maximize: () => Promise<boolean>;
          close: () => Promise<void>;
          isMaximized: () => Promise<boolean>;
        };
        onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
      };
      fs: {
        selectVRM: () => Promise<string | null>;
        selectAudio: () => Promise<string | null>;
        saveDialog: (options: Electron.SaveDialogOptions) => Promise<string | null>;
        readLocal: (path: string) => Promise<string>;
      };
      system: {
        notify: (title: string, body: string) => Promise<void>;
        getInfo: () => Promise<Electron.SystemInfo>;
        openPath: (path: string) => Promise<void>;
      };
      updater: {
        check: () => Promise<void>;
        download: () => Promise<void>;
        getStatus: () => Promise<UpdateStatus>;
        onStatusChange: (callback: (status: UpdateStatus) => void) => () => void;
      };
      data: {
        save: (key: string, data: unknown) => Promise<void>;
        load: <T>(key: string) => Promise<T | null>;
        delete: (key: string) => Promise<void>;
      };
      listeners: {
        onTrayQuickMessage: (callback: () => void) => () => void;
        onTrayOpenHelp: (callback: () => void) => () => void;
        onTrayShowAbout: (callback: () => void) => () => void;
        onShortcutStopSpeech: (callback: () => void) => () => void;
onShortcutToggleMute: (callback: () => void) => () => void;
        onShortcutOpenSettings: (callback: () => void) => () => void;
        onShortcutCaptureScreen: (callback: () => void) => () => void;
        onShortcutOpenHelp: (callback: () => void) => () => void;
      };
    };
  }
}

console.log('预加载脚本加载完成');
