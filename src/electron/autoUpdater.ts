/**
 * AutoUpdater - 自动更新管理器
 * 使用 electron-updater 实现应用自动更新
 */
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import * as path from 'path';
import WindowManager from './windowManager';

interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

interface UpdateCheckResult {
  hasUpdate: boolean;
  version?: string;
  releaseNotes?: string;
  releaseDate?: string;
  fileUrl?: string;
}

class AutoUpdater {
  private windowManager: WindowManager | null = null;
  private isChecking: boolean = false;
  private isDownloading: boolean = false;
  private lastCheckResult: UpdateCheckResult | null = null;
  private updateInfo: UpdateInfo | null = null;

  // 更新配置
  private config = {
    /** 自动检查更新 */
    autoCheck: true,
    /** 自动下载更新 */
    autoDownload: false,
    /** 检查更新间隔（小时） */
    checkInterval: 6,
    /** 更新通道 */
    channel: 'latest',
    /** 是否允许降级 */
    allowDowngrade: false,
  };

  constructor() {
    this.setupAutoUpdater();
  }

  /**
   * 配置自动更新器
   */
  private setupAutoUpdater(): void {
    // 设置更新源
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://updates.example.com/latest',
    });

    // 监听更新事件
    autoUpdater.on('error', (error: Error) => {
      console.error('[AutoUpdater] Error:', error);
      this.sendToRenderer('update:error', { message: error.message });
      this.isChecking = false;
      this.isDownloading = false;
    });

    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for update...');
      this.isChecking = true;
      this.sendToRenderer('update:checking');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('[AutoUpdater] Update available:', info.version);
      this.updateInfo = info;
      this.lastCheckResult = {
        hasUpdate: true,
        version: info.version,
        releaseNotes: info.releaseNotes as string,
        releaseDate: info.releaseDate,
      };
      this.isChecking = false;
      this.sendToRenderer('update:available', info);
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      console.log('[AutoUpdater] Update not available');
      this.updateInfo = info;
      this.lastCheckResult = {
        hasUpdate: false,
      };
      this.isChecking = false;
      this.sendToRenderer('update:not-available', info);
    });

    autoUpdater.on('download-progress', (progress: UpdateProgress) => {
      console.log('[AutoUpdater] Download progress:', progress.percent);
      this.isDownloading = true;
      this.sendToRenderer('update:download-progress', progress);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log('[AutoUpdater] Update downloaded:', info.version);
      this.isDownloading = false;
      this.sendToRenderer('update:downloaded', info);
    });

    // 监听渲染进程的更新请求
    ipcMain.handle('update:check', () => this.checkForUpdates());
    ipcMain.handle('update:download', () => this.downloadUpdate());
    ipcMain.handle('update:install', () => this.installUpdate());
    ipcMain.handle('update:cancel', () => this.cancelUpdate());
    ipcMain.handle('update:get-status', () => this.getStatus());
  }

  /**
   * 初始化更新器
   */
  initialize(windowManager: WindowManager): void {
    this.windowManager = windowManager;

    // 立即检查更新
    if (this.config.autoCheck) {
      // 延迟检查，确保窗口已加载
      setTimeout(() => {
        this.checkForUpdates();
      }, 5000);

      // 定期检查更新
      setInterval(() => {
        if (this.config.autoCheck) {
          this.checkForUpdates();
        }
      }, this.config.checkInterval * 60 * 60 * 1000);
    }

    console.log('[AutoUpdater] Initialized');
  }

  /**
   * 检查更新
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    if (this.isChecking) {
      return { hasUpdate: false };
    }

    try {
      await autoUpdater.checkForUpdates();
      return this.lastCheckResult || { hasUpdate: false };
    } catch (error) {
      console.error('[AutoUpdater] Check failed:', error);
      return { hasUpdate: false };
    }
  }

  /**
   * 下载更新
   */
  async downloadUpdate(): Promise<boolean> {
    if (this.isDownloading) {
      return false;
    }

    try {
      await autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      console.error('[AutoUpdater] Download failed:', error);
      return false;
    }
  }

  /**
   * 安装更新
   */
  installUpdate(): void {
    // 先退出应用
    autoUpdater.quitAndInstall();
  }

  /**
   * 取消更新
   */
  cancelUpdate(): void {
    autoUpdater.logger?.info('[AutoUpdater] Update cancelled');
    this.isDownloading = false;
    this.sendToRenderer('update:cancelled');
  }

  /**
   * 获取更新状态
   */
  getStatus(): {
    isChecking: boolean;
    isDownloading: boolean;
    lastCheck: UpdateCheckResult | null;
    currentVersion: string;
    updateInfo: UpdateInfo | null;
  } {
    return {
      isChecking: this.isChecking,
      isDownloading: this.isDownloading,
      lastCheck: this.lastCheckResult,
      currentVersion: app.getVersion(),
      updateInfo: this.updateInfo,
    };
  }

  /**
   * 设置更新服务器地址
   */
  setUpdateUrl(url: string): void {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url,
    });
    console.log('[AutoUpdater] Update URL set to:', url);
  }

  /**
   * 配置自动下载
   */
  setAutoDownload(autoDownload: boolean): void {
    this.config.autoDownload = autoDownload;
  }

  /**
   * 配置自动检查
   */
  setAutoCheck(autoCheck: boolean): void {
    this.config.autoCheck = autoCheck;
  }

  /**
   * 显示更新对话框
   */
  async showUpdateDialog(): Promise<boolean> {
    if (!this.lastCheckResult?.hasUpdate) {
      return false;
    }

    const response = await dialog.showMessageBox(this.windowManager?.getMainWindow() || null, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 v${this.lastCheckResult.version}`,
      detail: `发布时间: ${this.lastCheckResult.releaseDate || '未知'}\n\n${this.lastCheckResult.releaseNotes || '暂无更新说明'}`,
      buttons: ['立即下载', '稍后提醒', '不再提醒'],
      cancelId: 1,
    });

    switch (response) {
      case 0:
        // 立即下载
        this.downloadUpdate();
        return true;
      case 1:
        // 稍后提醒
        return false;
      case 2:
        // 不再提醒
        this.setAutoCheck(false);
        return false;
    }

    return false;
  }

  /**
   * 显示下载进度对话框
   */
  showDownloadProgressDialog(progress: UpdateProgress): void {
    dialog.showMessageBox(this.windowManager?.getMainWindow() || null, {
      type: 'info',
      title: '正在下载更新',
      message: `正在下载更新 v${this.updateInfo?.version || ''}`,
      detail: `已下载: ${(progress.percent).toFixed(1)}%\n速度: ${this.formatBytes(progress.bytesPerSecond)}/s`,
      buttons: ['后台下载', '取消'],
      cancelId: 1,
    });
  }

  /**
   * 显示安装确认对话框
   */
  async showInstallDialog(): Promise<boolean> {
    const response = await dialog.showMessageBox(this.windowManager?.getMainWindow() || null, {
      type: 'info',
      title: '下载完成',
      message: '更新已下载完成',
      detail: '是否立即重启并安装更新？',
      buttons: ['立即重启', '稍后重启'],
      cancelId: 1,
    });

    return response === 0;
  }

  /**
   * 格式化字节
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 发送消息到渲染进程
   */
  private sendToRenderer(channel: string, data?: any): void {
    this.windowManager?.sendToRenderer(channel, data);
  }

  /**
   * 启用开发者模式更新（用于测试）
   */
  enableDevUpdate(): void {
    // 使用本地文件作为更新源
    const devUpdatePath = path.join(process.cwd(), 'dev-update.json');
    
    try {
      if (require('fs').existsSync(devUpdatePath)) {
        const devConfig = JSON.parse(require('fs').readFileSync(devUpdatePath, 'utf-8'));
        this.setUpdateUrl(devConfig.url || 'http://localhost:3000');
        console.log('[AutoUpdater] Dev mode enabled');
      }
    } catch (error) {
      console.warn('[AutoUpdater] No dev update config found');
    }
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(): string {
    return app.getVersion();
  }

  /**
   * 获取配置
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<typeof this.config>): void {
    Object.assign(this.config, config);
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.windowManager = null;
    console.log('[AutoUpdater] Destroyed');
  }
}

export default AutoUpdater;
