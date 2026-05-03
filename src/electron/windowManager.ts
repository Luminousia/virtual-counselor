/**
 * WindowManager - 窗口管理器
 * 管理应用窗口的创建、状态保存和恢复
 */
import { BrowserWindow, Rectangle, screen, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isMinimized: boolean;
}

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private windowState: WindowState;
  private stateFilePath: string;

  constructor() {
    this.stateFilePath = path.join(app.getPath('userData'), 'window-state.json');
    this.windowState = this.loadState();
  }

  /**
   * 加载窗口状态
   */
  private loadState(): WindowState {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const data = fs.readFileSync(this.stateFilePath, 'utf-8');
        const state = JSON.parse(data);
        
        // 验证状态是否有效
        if (state.width >= MIN_WIDTH && state.height >= MIN_HEIGHT) {
          return state;
        }
      }
    } catch (error) {
      console.error('[WindowManager] Failed to load window state:', error);
    }
    
    return {
      x: 0,
      y: 0,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      isMaximized: false,
      isMinimized: false,
    };
  }

  /**
   * 保存窗口状态
   */
  private saveState(): void {
    if (!this.mainWindow) return;
    
    try {
      const bounds = this.mainWindow.getNormalBounds();
      this.windowState = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: this.mainWindow.isMaximized(),
        isMinimized: this.mainWindow.isMinimized(),
      };
      
      fs.writeFileSync(this.stateFilePath, JSON.stringify(this.windowState, null, 2));
    } catch (error) {
      console.error('[WindowManager] Failed to save window state:', error);
    }
  }

  /**
   * 获取工作区中心位置
   */
  private getCenterPosition(width: number, height: number): { x: number; y: number } {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    return {
      x: Math.floor((screenWidth - width) / 2),
      y: Math.floor((screenHeight - height) / 2),
    };
  }

  /**
   * 创建主窗口
   */
  createMainWindow(): BrowserWindow {
    const { width, height } = this.windowState;
    const { x, y } = this.getCenterPosition(width, height);

    this.mainWindow = new BrowserWindow({
      width: this.windowState.isMaximized ? DEFAULT_WIDTH : width,
      height: this.windowState.isMaximized ? DEFAULT_HEIGHT : height,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      x: this.windowState.isMaximized ? x : this.windowState.x || x,
      y: this.windowState.isMaximized ? y : this.windowState.y || y,
      frame: false,
      transparent: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
      alwaysOnTop: false,
      fullscreenable: true,
      title: '数字人助手',
      icon: path.join(__dirname, '../../resources/icon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/preload.js'),
        spellcheck: false,
        devTools: !app.isPackaged,
      },
      backgroundColor: '#1a1a2e',
      show: false,
    });

    // 窗口就绪后显示
    this.mainWindow.once('ready-to-show', () => {
      if (this.windowState.isMaximized) {
        this.mainWindow?.maximize();
      }
      this.mainWindow?.show();
      this.mainWindow?.focus();
    });

    // 窗口关闭前保存状态
    this.mainWindow.on('close', () => {
      this.saveState();
    });

    // 窗口大小变化时保存状态
    this.mainWindow.on('resize', () => {
      this.saveState();
    });

    // 窗口移动时保存状态
    this.mainWindow.on('move', () => {
      this.saveState();
    });

    // 最大化状态变化时保存
    this.mainWindow.on('maximize', () => {
      this.saveState();
    });

    this.mainWindow.on('unmaximize', () => {
      this.saveState();
    });

    return this.mainWindow;
  }

  /**
   * 加载应用页面
   */
  async loadApp(): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('Window not created');
    }

    const isDev = !app.isPackaged;
    
    if (isDev) {
      // 开发环境
      await this.mainWindow.loadURL('http://localhost:5173');
      // 打开 DevTools
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      // 生产环境
      await this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
  }

  /**
   * 获取主窗口实例
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * 最小化窗口
   */
  minimize(): void {
    this.mainWindow?.minimize();
  }

  /**
   * 最大化窗口
   */
  maximize(): void {
    if (this.mainWindow?.isMaximized()) {
      this.mainWindow.unmaximize();
    } else {
      this.mainWindow?.maximize();
    }
  }

  /**
   * 关闭窗口
   */
  close(): void {
    this.mainWindow?.close();
  }

  /**
   * 隐藏窗口
   */
  hide(): void {
    this.mainWindow?.hide();
  }

  /**
   * 显示窗口
   */
  show(): void {
    this.mainWindow?.show();
  }

  /**
   * 恢复窗口
   */
  restore(): void {
    if (this.mainWindow?.isMinimized()) {
      this.mainWindow.restore();
    }
    this.mainWindow?.show();
  }

  /**
   * 聚焦窗口
   */
  focus(): void {
    this.mainWindow?.focus();
  }

  /**
   * 设置窗口标题
   */
  setTitle(title: string): void {
    this.mainWindow?.setTitle(title);
  }

  /**
   * 设置窗口始终在最前
   */
  setAlwaysOnTop(flag: boolean): void {
    this.mainWindow?.setAlwaysOnTop(flag, 'normal');
  }

  /**
   * 设置窗口进度（用于任务栏进度显示）
   */
  setProgress(progress: number): void {
    if (process.platform === 'win32') {
      this.mainWindow?.setProgressBar(progress);
    }
  }

  /**
   * 获取窗口是否最大化
   */
  isMaximized(): boolean {
    return this.mainWindow?.isMaximized() || false;
  }

  /**
   * 获取窗口是否最小化
   */
  isMinimized(): boolean {
    return this.mainWindow?.isMinimized() || false;
  }

  /**
   * 获取窗口焦点状态
   */
  isFocused(): boolean {
    return this.mainWindow?.isFocused() || false;
  }

  /**
   * 发送消息到渲染进程
   */
  sendToRenderer(channel: string, data?: any): void {
    this.mainWindow?.webContents.send(channel, data);
  }

  /**
   * 执行 JavaScript 在渲染进程中
   */
  executeJavaScript(code: string): Promise<any> {
    return this.mainWindow?.webContents.executeJavaScript(code) || Promise.reject('No window');
  }

  /**
   * 获取窗口状态
   */
  getState(): WindowState {
    return { ...this.windowState };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.saveState();
    this.mainWindow?.destroy();
    this.mainWindow = null;
  }
}

export default WindowManager;
