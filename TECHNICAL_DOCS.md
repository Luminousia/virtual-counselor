# 虚拟数字人心理咨询师「小暖」技术文档

> 版本：v2.2 | 最后更新：2026-05-04

---

## 目录

1. [项目概述](#一项目概述)
2. [技术栈全览](#二技术栈全览)
3. [目录结构](#三目录结构)
4. [各模块实现思路（全模块）](#四各模块实现思路全模块)
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
├── index.html                     # SPA 挂载点 → src/main.tsx
├── package.json                   # npm start → server.cjs；deploy:tcb CloudBase CLI
├── vite.config.ts                # Dev 代理 /__minimax-*
├── vercel.json                   # Vercel 构建与 Functions 超时
├── wrangler.jsonc                # Cloudflare Workers + 静态 assets（dist）
├── server.cjs                    # Express：dist 静态托管 + /api/ai SSE + /api/tts（自托管必选）
├── TECHNICAL_DOCS.md             # 本技术文档
├── .env.cloudbase.example       # CloudBase / VITE_* 构建变量示例（可复制为 .env.production）
├── electron/                     # Electron 主进程备选（ipc、plugins）；与 src/electron/ 并行
├── electron.vite.config.ts       # Electron 打包相关（遗留）
├── cloudfunctions/
│   ├── ai/index.js               # CloudBase：DeepSeek 代理（强制非流聚合体，与本仓库 stream 语义不同）
│   └── tts/index.js              # CloudBase：MiniMax 代理
├── api/
│   ├── ai.ts                     # Vercel Edge：DeepSeek 流式透传
│   └── tts.ts                    # Edge：MiniMax
├── functions/api/                # Cloudflare：同上
├── public/
│   ├── .assetsignore             # Workers 静态资产排除清单
│   ├── scenes/                   # 预设咨询室图等（随 git LFS/.gitignore 可能本地才有）
│   ├── model_p1.vrm / model_p2.vrm  # 生产分片（可能被 .gitignore 排除，仅部署注入）
│   └── idle_animation_info.md    # 待机动画说明（文档）
└── src/
│   ├── main.tsx / App.tsx / pages/
│   ├── vite-env.d.ts             # ImportMeta Env 声明
│   ├── components/
│   │   ├── Chat/
│   │   ├── Settings/             # ApiConfig.tsx 未被 InteractionPage 引用
│   │   └── VirtualHuman/          # ★主线 VRMModel；ModelLoader.ts、SceneRenderer.ts、AnimationManager.ts 未挂载
│   ├── features/                 # 多数为归档参考：animation / emoteController / lipSync
│   ├── lib/                      # VRMA、LookAt Smoother（GLTFLoader 未注册时用不上）
│   ├── services/
│   │   ├── ai/
│   │   ├── tts/
│   │   ├── storage/
│   │   ├── aiService.ts
│   │   └── index.ts              # 聚合导出（可选）
│   ├── store/                    # aiConfigStore、ttsConfigStore、apiConfigStore（AI 别名）…
│   ├── utils/                    # ★lipSyncAnalyzer 被 TTS 引用；audioManager / ttsChunker / prosody：未引用
│   ├── electron/                 # Electron 备选（对比根目录 electron/）
│   └── types/css.d.ts
```
**注意：** 含密钥的配置（如 **`cloudbaserc.json`**）常 **仅本地留存**（见 `.gitignore`）；**`cloudfunctions/*.js`** 可作仓库内模版。可复制 **`.env.cloudbase.example`** → `.env.production.local`。

---

## 四、各模块实现思路（全模块）

本章按 **从外到内、从编排到单项能力** 的顺序，罗列仓库内各类模块：**做什么、谁调用谁、关键设计取舍**。与「核心业务」重复的段落不再省略，便于对照代码阅读。

### 4.0 分层总览与各模块映射

| 层次 | 职责 | 代表性路径 |
|------|------|-----------|
| 应用壳 | 挂载唯一业务页 | `App.tsx` → `pages/InteractionPage.tsx` |
| 布局与对话框 | ChatVRM / Discord 风：大图 + 底栏对话 | `components/Chat/ChatWindow.tsx` + CSS |
| 编排中枢 | 串起流式 AI、分句、TTS、虚拟人 Props | `ChatWindow.tsx` |
| 会话展示 / 输入 | 消息列表、流式占位、输入与快捷键 | `MessageList.tsx`、`InputArea.tsx` |
| 虚拟人与 3D（运行时） | **`VRMModel.tsx` 单体**：加载、灯光、rAF、`updateIdleAnimation`、眨眼、emotion、唇形、`naturalPose` | `VirtualHuman.tsx`（URL）；`SceneRenderer.ts`/`AnimationManager.ts`**未挂载** |
| 归档 / 备选实现 | IdleAnimation **类**、ExpressionController **链**、VRMA Loader 插件、`features/lipSync` 类等 | `features/`、`utils/audioManager`、`lib/*`——**不与主线 import 等价**，见 §4.8–§4.26 |
| AI / TTS 服务 | 流式 SSE、可选非流式、分句、情感、`TTSQueueManager` + **`LipSyncAnalyzer`**；部分 `utils/` 仅占位 | `services/ai/*`、`services/tts/*`；**`audioManager`、`ttsChunker`、`textProsodyProcessor` 当前未被 import（见§4）** |
| 全局状态 | 人设、资源配置、密钥与 TTS 细项 | `store/*` |
| 客户端大文件存储 | IndexedDB Blob | `services/storage/indexedDBService.ts` |
| 设置 UI | Tab 人设 / 模型 / 语音 / 资源 | `components/Settings/SettingsPanel.tsx` |
| 自建 Three 插件 | VRMA / LookAt 平滑 | `lib/VRMAnimation/`、`lib/VRMLookAtSmootherLoaderPlugin/` |
| 边缘与后端代理 | CloudBase / Vercel / Cloudflare | `cloudfunctions/`、`api/`、`functions/api/` |

**备选或未挂主流程的组件：** `ChatInterface.tsx` + `MessageBubble.tsx`；`ApiConfig.tsx`。**Electron：** `src/electron/` 与根目录 `electron/` 双源码树并存，主线为 Web SPA。

**误读提醒：** 仅凭「目录存在」不能推断模块已挂载，须核对 **静态 import**，见 §4.8–§4.26。
---

### 4.1 应用入口与页面外壳

- **`src/App.tsx`**：无路由，直接渲染 `InteractionPage`。思路是 **最小根组件**，便于未来拆路由时再扩展。
- **`src/pages/InteractionPage.tsx`**：页面级外壳——顶栏文案（与小暖人设一致的「温和·耐心·热情」）+ 并排挂载 `ChatWindow` 与 `SettingsPanel`。不承载业务逻辑，仅负责区块组合与页面级样式（`InteractionPage.css`）。

---

### 4.2 聊天 UI 链路

- **`ChatWindow.tsx` + `ChatWindow.css`**：主对话区。**布局要点**：下层为「场景背景」+「虚拟人区域」叠层（z-index 区分），上层为半透明底栏的对话区（消息 + 输入），避免遮挡主体。
- **`MessageList.tsx`**：
  - 历史消息与用户消息分区样式（`.user-message` / `.ai-message`）；
  - **流式区**：单独 `StreamingMessage`，带三点动画；
  - **Loading**：`TypingIndicator`，与真实流式输出区分；
  - 每条消息附带本地化时间戳。
  - 组件用 `memo` 减少滚动时列表重渲染。
- **`InputArea.tsx`**：**受控 textarea**；Enter（非 Shift）发送；加载中可同时允许「停止」语音（依赖父组件传的 `isSpeaking`）；按钮区在朗读时出现「停止」以中断 TTS 队列。
- **其它：** `VoiceChatDemo.tsx`、`VoiceInputButton.tsx` 为语音相关演示/控件——若产品上未默认开启，仍可视为可选模块；文档上保持「按产品开关接入」的描述。
- **虚拟人旁的轻量 UI**：`EmotionIndicator`、`StatusIndicator`、`LoadingSpinner` 等通常为 **状态展示**，由父组件传入当前情绪/加载态，不承担业务编排。

---

### 4.3 对话编排中枢（ChatWindow）

**角色：** 整张产品的 **业务流程编排器**，把「人设、场景、模型、AI、情感、语音、虚拟人 Props」连在一起。

**实现要点：**

1. **人设同步**：监听 `characterStore.currentCharacterId`（跳过首次 mount），人设切换后 **清空** `streamingAIService` 与页面 `messages`，保证对话与新人设 Prompt 一致。
2. **流式调用**：调用 `streamingAIService.streamResponse(userText, onChunk, onComplete)`。
3. **`onChunk` 内**：`setStreamingText` 刷新 UI；`SentenceSplitter.feed(chunk)` 得到可读句段；对每个完整/半完整句：**情感分析**（`emotionAnalyzer` + `emotionSensitivity`）、**入 TTS 队列**（传入分析出的情感）。
4. **`onComplete` / flush**：拆分器 `flush()` 消化缓冲；最终将 assistant 气泡写入正式 `messages`，清空流式缓冲。
5. **虚拟人侧**：传入 `lipSyncData`、`currentVolume`（可由 `audioManager`/分析回调）、`currentEmotion`、`textType`（由文本启发式判断：问句 / 寒暄等）、`isSpeaking`、`transparent`——当选择非「无场景」预设或 IndexedDB 自定义场景时为透明背景，便于 **场景图铺在模型后面**。
6. **预设场景**：`PRESET_SCENES` 含咨询室 PNG、多套 CSS 渐变、`none` 走默认暖色底；可与 `assetStore.currentPresetSceneId` 对齐。
7. **设置入口派发**：监听或触发 `window` 自定义事件 `openSettings`（与其它按钮协作打开侧栏）。

---

### 4.4 场景与画布层叠

- **预设场景**：`/public/scenes/...` 或 `gradient:...` 前缀在 CSS `background-image`/`background` 中解析。
- **自定义场景**：来自 `indexedDB`，经 `blob:` URL；与预设互斥选型由 `assetStore` + `ChatWindow` 当前分支决定。
- **层级**：底层 `scene-background`，中层 `VirtualHuman`，上层对话条——避免加载中全屏不透明遮罩挡住场景（历史问题曾在 `VRMModel` loading 样式修正）。

---

### 4.5 虚拟人容器（VirtualHuman）

**文件：** `VirtualHuman.tsx`

**思路：** **纯组装层**。解析模型 URL 优先级：`props.modelUrl` > IndexedDB `useCurrentModel().url` > 环境默认（开发 `/model.vrm`，生产 `/model_p1.vrm` 触发分片合并逻辑，见下）。将 `isSpeaking`、`volume`、`lipSyncData`、`emotion`、`textType`、`transparent` 原样下传 `VRMModel`。

---

### 4.6 VRM 渲染与模型加载（VRMModel）

**文件：** `VRMModel.tsx`

**职责合并（历史重构结果）：** 早期 `ModelLoader` / 其它路径曾分散加载逻辑，现以 **GLTFLoader + VRMLoaderPlugin** 为主路径；生产 **分片 URL**（`_p1.vrm`）时在同文件内 **并行 fetch → 合并 ArrayBuffer → Blob URL**，再交给 Loader，避免 CDN 对 `.gz` 二次编码等问题。

**每帧主循环（概念）：**

```
rAF
  → IdleAnimation（躯体微动）
  → ExpressionController（表情插值、眨眼、LookAt）
  → 口型（频域分析结果写 blendshape）
  → vrm.update（SpringBone 等）
  → renderer.render(scene, camera)   ← 直接在 VRMModel 内渲染，不经 SceneRenderer
```

**其它：** `setNaturalPose` / `maintainArmPose`（`naturalPose.ts`）缓解 T-Pose、夹臂等默认绑定问题；`transparent` 时 `scene.background = null` 且 `renderer.setClearColor(0x000000, 0)`，便于底层 HTML 场景图透出。

---

#### 灯光实现方案（当前线上生效）

**位置：** `VRMModel.tsx` 初始化 `THREE.Scene` 之后、`loader.load` 之前（约 268–297 行）。

**设计理念：** 「日系动漫偶像」向的 **多角度柔光**：主光把脸打亮、补光吃阴影、顶光提亮发丝、半球光铺粉调环境、环境光收口暗角。全部为 **THREE 内置无阴影光源**，不启用 `castShadow`，性能稳定，也减少与 Toon/MToon 的阴影撕裂问题。

| 光源变量 | 类型 | 颜色 | 强度 | 位置（示意） | 作用 |
|----------|------|------|------|----------------|------|
| `keyLight` | `DirectionalLight` | `0xFFF5EE` | **1.5** | `(0.4, 1.2, 2.0)` | 正前偏右上主光，面部主照明 |
| `fillLight` | `DirectionalLight` | `0xFFDDD8` | **0.7** | `(-1.2, 0.5, 1.5)` | 左前补光，减轻鼻影与面颊暗部 |
| `hairLight` | `DirectionalLight` | `0xFFFFFF` | **0.6** | `(0, 3, 0.8)` | 顶前轮廓光，头发高光 |
| `hemiLight` | `HemisphereLight` | 天空 `0xFFD8E4` / 地面 `0xEED4C4` | **0.6** | 默认轴向 | 上粉下暖的包围光，弱化「死黑轮廓」 |
| `ambientLight` | `AmbientLight` | `0xFFECE4` | **0.55** | — | 整体提亮，压住残余死角 |

代码中有注释归纳为：**前方均匀暖白主光 + 左侧柔和补光 + 头顶纯白发丝高光 + 樱花粉天光 / 暖肤地面反射**，目标为 **整体偏暖、少硬阴影**，契合「小暖」人设的视觉气质。

**与透明场景：** 光照只作用于 VRM；2D 咨询室场景在 DOM/CSS 层。若以后要 **IBL/环境反射**，需另行加载 HDR 或通过 `CubeTexture`，并与「透明画布」的合成方式协调。

---

### 4.7 三维场景抽象（SceneRenderer，未接入主线）

**文件：** `SceneRenderer.ts`

**思路：** 将 `Scene` / `WebGLRenderer` / `PerspectiveCamera` / `Clock` 封装成类，`setupLighting()` 内为 **另一类四灯**：主方向光（颜色 `0xfff0f5`，强度 **1.2**）+ `AmbientLight`（强度 **0.85**）+ 补方向光（**0.4**）+ 顶方向光（**0.3**）；另支持雾、`setBackgroundImage`（等距贴图映射作全景背景）、`setLightIntensity` / `resetCameraPosition` 等。**当前工程中无任何文件 `import SceneRenderer`**，仅为重构预留；**切勿与 `VRMModel` 内灯光同时使用**，否则会 **叠加两套光**。

---

### 4.8 动画状态管理（AnimationManager，未挂载）

**文件：** `AnimationManager.ts`

**现状（静态扫描）：** 类内实现表情状态机与 blendshape 插值逻辑，设计意图是 **AIRI 式二层状态管理**。**当前仓库无任何 `import AnimationManager`**，与 `SceneRenderer.ts` 同为「从历史重构拆分出的占位文件」，**不参与运行**。若以该类为蓝图维护功能，请先接到 `VRMModel` 或抽到 hook，否则会与下方「已实现于 VRM 单文件内的逻辑」重复。

---

### 4.9 程序化待机动画与自然姿态

**运行时路径（挂载）：**

- **`VRMModel.tsx` 局部函数 `updateIdleAnimation(vrm, delta)`**：在 `rAF` 内对每个 tick 调用，实现 **躯干/肩颈的简化正弦型微动**。这是用户实际看到的待机效果。**不**依赖 `idleAnimation.ts` 中的类。

- **`naturalPose.ts`**：`setNaturalPose`、`maintainArmPose` — **已由 `VRMModel` import**，加载后微调手臂等骨骼，减弱 T-Pose / 夹着胳膊感。

**归档 / 可选路径：**

- **`features/animation/idleAnimation.ts`**：**独立类 IdleAnimation**，带呼吸、摇曳、微风等更丰富参数。**未被任何组件引入**，可作未来「从 VRM 单文件拆分」时的参考实现或与 `updateIdleAnimation` 对齐后替换。

---

### 4.10 表情、视线与眨眼（主线 vs `features/emoteController`）

**运行时路径（挂载）——均在 `VRMModel.tsx` 内：**

- **情绪表情**：监听父组件传入的 `emotion` prop，`expressionRef`/`emotionRef`，在 `expressionManager` 上对 **可用 blendshape** 集合做加权与平滑（含 happy/sad/neutral 等与其它口型图层协调）。
- **眨眼**：`blinkExpressionRef` 动态解析 `Blink`/`blink`/左右眼等 naming；随机间隔触发 `blinkActiveRef`，在 `delta` 上插值开合；与说话状态错峰。
- **LookAt**：`lookAtTarget` 挂在 Camera 子节点（见文件中注释 ChatVRM 风格），使人偶视线朝向摄像机方向。

**未挂载套件（可参考 AIRI / ChatVRM 迁移）：**

- **`expressionController.ts` + `autoBlink.ts` + `autoLookAt.ts`**：三者形成闭包。**仅 ExpressionController import 另外两个**；表达式控制器本体 **未被 VRMModel 或其它 UI 引入**。若在文档别处仍写「ExpressionController 每帧驱动」，应理解为 **与当前主干实现等价的设计参考**，而非运行事实。

---

### 4.11 口型与音频管线

**实际挂载：**

- **`lipSyncAnalyzer.ts` + `ttsQueueManager`**：`TTSQueueManager` 自建 `AudioContext`、**`AnalyserNode`（fftSize=256）**，`source → analyser → destination`；`LipSyncAnalyzer` 每帧 `update()` 产出 `LipSyncResult`，经 `onLipSyncUpdate` 回调传到 `ChatWindow` → `VRMModel` 写口型 blendshape。

**未挂载 / 备用：**

- **`utils/audioManager.ts`**：**提供** `createAudioManager`、`playAudio`、`calculateVolume`（AIRI 风格 sigmoid 音量）。**当前未被 import**；与 `ttsQueueManager` 内置逻辑 **功能重复**，属可合并或删除的候选。
- **`features/lipSync/lipSync.ts`**：**`LipSync` 类**（时域 + sigmoid）。**无引用**，与上条同类备用实现。

**结论：** 主干口型数据流为 **`ttsQueueManager` ↔ `lipSyncAnalyzer` ↔ UI ↔ VRM**，勿与未使用文件混淆。

---

### 4.12 流式 AI（streamingAIService）

**文件：** `streamingAIService.ts`

**思路：** `fetch` + `ReadableStream` 解析 **SSE**（或 CloudBase 整块 JSON）。开发环境：`DEEPSEEK_API_URL` + `Authorization` 头。**生产环境**（`import.meta.env.PROD`）：经 **`getAiEndpoint()`** 选择 **`AI_PROXY_URL`**（CloudBase 常为 **`https://{envId}.service.tcloudbase.com/ai`**）或同源 **`POST /api/ai`**；**不在请求中带 Key**，由云函数 / 网关代加 `Bearer`。

**与 `AI_PROXY_URL`：** 生产下已统一使用 **`AI_PROXY_URL`**（或 `/api/ai`）。CloudBase 下 AI/TTS 走 **云函数 HTTP 访问域名**（`*.service.tcloudbase.com`），与同环境静态站 **`*.tcloudbaseapp.com` 往往不同源**；云函数已设 **`Access-Control-Allow-Origin: *`**。也可用手写 **`VITE_AI_API_URL` / `VITE_TTS_API_URL`** 覆盖。


**Prompt：** `getSystemPrompt()` 从 `characterStore` 拉取，实现 **与人设模块单一数据源**。

---

### 4.13 非流式 AI（aiService）

**文件：** `aiService.ts`

**思路：** 传统 **axios 一次请求** 拿全量回复，内置长段「小暖」系统 Prompt 字符串；含 **`calculateTrustChange`** 等基于关键词的「信任度」游戏规则。

**现状：** 当前主 UI **未引用** 本服务；保留用于：非流式场景、未来游戏化数值条、或工具脚本。与 `streamingAIService` **会话历史不共享**，若产品要同时用两者需统一历史源。

---

### 4.14 分句与情感（sentenceSplitter / emotionAnalyzer）

- **`SentenceSplitter`**：维护 **文本缓冲**；优先按 **句末标点** 切出 `isComplete: true` 的段；缓冲过长时按 **逗号/分号** 切 `isComplete: false` 以 **提前启动 TTS**；`flush()` 在流结束时吐出剩余。参数：`minSentenceLength`、`maxChunkLength` 控制粒度与延迟折中。
- **`emotionAnalyzer`**：多类 **关键词表** 打分，输出 `EmotionType` + `intensity` + 命中词；刻意区分 **语气词** 与 **话题词**，减轻「谈压力却被判成悲伤语气」的偏差。强度再经设置里的 **emotionSensitivity** 缩放后参与 TTS/VRM。

---

### 4.15 TTS 队列与 MiniMax 适配

- **`ttsQueueManager.ts`**：
  - 队列项含状态机 **pending → generating → ready → playing → done | error**；
  - **并行** 对多条发起 `fetchMinimaxTTS`，但 **播放严格串行**，保证语序与口型连续；
  - 生产环境 URL 来自 **`TTS_PROXY_URL`**（CloudBase 或默认 `/api/tts`）；开发走 Vite **`/__minimax-tts`** 前缀代理到 `api.minimaxi.com`；
  - 响应 JSON 内 **base64 音频** 解码后交给 `audioManager`/`AudioContext`；
  - 支持 **句间 pause**（`sentencePause`）、**停止** 清空队列与 `AudioBufferSource`。
- **`minimaxTTSService.ts`**：面向「直接调 MiniMax」的封装类（host、body 结构、错误文本）；主流程以 **队列 + fetch** 为准，此类可作单测或将来复用。

---

### 4.16 文本辅助（ttsChunker / TextProsodyProcessor）

- **`ttsChunker.ts`**：词级 `TTSChunk` 生成器（硬/软标点、`Intl.Segmenter`）。**当前无 import**，与 `SentenceSplitter` 相邻，属 **预留／AIRI 对齐**。
- **`TextProsodyProcessor`**：韵律预处理（句号后换行等）。**当前无 import**，未接 TTS。

---

### 4.17 设置中心（SettingsPanel）

**文件：** `SettingsPanel.tsx`（体量较大，按 Tab 组织）

| Tab | 实现思路 |
|-----|----------|
| `character` | 编辑当前人设字段、自定义 Prompt 开关、`resetToDefault`、另存为、列表切换、`import`/`export` JSON、预览合并后的系统提示词 |
| `model` | 「使用内置配置」checkbox：勾选则清空用户 Key 并固定 DeepSeek 默认模型；与 `aiConfigStore` 同步 |
| `tts` | 「使用内置」、音色列表、speed/pitch/volume、句间停顿、情感灵敏度、**自定义情感映射表**（检测类 → MiniMax 情感 enum）、重置映射 |
| `assets` | 初始化 IndexedDB、展示占用、上传/删除 **场景图与 VRM**、选取当前资源、清空库；与 `assetStore`、`indexedDBService` 协同 |

全局：`openSettings` 事件侦听、`useBuiltin`/`useBuiltinTTS` **本地 UI 状态与 store 对齐**（曾修复 checkbox 无法取消的问题）。

---

### 4.18 人设与运行时一致（characterStore）

**路径：** `store/characterStore.ts`

**思路：** **单一真相源**：`savedCharacters`、`currentCharacterId`、`getSystemPrompt()`。设置里改的 personality/background/customPrompt、`streamingAIService` 里读的 system prompt **必须都来自同一 getter**，否则会出现「设置了新人设但仍用旧 Prompt」类产品问题（历史中通过统一数据源修复）。

辅助方法：`saveAsNew`、`switchCharacter`、`exportCharacter`、`importCharacter`、`resetCharacter` 等。

---

### 4.19 各类配置 Store（ai / tts / asset）

- **`aiConfigStore`**：`apiKey`、`model`；与「内置」策略配合时生产环境包内 **不写死 Key**，走代理或由用户填写。
- **`ttsConfigStore`**：`TTSConfigType` 全字段 + `updateEmotionMapEntry` / `resetEmotionMap`；持久化朗读参数。
- **`apiConfigStore.ts`**：**兼容层**，`useApiConfigStore` 实为 `useAIConfigStore` re-export，`useTTSConfigStore` 独立——避免早期命名混用导致的 import 断裂。
- **`assetStore`**：`persist` 存 **选中 ID**，大文件本体在 IndexedDB；`init()` 启动时 `loadScenes`/`loadModels` 并 **恢复 blob URL**；`selectPresetScene` 与自定义场景 ID 分支独立，供 `ChatWindow` 算背景与透明标志。

---

### 4.20 资源存储（indexedDBService）

**思路：** 单库 `VirtualHumanDB`，对象存储 `scenes` / `models`（及缩略图等扩展 store）；`init` 单例 Promise 防重入；CRUD 返回 **可 revoke 的 ObjectURL** 供 `<img>` 与 `VirtualHuman` 使用；`getStorageInfo` 统计占用供设置页展示。

---

### 4.21 自建库（VRMAnimation / LookAt Smoother，未挂载到 Loader）

- **`lib/VRMAnimation/`**：VRMA Loader 插件与 `loadVRMAnimation`。**`VRMModel` 的 `GLTFLoader` 当前只注册 `VRMLoaderPlugin`**，未注册 VRMA，故 **运行时不会加载 .vrma**。保留作动作扩展代码。
- **`VRMLookAtSmootherLoaderPlugin`**：**未注册**；主线 LookAt 在 **`VRMModel`（相机挂点）**。

---

### 4.22 ModelLoader（未挂载）

**文件：** `ModelLoader.ts`，**工程内无引用**。主干加载与 **分片合并** 已全部在 **`VRMModel.tsx`**；此类为遗留封装。

---

### 4.23 Electron 桌面壳（双路径并行）

**`src/electron/*`** 与根目录 **`electron/main/*`、`ipc/*`、`preload/*`、`plugins/*`** **两套 Electron 源码并存**，职责重叠。**当前交付为浏览器 SPA**。若恢复桌面打包，宜 **选型一条链**并清理冗余，并自备 `/api/ai`、`/api/tts`（或打包进 Electron）。

---

### 4.24 Vite、`server.cjs` 与 `npm run start`

- **`vite.config.ts`**：`host`、`open`、`/__minimax-*` → `api.minimaxi.com`。
- **`npm run build`**：清 `dist` + `node_modules/.vite` 后 `vite build`。
- **`server.cjs`**：Express，`express.static('dist')`；**`POST /api/ai`** 透传 DeepSeek SSE（`DEEPSEEK_API_KEY`）；**`POST /api/tts`** 转发 MiniMax（`MINIMAX_TTS_API_KEY`）。
- **`npm run start`** = `node server.cjs`（`PORT`，默认 **3000**）。与 **`streamingAIService` 生产的 `/api/ai`** 同源约定一致，适合于 **ECS/轻量/Docker/pm2**。
- **入口：** 根 **`index.html`** → **`src/main.tsx`** → **`App.tsx`**。**`src/types/css.d.ts`**：CSS Modules 声明。

---

### 4.25 `defaultConfig`、`vite-env`、`cloudbaserc` 与安全

**`src/store/defaultConfig.ts`：** `CONFIG_VERSION`、`MINIMAX_TTS_VOICES`、`DEEPSEEK_MODELS`、`AI_PROXY_URL` / `TTS_PROXY_URL`（CloudBase 推导）；`BUILTIN_*` 仅限开发。

**注意：** **`streamingAIService` 不使用 `AI_PROXY_URL`**（见 §4.12）。

**`.env`**：范例见 **`.env.cloudbase.example`。** **`cloudbaserc.json` 被 `.gitignore`**（密钥），仅存本地或 CI Secret。

---

### 4.26 `services/index.ts`

**聚合导出**现行服务（streaming、emotion、tts、indexedDB、`aiService` 等）；业务模块多仍 **深层路径** import。曾误指向已删除的语音文件，现已修正对齐仓库。


**（以下各节为第四章涉及的核心能力速查表，与上文对应，便于检索。）**

#### 流式对话 + TTS 主干数据流

```
用户输入
  → streamingAIService（SSE）
  → onChunk: UI + SentenceSplitter
  → emotionAnalyzer + ttsQueueManager
  → Audio + lipSyncAnalyzer
  → VRMModel 表情/口型
```

#### TTS 用户可调参数（速查）

| 参数 | 范围 | 说明 |
|------|------|------|
| voice | 音色 ID | 少女、御姐、甜美等 |
| speed | 0.5 – 2.0 | 语速 |
| pitch | -12 – 12 | 音调 |
| volume | 折算为 MiniMax `vol` | 见队列内 `*10` 映射 |
| sentencePause | ms | 句间静音 |
| emotionSensitivity | 0–1 | 情感分析对 TTS 的影响 |
| 自定义 emotion map | 表驱动 | 检测类 → MiniMax 情感 |

#### 生产环境 VRM 分片加载（速查）

```typescript
const [r1, r2] = await Promise.all([fetch('/model_p1.vrm'), fetch('/model_p2.vrm')])
const [ab1, ab2] = await Promise.all([r1.arrayBuffer(), r2.arrayBuffer()])
const merged = new Uint8Array(ab1.byteLength + ab2.byteLength)
merged.set(new Uint8Array(ab1), 0)
merged.set(new Uint8Array(ab2), ab1.byteLength)
const blobUrl = URL.createObjectURL(new Blob([merged]))
```

---

## 五、API 代理架构

### 为什么需要代理

1. **API Key 安全**：Key 不能直接暴露在前端 JS 包中
2. **CORS**：浏览器直接请求 DeepSeek/MiniMax 受到跨域限制

### 代理路由逻辑（`defaultConfig.ts`）

```
构建时注入 VITE_CLOUDBASE_ENV_ID
    ↓
AI_PROXY_URL = https://{envId}.service.tcloudbase.com/ai   （CLI: tcb fn deploy --path /ai）
TTS_PROXY_URL = https://{envId}.service.tcloudbase.com/tts （CLI: --path /tts）

（静态网站托管默认域名为 *.tcloudbaseapp.com ，与上述云函数访问域名不同，属正常）

开发环境（PROD=false）：
  AI  → 直调 api.deepseek.com（带明文 Key）
  TTS → Vite 代理 /__minimax-tts（绕 CORS）
```

### 各平台代理文件

| 平台 | AI 代理 | TTS 代理 | 与当前前端匹配度 |
|------|---------|---------|------------------|
| **Node 同源** | `server.cjs`：`POST /api/ai` SSE 透传 | `POST /api/tts` JSON | ✅ 与生产前端默认路径一致 |
| Vercel | `api/ai.ts` SSE 透传 | `api/tts.ts` | ✅ |
| Cloudflare | `functions/api/ai.ts` | `functions/api/tts.ts` | ✅ |
| 腾讯云 CloudBase | `cloudfunctions/ai/index.js` | `cloudfunctions/tts/index.js` | ⚠️ **见下文** |

### 兼容性注意（CloudBase AI 函数 vs 前端流式）

- **`streamingAIService`**：生产环境下若配置了 **`AI_PROXY_URL`**，**默认 `stream: false` + 整块 JSON**（兼容性最好）。
- **`VITE_AI_SSE=true`**：同一路径 **`AI_PROXY_URL`** 改为 **`stream: true`**，走 **SSE 打字机**；云函数需在 **`context.sse`** 可用的 HTTP 运行时上部署新版 **`cloudfunctions/ai`**。若运行时无 **`context.sse`**，服务端会把上游 SSE **聚合成整块 JSON**，前端仍可识别 **`Content-Type: application/json`** 并收口为一次 **`onChunk`**。
- 未配置 **`AI_PROXY_URL`** 时，仍为同源 **`POST /api/ai` SSE**（或开发直连 DeepSeek）。
- **TTS 云函数**：与 **`ttsQueueManager`** 的 JSON **`/tts`** 匹配。**`MINIMAX_TTS_KEY`**（CloudBase）与 **`MINIMAX_TTS_API_KEY`**（`server.cjs`）命名不同。

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
   可选（开启 CloudBase AI 打字机 SSE，见上文「兼容性注意」）：
   ```
   VITE_AI_SSE = true
   ```
5. 重新触发构建

**免费额度（月）：** 静态托管 5GB + CDN 1GB/天 + 云函数 1万次/天

**⚠️ 构建变量：** CloudBase **必须**注入 **`VITE_CLOUDBASE_ENV_ID`**（或手写 **`VITE_AI_API_URL`** / **`VITE_TTS_API_URL`**），否则前端生产包仍会请求 **`/api/ai`**，与纯静态托管环境不匹配。密钥放在云函数控制台环境变量，勿写入 Git。

### 国内云服务器 + `server.cjs`（与仓库完全对齐）

在任何可跑 Node 的机器上：`npm run build` → 将 **`dist/`** 与 **`server.cjs`**、`package.json`、`node_modules`（或 `npm ci --omit=dev`）一并部署，设置环境变量 **`DEEPSEEK_API_KEY`**、**`MINIMAX_TTS_API_KEY`**，对外监听 **`npm run start`**（默认端口 3000）。前端构建产物 **不须**改写 API 路径。适合 **阿里云 / 腾讯云 ECS / 轻量**。


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

**修正：** 重写 `AutoBlink`，初始化时 blink=0（睁眼），定时随机触发眨眼动作，并与口型同步互斥。（**当前主线**中同类逻辑在 **`VRMModel.tsx` 内联**；`features/emoteController/autoBlink.ts` 仅为未挂载的参考实现。）

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

**修正：** 将 **静态资源与用户侧访问** 迁移到腾讯云 CloudBase 等境内更友好的服务；API 仍可继续用 **`server.cjs` / Vercel / Cloudflare** 等与 **SSE 前端兼容**的方案。⚠️ 若仅启用本仓库 **CloudBase `cloudfunctions/ai`（JSON 非流）** 且不改造前端，则 **不满足**当前 `streamingAIService`——详见 **§五**。

---

### 修正 9：TTS「使用内置配置」Checkbox

**问题：** 复选框逻辑错误导致无法取消「使用内置」。

**修正：** 更正 `SettingsPanel` 中与 `ttsConfigStore` / 本地状态的同步。

---

### 修正 10：技术文档第四章扩展为「全模块」实现说明

**问题：** 原技术文档仅侧重核心链路，未逐模块说明职责与调用关系。

**修正：** 重写第四章，补全 UI 壳、聊天子组件、`ChatWindow` 编排、三维各层、AI/TTS 变体、工具类、Settings 各 Tab、Store 分工、IndexedDB、自建库、Vite/Electron 可选路径，并标注备选/未挂载组件与历史双轨配置注意点。

---

### 修正 11：静态扫描校对文档与代码挂载关系

对照 **静态 import**，明确：**`idleAnimation`、`emoteController`、`lipSync`、`AnimationManager`、`ModelLoader`、`audioManager`、`ttsChunker`、`textProsodyProcessor`、`lib/VRMAnimation`、`VRMLookAtSmoother` 等与主线脱节**；**`VRMModel.tsx`、`ttsQueueManager`、`lipSyncAnalyzer` 为运行时核心**。详见正文 **§4.0–§4.26**。

---

### 修正 12：`services/index` 与环境类型声明清理

**问题：** `src/services/index.ts` 仍导出已删除的语音识别/合成模块占位，易造成误用。

**修正：** `index.ts` 改为仅导出仓内仍存在的服务；`vite-env.d.ts` 增补 `VITE_CLOUDBASE_*` 与手写 API URL。

---
*文档由 Cursor AI 辅助整理，持续更新中。*
