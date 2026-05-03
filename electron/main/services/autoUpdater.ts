import { autoUpdater, UpdateInfo } from 'electron-updater';
import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS, IPC_EVENTS } from '../ipc/channels.js';

interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloaded: boolean;
  progress: number;
  version: string;
  error: string | null;
}

class AutoUpdaterService {
  private updater: autoUpdater;
  private status: UpdateStatus;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.updater = new autoUpdater();
    this.status = {
      checking: false,
      available: false,
      downloaded: false,
      progress: 0,
      version: '',
      error: null
    };

    this.setupAutoUpdater();
  }

  private setupAutoUpdater(): void {
    // 设置更新URL
    // TODO: 替换为实际的更新服务器地址
    // this.updater.setFeedURL('https://your-update-server.com');

    // 检查更新事件
    this.updater.on('checking-for-update', () => {
      this.status.checking = true;
      this.status.error = null;
      this.broadcastStatus();
      console.log('正在检查更新...');
    });

    this.updater.on('update-available', (info: UpdateInfo) => {
      this.status.available = true;
      this.status.version = info.version;
      this.status.checking = false;
      this.broadcastStatus();
      console.log(`发现新版本: ${info.version}`);
    });

    this.updater.on('update-not-available', (info: UpdateInfo) => {
      this.status.available = false;
      this.status.version = info.version;
      this.status.checking = false;
      this.broadcastStatus();
      console.log('当前版本已是最新');
    });

    this.updater.on('error', (err: Error) => {
      this.status.error = err.message;
      this.status.checking = false;
      this.broadcastStatus();
      console.error('更新检查失败:', err);
    });

    this.updater.on('download-progress', (progressObj: { percent: number }) => {
      this.status.progress = progressObj.percent;
      this.broadcastStatus();
      console.log(`下载进度: ${progressObj.percent.toFixed(2)}%`);
    });

    this.updater.on('update-downloaded', (info: UpdateInfo) => {
      this.status.downloaded = true;
      this.status.progress = 100;
      this.broadcastStatus();
      console.log(`更新下载完成: ${info.version}`);
      
      // 显示下载完成通知
      this.showNotification('更新下载完成', `版本 ${info.version} 已下载，将在下一次启动时安装`);
    });
  }

  // 设置主窗口引用
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  // 广播状态到渲染进程
  private broadcastStatus(): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(
        IPC_EVENTS.UPDATER_STATUS_CHANGED,
        { ...this.status }
      );
    }
  }

  // 显示系统通知
  private showNotification(title: string, body: string): void {
    const { Notification } = await import('electron');
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: './resources/icons/icon.png'
      }).show();
    }
  }

  // 检查更新
  async checkForUpdates(): Promise<void> {
    try {
      if (this.status.checking) {
        console.log('正在检查更新中...');
        return;
      }
      
      await this.updater.checkForUpdates();
    } catch (error) {
      console.error('检查更新失败:', error);
      this.status.error = (error as Error).message;
      this.broadcastStatus();
    }
  }

  // 下载更新
  async downloadUpdate(): Promise<void> {
    try {
      if (!this.status.available || this.status.downloaded) {
        console.log('无需下载更新');
        return;
      }
      
      await this.updater.downloadUpdate();
    } catch (error) {
      console.error('下载更新失败:', error);
      this.status.error = (error as Error).message;
      this.broadcastStatus();
    }
  }

  // 安装更新
  quitAndInstall(): void {
    this.updater.quitAndInstall();
  }

  // 获取当前状态
  getStatus(): UpdateStatus {
    return { ...this.status };
  }

  // 获取当前版本
  getCurrentVersion(): string {
    return this.updater.currentVersion;
  }
}

// 导出单例
export const autoUpdaterService = new AutoUpdaterService();
