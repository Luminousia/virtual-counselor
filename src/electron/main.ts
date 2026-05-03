/**
 * Main Process - 应用主入口
 * Electron 主进程入口文件
 */
import { app, BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent, Menu, shell, Notification } from 'electron';
import * as path from 'path';
import WindowManager from './windowManager';
import TrayManager from './trayManager';
import ShortcutManager from './shortcutManager';
import Store from 'electron-store';

// ========== 单例锁 ==========
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// ========== 实例管理器 ==========
let windowManager: WindowManager | null = null;
let trayManager: TrayManager | null = null;
let shortcutManager: ShortcutManager | null = null;
let isQuitting = false;

// ========== 持久化存储 ==========
const store = new Store({
  name: 'app-settings',
  defaults: {
    window: {
      width: 1200,
      height: 800,
      isMaximized: false,
    },
    app: {
      language: 'zh-CN',
      theme: 'dark',
      autoStart: false,
    },
    voice: {
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      language: 'zh-CN',
    },
    shortcuts: [],
  },
});

// ========== 窗口管理 ==========
function createWindow(): void {
  windowManager = new WindowManager();
  const mainWindow = windowManager.createMainWindow();

  windowManager.loadApp().catch((error) => {
    console.error('Failed to load app:', error);
    app.quit();
  });

  mainWindow.on('closed', () => {
    windowManager = null;
  });
}

// ========== 托盘管理 ==========
function createTray(): void {
  trayManager = new TrayManager({
    tooltip: '数字人助手',
    showQuitItem: true,
  });
  trayManager.createTray(windowManager!);
}

// ========== 快捷键管理 ==========
function createShortcuts(): void {
  shortcutManager = new ShortcutManager();
  shortcutManager.initialize(windowManager!.getMainWindow()!);
}

// ========== IPC 处理器 ==========
ipcMain.on('window:minimize', () => windowManager?.minimize());
ipcMain.on('window:maximize', () => windowManager?.maximize());
ipcMain.on('window:close', () => windowManager?.close());
ipcMain.on('window:restore', () => windowManager?.restore());
ipcMain.on('window:focus', () => windowManager?.focus());
ipcMain.on('window:hide', () => windowManager?.hide());
ipcMain.on('window:show', () => windowManager?.show());

ipcMain.handle('system:platform', () => process.platform);
ipcMain.handle('system:version', () => process.getSystemVersion());
ipcMain.handle('system:arch', () => process.arch);

ipcMain.handle('system:memory', async () => {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    external: memUsage.external,
  };
});

ipcMain.handle('system:open-external', async (_event: IpcMainInvokeEvent, url: string) => {
  shell.openExternal(url);
});

ipcMain.handle('app:get-path', (_event: IpcMainInvokeEvent, name: any) => {
  return app.getPath(name);
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.on('app:quit', () => app.quit());

ipcMain.on('app:activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    windowManager?.show();
    windowManager?.focus();
  }
});

// 存储操作
ipcMain.handle('store:get', (_event: IpcMainInvokeEvent, payload: { key: string; defaultValue?: any }) => {
  return store.get(payload.key, payload.defaultValue);
});

ipcMain.on('store:set', (_event: IpcMainEvent, payload: { key: string; value: any }) => {
  store.set(payload.key, payload.value);
});

ipcMain.on('store:delete', (_event: IpcMainEvent, key: string) => {
  store.delete(key);
});

ipcMain.handle('store:has', (_event: IpcMainInvokeEvent, key: string) => {
  return store.has(key);
});

ipcMain.handle('store:keys', () => store.keys());
ipcMain.on('store:clear', () => store.clear());

// 快捷键
ipcMain.handle('shortcut:register', (_event: IpcMainInvokeEvent, payload: { name: string; accelerator: string }) => {
  return shortcutManager?.register(payload.name, payload.accelerator);
});

ipcMain.on('shortcut:unregister', (_event: IpcMainEvent, name: string) => {
  shortcutManager?.unregister(name);
});

ipcMain.handle('shortcut:get-all', () => {
  return shortcutManager?.getRegisteredShortcuts() || [];
});

ipcMain.on('shortcut:triggered', (event: IpcMainEvent, name: string) => {
  event.sender.send('shortcut:triggered', name);
});

// 剪贴板
ipcMain.handle('clipboard:text', () => {
  const { clipboard } = require('electron');
  return clipboard.readText();
});

ipcMain.on('clipboard:text', (_event: IpcMainEvent, text: string) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
});

// 通知
ipcMain.on('notification:show', (_event: IpcMainEvent, payload: { title: string; body: string }) => {
  if (Notification.isSupported()) {
    new Notification({
      title: payload.title,
      body: payload.body,
    }).show();
  }
});

// 快捷键触发转发
ipcMain.on('shortcut:voice-input', () => {
  windowManager?.sendToRenderer('voice-input:start');
});

// 日志
ipcMain.on('log:info', (_event: IpcMainEvent, message: string) => {
  console.log(`[Renderer] ${message}`);
});

// ========== 应用事件 ==========
app.whenReady().then(() => {
  console.log('App ready');
  createWindow();
  createTray();
  createShortcuts();
  createApplicationMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    windowManager?.show();
    windowManager?.focus();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  trayManager?.setQuitting(true);
  shortcutManager?.destroy();
  trayManager?.destroy();
  windowManager?.destroy();
});

// ========== 应用菜单 ==========
function createApplicationMenu(): void {
  const template: any[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

console.log('='.repeat(50));
console.log('Digital Human Assistant');
console.log(`Version: ${app.getVersion()}`);
console.log(`Platform: ${process.platform}`);
console.log('='.repeat(50));
