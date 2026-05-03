# 数字人心理咨询游戏

一个基于 React + Three.js + VRM 的数字人交互游戏，数字人扮演温和、耐心、热情的心理咨询师角色。

## 功能特性

- 🎭 **3D 数字人模型**：支持 VRM 格式的 3D 角色模型
- 💬 **AI 对话**：支持多种 AI 模型（DeepSeek、OpenAI、Azure 等）
- 🎤 **语音合成**：支持 Genie-TTS（中文角色 - 菲比）、浏览器内置、OpenAI、Azure、ElevenLabs
- 👄 **口型同步**：实时音频分析，实现准确的口型同步
- 😊 **表情动画**：自动眨眼、表情变化、注视跟踪
- 🎨 **现代简洁界面**：清爽的视觉设计

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## TTS 配置

### 浏览器内置 TTS（默认）
无需配置，直接使用浏览器自带的语音合成功能。

### Genie-TTS（推荐）
轻量级、高性能的 GPT-SoVITS 推理引擎，支持中文角色（菲比）。

**快速部署**：
```bash
cd genie-tts-server
python server.py
```

详细配置请参考：[genie-tts-server/README.md](./genie-tts-server/README.md)

### 其他 TTS 服务
- OpenAI TTS
- Azure TTS
- ElevenLabs
- 自定义 API

## VRM 模型

将你的 VRM 模型文件放在 `VRM/` 文件夹中，然后在游戏设置中选择要使用的模型。

## 技术栈

- **前端框架**: React + TypeScript
- **3D 渲染**: Three.js + @pixiv/three-vrm
- **状态管理**: Zustand
- **构建工具**: Vite

## 项目结构

```
src/
├── components/          # React 组件
│   ├── Chat/           # 聊天窗口
│   ├── Settings/       # 设置面板
│   └── VirtualHuman/   # 数字人组件
├── features/           # 功能模块
│   ├── animation/      # 动画系统
│   ├── emoteController/# 表情控制
│   └── lipSync/       # 口型同步
├── services/           # 服务层
│   ├── aiService.ts    # AI 对话服务
│   └── ttsService.ts   # TTS 服务
└── store/              # 状态管理
```

## 开发说明

### 添加新的 TTS 提供商

1. 在 `src/services/ttsService.ts` 的 `speakWithAPI` 方法中添加新的提供商逻辑
2. 在 `src/components/Settings/TTSConfig.tsx` 中添加预设配置
3. 更新 UI 选项

### 添加新的 AI 模型

1. 在 `src/services/aiService.ts` 中添加新的模型支持
2. 在 `src/components/Settings/ApiConfig.tsx` 中添加配置选项

## 许可证

MIT License
