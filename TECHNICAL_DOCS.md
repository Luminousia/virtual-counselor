# 虚拟数字人心理咨询师「小暖」技术文档

> 版本：v2.0 | 最后更新：2026-05-04

---

## 目录

1. [项目概述](#一项目概述)
2. [技术栈全览](#二技术栈全览)
3. [目录结构](#三目录结构)
4. [核心模块实现思路](#四核心模块实现思路)
   - 4.1 AI 对话模块
   - 4.2 TTS 语音合成模块
   - 4.3 VRM 虚拟人模块
   - 4.4 口型同步
   - 4.5 情感分析与表情驱动
   - 4.6 待机动画系统
   - 4.7 状态管理
   - 4.8 资源管理（IndexedDB）
5. [API 代理架构](#五api-代理架构)
6. [部署方案](#六部署方案)
7. [技术修正历史](#七技术修正历史)

---

## 一、项目概述

「小暖」是一个基于 Web 的虚拟数字人心理咨询师应用。用户通过文字与 3D 虚拟人进行对话，虚拟人实时返回语音回复并配合表情、口型动画，营造沉浸式心理陪伴体验。

**核心交互流程：**

```
用户输入文字
    → 流式 AI 回复（DeepSeek）
    → 情感分析（关键词提取）
    → 文本分句 → TTS 队列（MiniMax）
    → 音频播放 + 口型同步
    → VRM 表情驱动（happy / sad / thinking…）
```

---

## 二、技术栈全览

### 前端核心

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| UI 框架 | React | 18.2 | 函数式组件 + Hooks |
| 构建工具 | Vite | 6.4 | 开发热更新、生产打包 |
| 语言 | TypeScript | 5.2 | 全量类型检查 |
| 动画 | Framer Motion | 10 | UI 过渡动画 |
| 状态管理 | Zustand | 4.4 | 轻量全局状态 + localStorage 持久化 |

### 3D 渲染

| 技术 | 说明 |
|------|------|
| Three.js 0.182 | WebGL 渲染引擎 |
| @pixiv/three-vrm 3.4 | VRM 1.0 模型加载、表情管理、SpringBone 物理 |
| @pixiv/three-vrm-animation 3.5 | VRMA 动画文件加载 |
| VRMLookAtSmootherLoaderPlugin | 自研视线平滑插件，改善注视过渡 |

### AI / 语音服务

| 服务 | 用途 | 接入方式 |
|------|------|------|
| DeepSeek Chat | 对话 AI，支持流式输出 | REST API（SSE） |
| MiniMax TTS | 文字转语音 | REST API（JSON → base64 MP3） |

### 部署

| 平台 | 状态 | 说明 |
|------|------|------|
| 腾讯云 CloudBase | **当前推荐** | 静态托管 + 云函数代理，国内可访问 |
| Cloudflare Workers | 已配置，国内不稳定 | `wrangler.jsonc` 保留 |
| Vercel | 已配置，国内不可用 | `api/` 目录保留 |

---

## 三、目录结构

```
project/
├── src/
│   ├── components/
│   │   ├── Chat/               # 对话界面（输入框、消息列表、聊天窗口）
│   │   ├── Settings/           # 设置面板（AI配置、TTS配置、人设、资源）
│   │   └── VirtualHuman/       # 虚拟人组件（VRMModel、ModelLoader、SceneRenderer）
│   ├── features/
│   │   ├── animation/          # 程序化待机动画（IdleAnimation、NaturalPose）
│   │   ├── emoteController/    # 表情控制（ExpressionController、AutoBlink、AutoLookAt）
│   │   └── lipSync/            # 口型同步（LipSync）
│   ├── lib/
│   │   ├── VRMAnimation/       # VRMA 动画加载器
│   │   └── VRMLookAtSmootherLoaderPlugin/  # 视线平滑插件
│   ├── services/
│   │   ├── ai/
│   │   │   ├── streamingAIService.ts   # 流式 AI 对话
│   │   │   ├── emotionAnalyzer.ts      # 情感分析
│   │   │   └── sentenceSplitter.ts     # 分句器
│   │   ├── tts/
│   │   │   ├── ttsQueueManager.ts      # TTS 队列管理（边生成边播）
│   │   │   └── minimaxTTSService.ts    # MiniMax TTS 适配器
│   │   └── storage/
│   │       └── indexedDBService.ts     # IndexedDB 资源存储
│   ├── store/
│   │   ├── aiConfigStore.ts     # AI 配置（模型、API Key）
│   │   ├── apiConfigStore.ts    # TTS 配置
│   │   ├── characterStore.ts    # 人设管理（多角色、导入导出）
│   │   ├── assetStore.ts        # 资源（VRM 模型、场景图）
│   │   ├── ttsConfigStore.ts    # TTS 参数持久化
│   │   └── defaultConfig.ts     # 内置凭证、代理 URL 配置中心
│   └── utils/
│       ├── lipSyncAnalyzer.ts   # 频域口型分析（Web Audio API）
│       ├── audioManager.ts      # 音频上下文管理
│       ├── ttsChunker.ts        # 文本分块
│       └── textProsodyProcessor.ts  # 韵律处理
├── cloudfunctions/
│   ├── ai/index.js              # 腾讯云云函数：DeepSeek 代理
│   └── tts/index.js             # 腾讯云云函数：MiniMax TTS 代理
├── api/
│   ├── ai.ts                    # Vercel Edge Function：DeepSeek 代理
│   └── tts.ts                   # Vercel Edge Function：MiniMax TTS 代理
├── functions/api/               # Cloudflare Pages Functions（同上）
├── public/
│   ├── model_p1.vrm             # VRM 模型分片 1（~12.8MB）
│   ├── model_p2.vrm             # VRM 模型分片 2（~12.8MB）
│   └── .assetsignore            # Cloudflare 资产排除配置
└── cloudbaserc.json             # 腾讯云 CloudBase 部署配置（本地，不提交 Git）
```

---

## 四、核心模块实现思路

### 4.1 AI 对话模块

**文件：** `src/services/ai/streamingAIService.ts`

采用 SSE（Server-Sent Events）流式接收 DeepSeek 响应，实现"边生成边输出"效果，大幅降低首字响应延迟。

```
DeepSeek API (stream=true)
    → SSE 逐 chunk 到达
    → onChunk(text) 回调
        → 实时更新 UI 消息气泡
        → 分句器检测句尾标点（。！？…）
        → 触发 TTS 队列（先到先处理）
    → onComplete(fullText) 收尾
```

**系统提示词动态加载：** 从 `characterStore` 的当前人设配置实时生成，支持多角色热切换。

**代理逻辑（`defaultConfig.ts`）：**

```typescript
export const AI_PROXY_URL =
  VITE_AI_API_URL ||                          // 手动指定
  (CLOUDBASE_ENV_ID ? `${cbBase}/ai` : '')    // CloudBase 自动推算
  // 为空时直接调 DeepSeek（开发模式，带 API Key）
```

### 4.2 TTS 语音合成模块

**文件：** `src/services/tts/ttsQueueManager.ts`

核心设计：**并行生成 + 顺序播放**。分句后的每个句子独立进入队列，最多同时生成 N 个音频，但严格按顺序播放。

```
AI 输出的句子流
    → TTS 队列（状态: pending → generating → ready → playing → done）
    → 每个句子发起 MiniMax TTS 请求（并行）
    → 队列头部 ready 时立即播放
    → 播放结束 → 触发下一条
```

**TTS 自定义维度（用户可调节）：**

| 参数 | 范围 | 说明 |
|------|------|------|
| voice | 音色 ID | 少女、御姐、甜美等 30+ 音色 |
| speed | 0.5 – 2.0 | 语速 |
| pitch | -12 – 12 | 音调（半音） |
| volume | 0 – 10 | 音量 |
| sentencePause | 0 – 2000ms | 句间停顿 |

**情感自动判断：** 不再由用户手动选择情感，改为由 `emotionAnalyzer` 根据 AI 回复内容关键词自动映射到 MiniMax 支持的情感值（happy / sad / angry 等）。

### 4.3 VRM 虚拟人模块

**文件：** `src/components/VirtualHuman/VRMModel.tsx`

使用 Three.js + @pixiv/three-vrm 加载并渲染 VRM 1.0 模型，每帧驱动以下系统：

```
requestAnimationFrame 主循环
    → IdleAnimation.update(delta)      # 待机动画
    → ExpressionController.update(delta)  # 表情平滑过渡
    → LipSync.update(delta)            # 口型同步
    → vrm.update(delta)                # SpringBone 物理、LookAt
    → renderer.render(scene, camera)
```

**模型分片加载（生产环境）：**

由于 Cloudflare 等平台对单文件 25MB 的限制，`model.vrm`（25.5MB）被分割为两个分片：

```typescript
// 并行下载，内存合并，创建 Blob URL
const [p1, p2] = await Promise.all([fetch('/model_p1.vrm'), fetch('/model_p2.vrm')])
const merged = new Uint8Array(p1.byteLength + p2.byteLength)
// 合并后交给 GLTFLoader
const blobUrl = URL.createObjectURL(new Blob([merged]))
```

### 4.4 口型同步

**文件：** `src/utils/lipSyncAnalyzer.ts`

基于 **Web Audio API 频域分析**，将音频实时映射到 A/E/I/O/U 五个口型 blendshape。

```
AudioContext → AnalyserNode（FFT 256点）
    → 频段分析（低/中/高频段能量）
    → 映射到 A(aa) / E(ee) / I(ih) / O(oh) / U(ou)
    → 平滑插值（attack=80ms, release=40ms）
    → 写入 VRM ExpressionManager
```

**关键参数：**
- `SILENCE_VOL = 0.02`：音量低于此值时闭嘴（更灵敏）
- `IDLE_MS = 100`：静音持续 100ms 后开始闭嘴（快速响应）

### 4.5 情感分析与表情驱动

**文件：** `src/services/ai/emotionAnalyzer.ts` + `src/features/emoteController/expressionController.ts`

**两阶段情感管道：**

```
AI 文本
    → emotionAnalyzer（关键词扫描）
        → 输出: { emotion: 'happy', intensity: 0.8, keywords: [...] }
    → DEFAULT_EMOTION_MAP（用户可配置映射表）
        → 小暖默认: neutral → happy（基线温暖而非冷漠）
    → ExpressionController.playEmotion(emotion)
        → 平滑过渡（blendDuration: 0.3s）
        → 自动重置（对话结束后 3s 回 neutral）
```

**AutoBlink（自动眨眼）：**
- 间隔 3–7 秒随机眨眼
- 眨眼时长 0.1–0.15 秒
- 与口型同步互斥（说话时不强制眨眼）

**设计原则：** 情感关键词只检测"说话方式"的情感色彩（语气词），不将话题词（压力/焦虑/累）误判为 sad，避免过度压抑。

### 4.6 待机动画系统

**文件：** `src/features/animation/idleAnimation.ts`

纯程序化待机动画，不依赖外部 VRMA 文件，通过三角函数驱动骨骼：

| 动作 | 频率 | 幅度 | 说明 |
|------|------|------|------|
| 呼吸 | 1.8Hz | 0.006 | 胸部/腰部上下 |
| 身体摇摆 | 0.4Hz | 0.008 | 左右重心转移 |
| 头部微动 | 0.25Hz | 0.02 | 自然晃动 |
| 肩膀微动 | 0.35Hz | 0.004 | 呼吸联动 |
| 微风效果 | — | — | 随机脉冲，触发 SpringBone 头发物理 |

**T-Pose 防护：** 每次 `update()` 在初始骨骼姿态的基础上叠加偏移，避免因帧循环中断导致模型恢复默认 T-Pose。

### 4.7 状态管理

使用 **Zustand** + `persist` 中间件，所有用户配置持久化到 `localStorage`。

| Store | 数据 | 说明 |
|-------|------|------|
| `aiConfigStore` | `{ apiKey, model, useBuiltin }` | AI 配置 |
| `apiConfigStore` | TTS 配置（voice、speed等） | TTS 配置 |
| `characterStore` | `CharacterConfig[]`, `currentId` | 多人设管理 |
| `assetStore` | VRM 模型 URL、场景图 URL | 资源引用 |
| `ttsConfigStore` | TTS 参数 | 持久化 TTS 设置 |

**多人设系统：** `characterStore` 支持创建/保存/切换多个人设模板，并可导入/导出 JSON，当前人设的系统提示词实时注入 AI 请求。

### 4.8 资源管理（IndexedDB）

**文件：** `src/services/storage/indexedDBService.ts`

用户上传的自定义 VRM 模型和场景图片存储在 **IndexedDB**，规避 localStorage 4MB 上限，支持数十 MB 的本地二进制资源。

---

## 五、API 代理架构

### 为什么需要代理

1. **API Key 安全**：Key 不能直接暴露在前端 JS 包中
2. **CORS**：浏览器直接请求 DeepSeek/MiniMax 受到跨域限制

### 代理路由逻辑（`defaultConfig.ts`）

```
构建时注入 VITE_CLOUDBASE_ENV_ID
    ↓
AI_PROXY_URL = https://{envId}.ap-shanghai.tcloudbaseapp.com/ai
TTS_PROXY_URL = https://{envId}.ap-shanghai.tcloudbaseapp.com/tts

开发环境（PROD=false）：
  AI  → 直调 api.deepseek.com（带明文 Key）
  TTS → Vite 代理 /__minimax-tts（绕 CORS）
```

### 各平台代理文件

| 平台 | AI 代理 | TTS 代理 |
|------|---------|---------|
| 腾讯云 CloudBase | `cloudfunctions/ai/index.js` | `cloudfunctions/tts/index.js` |
| Cloudflare Workers | `functions/api/ai.ts` | `functions/api/tts.ts` |
| Vercel | `api/ai.ts` | `api/tts.ts` |

---

## 六、部署方案

### 腾讯云 CloudBase（当前推荐）

**步骤：**

1. 在 [CloudBase 控制台](https://console.cloud.tencent.com/tcb) 创建免费环境，记录 **环境 ID**
2. 在本地填写 `cloudbaserc.json`（不提交 Git）：
   ```json
   {
     "envId": "env-xxxxxx",
     "framework": {
       "plugins": {
         "server": {
           "inputs": {
             "functions": [
               { "name": "ai", "envVariables": { "DEEPSEEK_API_KEY": "sk-..." } },
               { "name": "tts", "envVariables": { "MINIMAX_TTS_KEY": "sk-api-..." } }
             ]
           }
         }
       }
     }
   }
   ```
3. 部署：
   ```bash
   npm install -g @cloudbase/cli
   npm run login:tcb   # 扫码登录
   npm run deploy:tcb  # 一键部署
   ```
4. 在 CloudBase 控制台 → 静态网站托管 → 构建环境变量，添加：
   ```
   VITE_CLOUDBASE_ENV_ID = env-xxxxxx
   ```
5. 重新触发构建

**免费额度（月）：** 静态托管 5GB + CDN 1GB/天 + 云函数 1万次/天

### Cloudflare Workers（境外可用）

已配置 `wrangler.jsonc`，构建命令：
```bash
git checkout -- src/ && rm -rf dist node_modules/.vite && npx vite build
```
注意：模型以 `model_p1.vrm` / `model_p2.vrm` 分片形式部署，各 ~12.8MB。

---

## 七、技术修正历史

### 修正 1：MiniMax 文本 AI → DeepSeek

**问题：** 初版集成 MiniMax 文字 AI，但响应质量和延迟不满足需求。

**修正：** 改用 DeepSeek Chat，保留 MiniMax 仅做 TTS 语音合成。同时删除火山引擎 TTS，精简为单一 TTS 提供商。

---

### 修正 2：情感选择改为 AI 自动判断

**问题：** 原设计让用户在设置里手动选择 TTS 情感，体验割裂。

**修正：** 新增 `emotionAnalyzer.ts`，通过关键词扫描 AI 回复文本自动判断情感，映射到 MiniMax 情感参数，用户无需手动干预。

**补充修正：** 初版情感关键词过于宽泛，将"焦虑"等话题词误判为 sad 导致回复语气异常低沉。重构关键词表，区分"语气词"与"话题词"，neutral 基线改为 happy（小暖性格温暖）。

---

### 修正 3：VRM 眼睛一直闭着

**问题：** AutoBlink 逻辑错误，在初始化时直接设置 `blink=1`，导致眼睛始终闭合。

**修正：** 重写 `AutoBlink`，初始化时 blink=0（睁眼），定时随机触发眨眼动作，并与口型同步互斥。

---

### 修正 4：动画卡住 / T-Pose 问题

**问题：** `requestAnimationFrame` 循环在组件卸载后未正确清理，导致重新挂载时出现多个循环竞争；某些异常情况下骨骼动画停止后恢复 T-Pose。

**修正：**
- 在 `useEffect` cleanup 中调用 `cancelAnimationFrame`，确保唯一循环
- 待机动画采用"基准姿态 + 偏移叠加"模式，而非直接设置绝对角度

---

### 修正 5：Vercel 部署后 DeepSeek 无响应

**问题：** Vercel Edge Function 中 `process.env.DEEPSEEK_API_KEY` 未配置，前端直调时 Key 为空。

**修正：** 在 Vercel 控制台添加环境变量 `DEEPSEEK_API_KEY`；代码侧在生产环境(`PROD=true`)强制走 `/api/ai` 代理，不在浏览器包中内嵌 Key。

---

### 修正 6：Cloudflare 部署 — model.vrm 超过 25MB 限制

**问题：** model.vrm（25.5MB）超出 Cloudflare Workers 单文件 25MB 限制，部署失败。

**尝试路径：**

| 方案 | 结果 | 失败原因 |
|------|------|---------|
| jsDelivr CDN 托管 | ❌ | CDN URL 变为 404 |
| GitHub Releases | ❌ | 浏览器 fetch 被 CORS 拦截（GitHub 无 CORS 头） |
| 仓库内 `.gz` 压缩 | ❌ | Cloudflare CDN 自动解压 `.gz` 文件，浏览器再次解压导致双重解压失败 |
| 改扩展名为 `.bin` | ❌ | Cloudflare 尝试对已压缩文件做二次压缩，服务时返回 500 |
| **二进制分片（最终方案）** | ✅ | 原始 VRM 切成两个 ~12.8MB 分片，各自远低于 25MB 限制 |

**最终方案实现：**
```javascript
// 浏览器端合并两个分片
const [p1, p2] = await Promise.all([fetch('/model_p1.vrm'), fetch('/model_p2.vrm')])
const merged = new Uint8Array(p1.byteLength + p2.byteLength)
merged.set(new Uint8Array(await p1.arrayBuffer()), 0)
merged.set(new Uint8Array(await p2.arrayBuffer()), p1.byteLength)
const url = URL.createObjectURL(new Blob([merged]))
```

---

### 修正 7：Cloudflare 构建缓存导致代码不更新

**问题：** Cloudflare 的构建缓存机制会恢复旧版本的 `src/` 源文件，导致修改后的代码实际没有参与编译，JS bundle 哈希值不变。

**修正：** 在 Cloudflare 的 Build command 中添加强制还原：

```bash
git checkout -- src/ && rm -rf dist node_modules/.vite && npx vite build
```

同时提交 `wrangler.jsonc` 到仓库，防止 wrangler 每次自动生成覆盖配置。

---

### 修正 8：Cloudflare 在中国大陆不可访问

**问题：** Cloudflare Workers 在中国大陆访问不稳定或完全无法访问。

**修正：** 切换到 **腾讯云 CloudBase** 部署方案：
- 静态托管（国内 CDN）+ 云函数（Node.js）代理 API
- 前端通过 `VITE_CLOUDBASE_ENV_ID` 环境变量自动推算云函数 HTTP 触发器地址
- 代码兼容多平台，同一套源码可部署到 CloudBase / Cloudflare / Vercel

---

### 修正 9：TTS 使用内置配置 Checkbox 不可取消

**问题：** "使用内置配置"复选框状态绑定逻辑错误，点击无法取消勾选。

**修正：** 修正 `onChange` 事件处理，将 `checked` 状态正确反向取值，并同步清空/恢复 API Key 字段。

---

*文档由 Cursor AI 辅助整理，持续更新中。*
