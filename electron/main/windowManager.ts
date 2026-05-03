import { BrowserWindow, screen, Rectangle } from 'electron';
import * as path from 'path';

const isDev = process.env.NODE_ENV === 'development';

// 窗口状态
interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

let mainWindow: BrowserWindow | null = null;
let windowState: WindowState = {
  x: 0,
  y: 0,
  width: 1400,
  height: 900,
  isMaximized: false
};

// 从本地存储加载窗口状态
function loadWindowState(): WindowState {
  try {
    const savedState = localStorage.getItem('windowState');
    if (savedState) {
      return JSON.parse(savedState);
    }
  } catch (e) {
    console.warn('无法加载窗口状态', e);
  }
  return windowState;
}

// 保存窗口状态
function saveWindowState(): void {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    windowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized()
    };
    
    try {
      localStorage.setItem('windowState', JSON.stringify(windowState));
    } catch (e) {
      console.warn('无法保存窗口状态', e);
    }
  }
}

// 创建主窗口
export function createWindow(): BrowserWindow {
  // 加载保存的窗口状态
  windowState = loadWindowState();

  // 获取屏幕尺寸
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // 确保窗口在屏幕范围内
  if (windowState.x < 0 || windowState.x > width) {
    windowState.x = Math.floor((width - windowState.width) / 2);
  }
  if (windowState.y < 0 || windowState.y > height) {
    windowState.y = Math.floor((height - windowState.height) / 2);
  }

  // 计算DPI缩放
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
  const adjustedWidth = Math.floor(windowState.width * scaleFactor);
  const adjustedHeight = Math.floor(windowState.height * scaleFactor);

  mainWindow = new BrowserWindow({
    x: Math.floor(windowState.x * scaleFactor),
    y: Math.floor(windowState.y * scaleFactor),
    width: adjustedWidth,
    height: adjustedHeight,
    minWidth: 1200,
    minHeight: 700,
    frame: false,
    show: false,
    backgroundColor: '#fef9f3',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#fef9f3',
      symbolColor: '#ff7043',
      height: 40
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../../preload/dist/index.cjs'),
      spellcheck: true,
      devTools: isDev
    },
    icon: path.join(__dirname, '../../resources/icons/icon.ico'),
    trafficLightPosition: { x: 16, y: 10 },
    autoHideMenuBar: true
  });

  // 加载应用
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../../dist/index.html')}`;
  mainWindow.loadURL(startUrl);

  // 显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
    
    // 如果之前是最大化状态
    if (windowState.isMaximized) {
      mainWindow?.maximize();
    }
  });

  // 保存窗口状态
  mainWindow.on('move', () => {
    if (!mainWindow?.isMinimized() && !mainWindow?.isMaximized()) {
      saveWindowState();
    }
  });

  mainWindow.on('resize', () => {
    if (!mainWindow?.isMinimized() && !mainWindow?.isMaximized()) {
      saveWindowState();
    }
  });

  // 最大化切换
  mainWindow.on('maximize', () => {
    windowState.isMaximized = true;
    saveWindowState();
    mainWindow?.webContents.send('window:maximized-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    windowState.isMaximized = false;
    saveWindowState();
    mainWindow?.webContents.send('window:maximized-changed', false);
  });

  // 关闭处理
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      saveWindowState();
      mainWindow?.hide();
      app.dock?.hide();
    }
  });

  return mainWindow;
}

// 窗口管理器
export const windowManager = {
  mainWindow: (): BrowserWindow | null => mainWindow,
  
  show: (): void => {
    mainWindow?.show();
    mainWindow?.focus();
  },
  
  hide: (): void => {
    mainWindow?.hide();
  },
  
  minimize: (): void => {
    mainWindow?.minimize();
  },
  
  maximize: (): void => {
    if (windowState.isMaximized) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  },
  
  close: (): void => {
    mainWindow?.close();
  },
  
  isMaximized: (): boolean => {
    return windowState.isMaximized;
  },
  
  setProgressBar: (value: number): void => {
    if (process.platform === 'linux') {
      mainWindow?.setProgressBar(value);
    }
  },
  
  flashFrame: (flash: boolean): void => {
    mainWindow?.flashFrame(flash);
  },
  
  setTitle: (title: string): void => {
    mainWindow?.setTitle(title);
  }
};

// 全局引用
export let isQuitting = false;

export function setQuitting(value: boolean): void {
  isQuitting = value;
}
