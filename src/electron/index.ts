/**
 * Electron Modules Export
 * 导出所有 Electron 主进程模块
 */

// 窗口管理
export { default as WindowManager } from './windowManager';

// 系统托盘
export { default as TrayManager } from './trayManager';

// 全局快捷键
export { default as ShortcutManager } from './shortcutManager';

// 自动更新
export { default as AutoUpdater } from './autoUpdater';

// 主进程入口
export { default as main } from './main';

// Preload 脚本
export { default as preload } from './preload';

// 类型导出
export type { WindowState } from './windowManager';
export type { TrayConfig } from './trayManager';
export type { ShortcutConfig, ShortcutAction } from './shortcutManager';
export type { UpdateProgress, UpdateCheckResult } from './autoUpdater';
