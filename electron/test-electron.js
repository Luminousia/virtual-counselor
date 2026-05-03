// 简单的Electron测试脚本
// 运行此脚本验证Electron环境

import { app, BrowserWindow } from 'electron';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: '虚拟心理咨询师 - 测试',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>测试 - 虚拟心理咨询师</title>
      <style>
        body {
          font-family: 'Noto Sans SC', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #fef9f3 0%, #fff5eb 100%);
        }
        .container {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(255, 112, 67, 0.2);
        }
        h1 {
          color: #ff7043;
          margin-bottom: 20px;
        }
        p {
          color: #5d4037;
          margin-bottom: 30px;
        }
        .status {
          display: inline-block;
          padding: 10px 20px;
          background: #81c784;
          color: white;
          border-radius: 20px;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🌸 虚拟心理咨询师</h1>
        <p>Electron 环境测试成功！</p>
        <div class="status">✓ 运行正常</div>
      </div>
    </body>
    </html>
  `));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('Electron 测试脚本加载完成');
