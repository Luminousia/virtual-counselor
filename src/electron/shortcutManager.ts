/**
 * ShortcutManager - 全局快捷键管理器
 * 注册和管理全局快捷键
 */
import { globalShortcut, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface ShortcutConfig {
  /** 快捷键名称 */
  name: string;
  /** 快捷键组合 */
  accelerator: string;
  /** 快捷键描述 */
  description?: string;
  /** 是否启用 */
  enabled?: boolean;
}

interface ShortcutAction {
  (): void;
}

class ShortcutManager {
  private windowManager: BrowserWindow | null = null;
  private shortcuts: Map<string, string> = new Map();
  private customShortcuts: ShortcutConfig[] = [];
  private configFilePath: string;

  constructor() {
    this.configFilePath = path.join(process.cwd(), 'shortcuts.json');
    this.loadCustomShortcuts();
  }

  /**
   * 加载自定义快捷键配置
   */
  private loadCustomShortcuts(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const data = fs.readFileSync(this.configFilePath, 'utf-8');
        this.customShortcuts = JSON.parse(data);
      }
    } catch (error) {
      console.warn('[ShortcutManager] Failed to load custom shortcuts:', error);
    }
  }

  /**
   * 保存自定义快捷键配置
   */
  private saveCustomShortcuts(): void {
    try {
      fs.writeFileSync(
        this.configFilePath,
        JSON.stringify(this.customShortcuts, null, 2)
      );
    } catch (error) {
      console.error('[ShortcutManager] Failed to save custom shortcuts:', error);
    }
  }

  /**
   * 初始化快捷键管理器
   */
  initialize(windowManager: BrowserWindow): void {
    this.windowManager = windowManager;
    this.registerDefaultShortcuts();
    this.registerCustomShortcuts();
    
    console.log('[ShortcutManager] Initialized');
  }

  /**
   * 注册默认快捷键
   */
  private registerDefaultShortcuts(): void {
    // 显示/隐藏窗口
    this.register('toggle-window', 'CommandOrControl+Shift+M', '显示/隐藏窗口', () => {
      this.handleToggleWindow();
    });

    // 停止语音（播放时）
    this.register('stop-speech', 'CommandOrControl+Escape', '停止语音播放', () => {
      this.sendToRenderer('shortcut:stop-speech');
    });

    // 语音输入
    this.register('voice-input', 'CommandOrControl+Shift+V', '快速语音输入', () => {
      this.handleVoiceInput();
    });

    // 截图
    this.register('screenshot', 'CommandOrControl+Shift+S', '截图', () => {
      this.sendToRenderer('shortcut:screenshot');
    });

    // 截屏翻译
    this.register('ocr-translate', 'CommandOrControl+Shift+T', '截屏翻译', () => {
      this.sendToRenderer('shortcut:ocr-translate');
    });

    // 打开设置
    this.register('settings', 'CommandOrControl+,', '打开设置', () => {
      this.sendToRenderer('shortcut:open-settings');
    });

    // 刷新页面（开发用）
    this.register('reload', 'CommandOrControl+R', '刷新页面', () => {
      this.windowManager?.reload();
    });

    // 打开开发者工具
    this.register('devtools', 'CommandOrControl+Shift+I', '开发者工具', () => {
      this.windowManager?.webContents.toggleDevTools();
    });

    // 最小化
    this.register('minimize', 'CommandOrControl+Shift+-', '最小化', () => {
      this.windowManager?.minimize();
    });

    // 最大化
    this.register('maximize', 'CommandOrControl+Shift+=', '最大化', () => {
      if (this.windowManager?.isMaximized()) {
        this.windowManager?.unmaximize();
      } else {
        this.windowManager?.maximize();
      }
    });
  }

  /**
   * 注册自定义快捷键
   */
  private registerCustomShortcuts(): void {
    this.customShortcuts.forEach((config) => {
      if (config.enabled !== false) {
        this.register(config.name, config.accelerator, config.description, () => {
          this.sendToRenderer('shortcut:custom', { name: config.name });
        });
      }
    });
  }

  /**
   * 注册快捷键
   */
  register(
    name: string,
    accelerator: string,
    description?: string,
    action?: ShortcutAction
  ): boolean {
    // 先注销旧快捷键
    this.unregister(name);

    // 注册新快捷键
    const success = globalShortcut.register(accelerator, () => {
      console.log(`[ShortcutManager] Shortcut triggered: ${accelerator}`);
      
      // 执行回调
      action?.();
      
      // 发送事件到渲染进程
      this.sendToRenderer('shortcut:triggered', { name, accelerator });
    });

    if (success) {
      this.shortcuts.set(name, accelerator);
      console.log(`[ShortcutManager] Registered: ${accelerator} (${name})`);
    } else {
      console.error(`[ShortcutManager] Failed to register: ${accelerator}`);
    }

    return success;
  }

  /**
   * 注销快捷键
   */
  unregister(name: string): void {
    const accelerator = this.shortcuts.get(name);
    if (accelerator) {
      globalShortcut.unregister(accelerator);
      this.shortcuts.delete(name);
      console.log(`[ShortcutManager] Unregistered: ${name}`);
    }
  }

  /**
   * 注销所有快捷键
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.shortcuts.clear();
    console.log('[ShortcutManager] All shortcuts unregistered');
  }

  /**
   * 检查快捷键是否已注册
   */
  isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }

  /**
   * 获取所有已注册的快捷键
   */
  getRegisteredShortcuts(): { name: string; accelerator: string }[] {
    const result: { name: string; accelerator: string }[] = [];
    
    this.shortcuts.forEach((accelerator, name) => {
      result.push({ name, accelerator });
    });
    
    return result;
  }

  /**
   * 添加自定义快捷键
   */
  addCustomShortcut(config: ShortcutConfig): boolean {
    // 检查是否冲突
    if (this.isRegistered(config.accelerator)) {
      console.warn(`[ShortcutManager] Accelerator already registered: ${config.accelerator}`);
      return false;
    }

    // 添加到配置
    this.customShortcuts.push(config);
    this.saveCustomShortcuts();

    // 注册快捷键
    if (config.enabled !== false) {
      return this.register(config.name, config.accelerator, config.description, () => {
        this.sendToRenderer('shortcut:custom', { name: config.name });
      });
    }

    return true;
  }

  /**
   * 移除自定义快捷键
   */
  removeCustomShortcut(name: string): boolean {
    const index = this.customShortcuts.findIndex((s) => s.name === name);
    if (index === -1) return false;

    // 注销快捷键
    this.unregister(name);

    // 从配置中移除
    this.customShortcuts.splice(index, 1);
    this.saveCustomShortcuts();

    return true;
  }

  /**
   * 更新自定义快捷键
   */
  updateCustomShortcut(name: string, updates: Partial<ShortcutConfig>): boolean {
    const index = this.customShortcuts.findIndex((s) => s.name === name);
    if (index === -1) return false;

    // 如果 accelerator 改变，需要重新注册
    if (updates.accelerator && updates.accelerator !== this.customShortcuts[index].accelerator) {
      this.unregister(name);
      
      const newConfig = { ...this.customShortcuts[index], ...updates };
      this.customShortcuts[index] = newConfig;
      this.saveCustomShortcuts();

      if (newConfig.enabled !== false) {
        return this.register(newConfig.name, newConfig.accelerator, newConfig.description, () => {
          this.sendToRenderer('shortcut:custom', { name: newConfig.name });
        });
      }
    } else {
      this.customShortcuts[index] = { ...this.customShortcuts[index], ...updates };
      this.saveCustomShortcuts();
    }

    return true;
  }

  /**
   * 获取自定义快捷键列表
   */
  getCustomShortcuts(): ShortcutConfig[] {
    return [...this.customShortcuts];
  }

  /**
   * 处理窗口切换
   */
  private handleToggleWindow(): void {
    if (this.windowManager?.isVisible()) {
      if (this.windowManager?.isFocused()) {
        this.windowManager?.hide();
      } else {
        this.windowManager?.show();
        this.windowManager?.focus();
      }
    } else {
      this.windowManager?.show();
      this.windowManager?.focus();
    }
  }

  /**
   * 处理语音输入
   */
  private handleVoiceInput(): void {
    this.windowManager?.show();
    this.windowManager?.focus();
    this.sendToRenderer('shortcut:voice-input');
  }

  /**
   * 发送消息到渲染进程
   */
  private sendToRenderer(channel: string, data?: any): void {
    this.windowManager?.webContents.send(channel, data);
  }

  /**
   * 检查快捷键冲突
   */
  checkConflicts(accelerator: string): string[] {
    const conflicts: string[] = [];
    
    this.shortcuts.forEach((acc, name) => {
      if (acc === accelerator) {
        conflicts.push(name);
      }
    });

    // 检查系统快捷键
    const systemShortcuts = ['CommandOrControl+C', 'CommandOrControl+V', 'CommandOrControl+A'];
    if (systemShortcuts.includes(accelerator)) {
      conflicts.push('System shortcut');
    }

    return conflicts;
  }

  /**
   * 获取快捷键帮助文本
   */
  getHelpText(): string {
    const lines: string[] = ['=== 快捷键帮助 ==='];
    
    this.shortcuts.forEach((accelerator, name) => {
      lines.push(`${name.padEnd(20)} ${accelerator}`);
    });
    
    return lines.join('\n');
  }

  /**
   * 打印快捷键帮助
   */
  printHelp(): void {
    console.log(this.getHelpText());
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.unregisterAll();
    this.shortcuts.clear();
    this.customShortcuts = [];
    console.log('[ShortcutManager] Destroyed');
  }
}

export default ShortcutManager;
