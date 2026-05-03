import { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 导入模块
import { createWindow, windowManager } from './windowManager.js';
import { registerIPCHandlers } from './ipc/handlers.js';
import { createTray } from '../plugins/tray.js';
import { registerShortcuts } from '../plugins/shortcut.js';
import { autoUpdaterService } from '../services/autoUpdater.js';

let tray: Tray | null = null;
let isQuitting = false;

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 开发模式判断
const isDev = process.env.NODE_ENV === 'development';

async function initializeApp() {
  // 等待应用准备就绪
  await app.whenReady();

  // 创建主窗口
  createWindow();

  // 注册IPC通信
  registerIPCHandlers();

  // 创建系统托盘
  tray = createTray();

  // 注册全局快捷键
  registerShortcuts();

  // 启动自动更新检查（非开发模式）
  if (!isDev) {
    autoUpdaterService.checkForUpdates();
  }

  // 平台特定优化
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, '../../resources/icons/icon.icns'));
  }

  console.log('应用初始化完成');
}

// 创建窗口
function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
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
    mainWindow.show();
    mainWindow.focus();
  });

  // 窗口事件处理
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      app.dock?.hide();
    }
  });

  return mainWindow;
}

// 应用事件监听
app.whenReady().then(() => {
  createMainWindow();
  registerIPCHandlers();
  tray = createTray();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      windowManager.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 当第二个实例启动时，显示第一个实例的窗口
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length > 0) {
      allWindows[0].show();
      allWindows[0].focus();
    }
  });
}

export { createMainWindow };
