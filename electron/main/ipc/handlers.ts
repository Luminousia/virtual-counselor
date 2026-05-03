import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Notification } from 'electron';
import { windowManager, setQuitting } from '../windowManager.js';
import { IPC_CHANNELS, IPC_EVENTS } from './channels.js';
import { autoUpdaterService } from '../services/autoUpdater.js';

// 系统信息
const getSystemInfo = (): Electron.SystemInfo => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: process.getSystemVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  };
};

// 注册所有IPC处理器
export function registerIPCHandlers(): void {
  // ============ 窗口控制 ============
  
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async () => {
    windowManager.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, async () => {
    const result = windowManager.isMaximized();
    windowManager.maximize();
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async () => {
    setQuitting(true);
    const win = windowManager.mainWindow();
    if (win) {
      win.close();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, async () => {
    return windowManager.isMaximized();
  });

  // ============ 文件系统 ============

  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_VRM, async (event) => {
    const result = await dialog.showOpenDialog({
      title: '选择VRM模型文件',
      filters: [
        { name: 'VRM模型', extensions: ['vrm'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_AUDIO, async (event) => {
    const result = await dialog.showOpenDialog({
      title: '选择音频文件',
      filters: [
        { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_DIALOG, async (event, options: Electron.SaveDialogOptions) => {
    const result = await dialog.showSaveDialog(options);
    if (!result.canceled && result.filePath) {
      return result.filePath;
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.FILE_READ_LOCAL, async (event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
      throw new Error('文件不存在');
    } catch (error) {
      throw error;
    }
  });

  // ============ 系统功能 ============

  ipcMain.handle(IPC_CHANNELS.SYSTEM_NOTIFICATION, async (event, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: path.join(process.cwd(), 'resources/icons/icon.png')
      }).show();
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_INFO, async () => {
    return getSystemInfo();
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_PATH, async (event, pathToOpen: string) => {
    const { shell } = await import('electron');
    return shell.openPath(pathToOpen);
  });

  // ============ 自动更新 ============

  ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK, async () => {
    return autoUpdaterService.checkForUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_DOWNLOAD, async () => {
    return autoUpdaterService.downloadUpdate();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_GET_STATUS, async () => {
    return autoUpdaterService.getStatus();
  });

  // ============ 数据持久化 ============

  const userDataPath = process.cwd();

  ipcMain.handle(IPC_CHANNELS.DATA_SAVE, async (event, key: string, data: unknown) => {
    try {
      const filePath = path.join(userDataPath, 'data', `${key}.json`);
      const dir = path.dirname(filePath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('保存数据失败:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DATA_LOAD, async (event, key: string) => {
    try {
      const filePath = path.join(userDataPath, 'data', `${key}.json`);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      }
      return null;
    } catch (error) {
      console.error('加载数据失败:', error);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DATA_DELETE, async (event, key: string) => {
    try {
      const filePath = path.join(userDataPath, 'data', `${key}.json`);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('删除数据失败:', error);
      throw error;
    }
  });

  // 监听窗口状态变化并广播到渲染进程
  ipcMain.on(IPC_EVENTS.WINDOW_MAXIMIZED_CHANGED, (event, maximized: boolean) => {
    // 广播到所有窗口
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      win.webContents.send(IPC_EVENTS.WINDOW_MAXIMIZED_CHANGED, maximized);
    });
  });

  console.log('IPC处理器注册完成');
}
