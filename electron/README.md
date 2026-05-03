# 虚拟心理咨询师 - 桌面应用

## 目录结构

```
virtual-counselor/
├── src/                      # React前端源码
│   ├── components/           # React组件
│   ├── services/             # 服务层
│   ├── store/                # 状态管理
│   └── utils/                # 工具函数
├── electron/                  # Electron后端
│   ├── main/                  # 主进程
│   │   ├── main.ts           # 主入口
│   │   ├── windowManager.ts  # 窗口管理
│   │   ├── ipc/              # IPC通信
│   │   │   ├── channels.ts   # 通道定义
│   │   │   └── handlers.ts   # 处理器
│   │   └── services/         # 主进程服务
│   │       └── autoUpdater.ts # 自动更新
│   ├── preload/              # 预加载脚本
│   │   └── preload.ts
│   └── plugins/              # 插件
│       ├── tray.ts           # 系统托盘
│       └── shortcut.ts       # 快捷键
├── resources/                 # 资源文件
│   ├── icons/                # 应用图标
│   └── VRM/                  # VRM模型
├── dist/                      # 构建输出
├── electron-builder.json5     # 构建配置
└── package.json              # 项目配置
```

## 快速开始

### 开发模式

```bash
# 启动Web开发服务器
npm run dev

# 启动Electron开发
npm run dev:electron
```

### 构建发布

```bash
# 构建前端
npm run build

# 构建Electron应用
npm run build:electron

# 构建安装包
npm run build:installer
```

## 功能特性

- 🎭 3D数字人交互
- 💬 AI智能对话
- 🎤 语音输入支持
- 🔊 语音合成播放
- 👄 口型同步
- 😊 表情变化
- ⚙️ 多种AI模型支持
- 📦 跨平台打包

## 系统要求

- Windows 10+ / macOS 10.15+ / Ubuntu 20.04+
- Node.js 18+
- 4GB RAM (推荐8GB)
- 支持WebGL的显卡

## 许可证

MIT
