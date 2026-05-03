import { globalShortcut, app } from 'electron';
import { windowManager } from '../main/windowManager.js';

// 注册全局快捷键
export function registerShortcuts(): void {
  // 最小化窗口：Ctrl+Shift+M
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    windowManager.minimize();
  });

  // 最大化/还原窗口：Ctrl+Shift+F
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    windowManager.maximize();
  });

  // 显示/隐藏窗口：Ctrl+Shift+H
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    const win = windowManager.mainWindow();
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        windowManager.show();
      }
    }
  });

  // 停止语音：Escape
  globalShortcut.register('Escape', () => {
    // 发送停止语音事件到渲染进程
    const win = windowManager.mainWindow();
    if (win) {
      win.webContents.send('shortcut:stop-speech');
    }
  });

  // 静音/取消静音：Ctrl+Shift+S
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    const win = windowManager.mainWindow();
    if (win) {
      win.webContents.send('shortcut:toggle-mute');
    }
  });

  // 打开设置：Ctrl+Shift+, 
  globalShortcut.register('CommandOrControl+Shift+,', () => {
    const win = windowManager.mainWindow();
    if (win) {
      win.webContents.send('shortcut:open-settings');
    }
  });

  // 截屏保存：Ctrl+Shift+P
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    const win = windowManager.mainWindow();
    if (win) {
      win.webContents.send('shortcut:capture-screen');
    }
  });

  // 打开帮助：F1
  globalShortcut.register('F1', () => {
    const win = windowManager.mainWindow();
    if (win) {
      win.webContents.send('shortcut:open-help');
    }
  });

  console.log('全局快捷键注册完成');
}

// 注销所有快捷键
export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
  console.log('快捷键已注销');
}

// 检查快捷键是否已注册
export function isShortcutRegistered(accelerator: string): boolean {
  return globalShortcut.isRegistered(accelerator);
}

// 批量注册快捷键
export function registerShortcutsBatch(shortcuts: { accelerator: string; callback: () => void }[]): void {
  shortcuts.forEach(({ accelerator, callback }) => {
    globalShortcut.register(accelerator, callback);
  });
}
