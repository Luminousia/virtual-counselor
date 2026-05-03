/**
 * TrayManager - 系统托盘管理器
 * 管理应用在系统托盘中的图标和菜单
 */
import { app, Tray, Menu, MenuItem, nativeImage, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import WindowManager from './windowManager';

interface TrayConfig {
  /** 托盘图标路径 */
  iconPath?: string;
  /** 托盘悬停提示 */
  tooltip?: string;
  /** 是否显示退出选项 */
  showQuitItem?: boolean;
}

class TrayManager {
  private tray: Tray | null = null;
  private windowManager: WindowManager | null = null;
  private config: TrayConfig;
  private isQuitting: boolean = false;

  constructor(config: TrayConfig = {}) {
    this.config = {
      iconPath: path.join(__dirname, '../../resources/tray-icon.png'),
      tooltip: '数字人助手',
      showQuitItem: true,
      ...config,
    };
  }

  /**
   * 创建托盘图标
   */
  createTray(windowManager: WindowManager): Tray {
    this.windowManager = windowManager;

    // 创建图标
    const icon = this.createTrayIcon();
    this.tray = new Tray(icon);

    // 设置提示文本
    this.tray.setToolTip(this.config.tooltip || '数字人助手');

    // 构建上下文菜单
    this.updateContextMenu();

    // 处理托盘点击事件
    this.tray.on('click', () => {
      this.handleTrayClick();
    });

    // 处理托盘双击事件
    this.tray.on('double-click', () => {
      this.handleTrayDoubleClick();
    });

    // 处理右键点击
    this.tray.on('right-click', () => {
      this.updateContextMenu();
      this.tray?.popUpContextMenu();
    });

    console.log('[TrayManager] Tray created');
    return this.tray;
  }

  /**
   * 创建托盘图标
   */
  private createTrayIcon(): Electron.NativeImage {
    try {
      // 尝试加载自定义图标
      if (this.config.iconPath) {
        const image = nativeImage.createFromPath(this.config.iconPath);
        if (!image.isEmpty()) {
          return image.resize({ width: 16, height: 16 });
        }
      }
    } catch (error) {
      console.warn('[TrayManager] Failed to load custom icon:', error);
    }

    // 创建默认图标
    return this.createDefaultIcon();
  }

  /**
   * 创建默认托盘图标
   */
  private createDefaultIcon(): Electron.NativeImage {
    const canvas = {
      width: 16,
      height: 16,
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAhGVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABAAAAAEAAABaAAAAAAAAAEgAAAABAAAASAAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAAEAAAAABwuG7lAAAACXBIWXMAAAsTAAALEwEAmpwYAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj43MjwvdGlmZjpZUmVzb2x1dGlvbj4KICAgICAgICAgPHRpZmY6UmVzb2x1dGlvblVuaXQ+MjwvdGlmZjpSZXNvbHV0aW9uVW5pdD4KICAgICAgICAgPHRpZmY6WFJlc29sdXRpb24+NzI8L3RpZmY6WFJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWERpbWVuc2lvbj4yNjY8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+MjY2PC9leGlmOlBpeGVsFlEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOkNvbG9yU3BhY2U+MTwvZXhpZjpDb2xvclNwYWNlPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KSfKDyQAAAM1JREFUOBFjYBgFKwA1TRN0zQE20jA0AA12YkAD1AA2GINttIE2wA2wA2wCDbABbogdYAMYIGcH2AAGyDkCdoABco6AHaCjZwdYAAbIOQJ2gI6eHWABGCDnCNgBOnp2gAVggJwjYAfouAF2gA3QAy5gBxgg5wjYAToo2AEGyDkCdoCBnB1gARgg5wjYATpydoAFYICcI2AH6MjZARaAAXKOgB2gI2cHWAAA9H8AAAD//y2k8M2oAAAAAElFTkSuQmCC',
    };
    
    return nativeImage.createFromDataURL(canvas.toDataURL());
  }

  /**
   * 更新上下文菜单
   */
  updateContextMenu(): void {
    const menu = new Menu();

    // 显示窗口菜单项
    menu.append(new MenuItem({
      label: '显示窗口',
      click: () => this.windowManager?.show(),
    }));

    // 隐藏窗口菜单项
    menu.append(new MenuItem({
      label: '隐藏到托盘',
      click: () => this.windowManager?.hide(),
    }));

    // 分隔线
    menu.append(new MenuItem({
      type: 'separator',
    }));

    // 语音输入快捷菜单
    menu.append(new MenuItem({
      label: '🎤 语音输入',
      click: () => {
        this.windowManager?.show();
        this.windowManager?.focus();
        this.windowManager?.sendToRenderer('voice-input:start');
      },
    }));

    // 分隔线
    menu.append(new MenuItem({
      type: 'separator',
    }));

    // 退出菜单项
    if (this.config.showQuitItem) {
      menu.append(new MenuItem({
        label: '退出',
        click: () => this.quit(),
      }));
    }

    // 设置菜单
    this.tray?.setContextMenu(menu);
  }

  /**
   * 处理托盘单击
   */
  private handleTrayClick(): void {
    if (this.windowManager?.isMinimized()) {
      this.windowManager.restore();
    } else if (!this.windowManager?.isFocused()) {
      this.windowManager?.show();
      this.windowManager?.focus();
    } else {
      this.windowManager?.minimize();
    }
  }

  /**
   * 处理托盘双击
   */
  private handleTrayDoubleClick(): void {
    this.windowManager?.show();
    this.windowManager?.focus();
  }

  /**
   * 设置退出标志
   */
  setQuitting(quitting: boolean): void {
    this.isQuitting = quitting;
  }

  /**
   * 退出应用
   */
  async quit(): Promise<void> {
    this.isQuitting = true;
    
    // 发送退出前事件到渲染进程
    this.windowManager?.sendToRenderer('app:before-quit');
    
    // 延迟退出，等待渲染进程处理
    setTimeout(() => {
      app.quit();
    }, 500);
  }

  /**
   * 更新托盘提示
   */
  setTooltip(tooltip: string): void {
    this.tray?.setToolTip(tooltip);
  }

  /**
   * 更新托盘图标
   */
  setIcon(iconPath: string): void {
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        this.tray?.setImage(icon.resize({ width: 16, height: 16 }));
      }
    } catch (error) {
      console.error('[TrayManager] Failed to set icon:', error);
    }
  }

  /**
   * 显示通知
   */
  showNotification(title: string, body: string): void {
    // 在托盘上显示通知提示
    this.setTooltip(`${title}\n${body}`);
    
    // 3秒后恢复原始提示
    setTimeout(() => {
      this.setTooltip(this.config.tooltip || '数字人助手');
    }, 3000);
  }

  /**
   * 获取托盘实例
   */
  getTray(): Tray | null {
    return this.tray;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    this.windowManager = null;
    console.log('[TrayManager] Tray destroyed');
  }
}

export default TrayManager;
