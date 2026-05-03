import { Tray, Menu, app, nativeImage } from 'electron';
import * as path from 'path';

let tray: Tray | null = null;

// 创建托盘图标
function createTrayIcon(): nativeImage {
  // 创建基础图标
  const icon = nativeImage.createEmpty();
  
  // 创建一个简单的图标（实际项目中应该使用真实的图标文件）
  // 这里使用一个占位符，实际使用时请替换为真实的图标路径
  const iconPath = path.join(__dirname, '../../resources/icons/tray.png');
  
  try {
    return nativeImage.createFromPath(iconPath);
  } catch (e) {
    // 如果图标不存在，创建一个默认图标
    console.warn('托盘图标不存在，使用默认图标');
    return nativeImage.createEmpty();
  }
}

// 创建托盘菜单
function createTrayMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: '打开应用',
      click: () => {
        const { windowManager } = require('../windowManager.js');
        windowManager.show();
      }
    },
    {
      label: '快速对话',
      click: () => {
        // 发送快捷消息到渲染进程
        const { windowManager } = require('../windowManager.js');
        const win = windowManager.mainWindow();
        if (win) {
          win.webContents.send('tray:quick-message');
        }
      }
    },
    { type: 'separator' },
    {
      label: '帮助',
      click: () => {
        const { windowManager } = require('../windowManager.js');
        const win = windowManager.mainWindow();
        if (win) {
          win.webContents.send('tray:open-help');
        }
      }
    },
    {
      label: '关于',
      click: () => {
        const { windowManager } = require('../windowManager.js');
        const win = windowManager.mainWindow();
        if (win) {
          win.webContents.send('tray:show-about');
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        const { setQuitting } = require('../windowManager.js');
        setQuitting(true);
        app.quit();
      }
    }
  ]);
}

// 创建系统托盘
export function createTray(): Tray {
  // 如果已经存在托盘，先销毁
  if (tray) {
    tray.destroy();
  }

  const icon = createTrayIcon();
  tray = new Tray(icon);

  // 设置托盘提示
  tray.setToolTip('虚拟心理咨询师 - 小暖');

  // 设置托盘菜单
  tray.setContextMenu(createTrayMenu());

  // 双击托盘显示窗口
  tray.on('double-click', () => {
    const { windowManager } = require('../windowManager.js');
    windowManager.show();
  });

  console.log('系统托盘创建完成');
  return tray;
}

// 更新托盘图标（根据状态）
export function updateTrayIcon(status: 'idle' | 'speaking' | 'error'): void {
  if (!tray) return;
  
  // 根据状态切换图标
  let iconPath: string;
  switch (status) {
    case 'speaking':
      iconPath = path.join(__dirname, '../../resources/icons/tray-speaking.png');
      break;
    case 'error':
      iconPath = path.join(__dirname, '../../resources/icons/tray-error.png');
      break;
    default:
      iconPath = path.join(__dirname, '../../resources/icons/tray.png');
  }
  
  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      tray.setImage(icon);
    }
  } catch (e) {
    console.warn('更新托盘图标失败:', e);
  }
}
