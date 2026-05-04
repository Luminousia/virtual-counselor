# 虚拟数字人心理咨询师「小暖」技术文档

> 版本：v2.1 | 最后更新：2026-05-04

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

## 四、各模块实现思路（全模块）

本章按 **从外到内、从编排到单项能力** 的顺序，罗列仓库内各类模块：**做什么、谁调用谁、关键设计取舍**。与「核心业务」重复的段落不再省略，便于对照代码阅读。

### 4.0 分层总览与各模块映射

| 层次 | 职责 | 代表性路径 |
|------|------|-----------|
| 应用壳 | 挂载唯一业务页 | `App.tsx` → `pages/InteractionPage.tsx` |
| 布局与对话框 | ChatVRM / Discord 风：大图 + 底栏对话 | `components/Chat/ChatWindow.tsx` + CSS |
| 编排中枢 | 串起流式 AI、分句、TTS、虚拟人 Props | `ChatWindow.tsx` |
| 会话展示 / 输入 | 消息列表、流式占位、输入与快捷键 | `MessageList.tsx`、`InputArea.tsx` |
| 虚拟人与 3D | 外层容器 → 画布与循环 → 加载与表情 | `VirtualHuman.tsx`、`VRMModel.tsx`、`SceneRenderer.ts`、`AnimationManager.ts` |
| 特征子系统 | 待机动画、表情、视线、眨眼、唇形 | `features/animation/*`、`features/emoteController/*`、`features/lipSync/*` |
| AI / TTS 服务 | 流式与非流式、分句情感、队列与 MiniMax | `services/ai/*`、`services/tts/*`、`utils/*` |
| 全局状态 | 人设、资源配置、密钥与 TTS 细项 | `store/*` |
| 客户端大文件存储 | IndexedDB Blob | `services/storage/indexedDBService.ts` |
| 设置 UI | Tab 人设 / 模型 / 语音 / 资源 | `components/Settings/SettingsPanel.tsx` |
| 自建 Three 插件 | VRMA / LookAt 平滑 | `lib/VRMAnimation/`、`lib/VRMLookAtSmootherLoaderPlugin/` |
| 边缘与后端代理 | CloudBase / Vercel / Cloudflare | `cloudfunctions/`、`api/`、`functions/api/` |

**备选或未挂主流程的组件：** `ChatInterface.tsx` + `MessageBubble.tsx`（更丰富 Framer Motion 气泡，当前主页未引入）；`ApiConfig.tsx`（独立表单，功能已并入 SettingsPanel）；Electron 源码仍保留用于桌面打包场景，主业为 Web SPA。

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
  → SceneRenderer.render
```

**其它：** `setNaturalPose` / `maintainArmPose`（`naturalPose.ts`）缓解 T-Pose、夹臂等默认绑定问题；`transparent` 时 renderer 清屏 alpha 与场景背景配合。

---

### 4.7 三维场景抽象（SceneRenderer）

**文件：** `SceneRenderer.ts`

**思路：** 将 Three.js 的 `Scene` / `WebGLRenderer` / `PerspectiveCamera` / `Clock` 与 **多光源**（主光、环境光、补光、顶光）封装成类，对外提供 `resize`、`render`、`dispose`。好处是 **VRMModel 专注「角色逻辑」**，场景与像素比、色彩空间（`SRGBColorSpace`）统一在此处理。

---

### 4.8 动画状态管理（AnimationManager）

**文件：** `AnimationManager.ts`

**思路：** 维护 `AnimationState`（emotion、textType、lipSync、是否说话），内部维护 **表情 blendshape 权重图** 与向目标权重的 **插值速度**。与 `ExpressionController` 有功能重叠历史；当前架构中二者配合：一层偏「业务状态机」，一层偏「VRM Expression 细节与 AIRI 式过渡」。新增表情时优先查清哪一层在 **每帧最后写入**，避免双重覆盖。

---

### 4.9 程序化待机动画（idleAnimation / naturalPose）

- **`idleAnimation.ts`**：不依赖 VRMA，用 **正弦/随机相位** 驱动髋、脊柱、颈、肩等骨骼在 **初始姿态基准** 上叠加小幅度旋转/位移，并带「微风」扰动以晃 SpringBone 头发。
- **`naturalPose.ts`**：在加载后或循环中 **修正手臂/肩膀** 自然下垂，减少库存模型默认 T-Pose 感。

**设计原则：** 所有偏移相对 **缓存的初始 bind 姿态** 计算，避免误差累积导致模型「漂」成 T-Pose。

---

### 4.10 表情、视线与眨眼（ExpressionController / AutoLookAt / AutoBlink）

- **`ExpressionController`**：按情绪名查 `_emotionStates`（如 happy 弱强度、多 blend 组合），用 **Map 记录当前/目标表情值**，每帧 `lerp`；支持 **定时回 neutral**、与唇形 layer 协调。
- **`AutoLookAt`**：设置 `vrm.lookAt` 目标（如屏幕外一点），减少僵直盯镜头。
- **`AutoBlink`**：随机间隔触发 blink 表情；需 **与说话状态互斥**，且初始必须为睁眼（历史 bug 为初始 blink=1 导致一直闭眼）。

---

### 4.11 口型与音频管线

- **`lipSyncAnalyzer.ts`（主路径）**：`AnalyserNode` **频域** `getByteFrequencyData`，将能量分布映射到 A/E/I/O/U，再映射到 VRM 标准 preset（`aa`/`ee`/`ih`/`oh`/`ou`），带 attack/release 与静音阈值。
- **`features/lipSync/lipSync.ts`**：**时域**峰值 + sigmoid 得到 volume，提供 `playFromArrayBuffer`/`playFromURL`；可作为备用或对比实现。
- **`audioManager.ts`**：统一创建 `AudioContext`、Analyser、`playAudio` 连接 **destination + analyser**，并可用 `requestAnimationFrame` 持续回调音量（供 UI 或简化口型）。

**数据流：** TTS 解码后的 `ArrayBuffer` → `BufferSource` → **Analyser** → 每帧读数 → `ChatWindow` 状态 → `VirtualHuman` → `VRMModel` 写 expression。

---

### 4.12 流式 AI（streamingAIService）

**文件：** `streamingAIService.ts`

**思路：** `fetch` + `ReadableStream` 解析 **SSE**（`data: {...}` 行），拼 `choices[0].delta.content`。生产环境 `apiUrl` 现为 **`/api/ai` 同源代理**（与 Vercel/Cloudflare 边缘函数对齐）；开发环境直打 `https://api.deepseek.com/...` 并带本地 Key。

**历史注意：** `defaultConfig` 中的 `AI_PROXY_URL` 供 **`aiService`（非流式）** 等路径使用；主聊天 **ChatWindow 仅依赖本文件的 URL 规则**，若全站统一 CloudBase，应在后续迭代让 `streamingAIService` 与 `AI_PROXY_URL` **同源配置**，避免双轨。

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

- **`ttsChunker.ts`**：参考 AIRI 的 **硬/软标点** 与 `Intl.Segmenter`（若可用）做 **词级分块**，生成带 `reason` 的 `TTSChunk` 生成器；适合更细粒度 TTS 调度（与 `SentenceSplitter` 互补：后者服务流式句界，前者服务长句内部节奏）。
- **`TextProsodyProcessor`**：对纯文本做 **换行停顿**、情感词附近断句等 **文本级韵律预处理**；可用于增强朗读节奏（是否接入主路径视产品配置而定）。

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

### 4.21 自建库（VRMAnimation / LookAt Smoother）

- **`lib/VRMAnimation/`**：加载 `.vrma`、挂到 VRM 的 clip 体系；主流程若未强制依赖外部动画文件，仍可作为 **扩展动作** 入口。
- **`VRMLookAtSmootherLoaderPlugin`**：在解析阶段包装 `lookAt` 行为，减轻 **瞬间扭头** 的机械感（与 `AutoLookAt` 策略叠加时注意不要过度滤波）。

---

### 4.22 ModelLoader（补充）

**文件：** `ModelLoader.ts`

**定位：** 面向 **类式加载、进度、错误处理** 的封装；当前主路径中 `VRMModel` 可能部分逻辑重复。维护时以 **实际运行路径（VRMModel useEffect）** 为准；合并重复可减少「一处修了分片、另一处未修」风险。

---

### 4.23 Electron 桌面壳（可选）

**路径：** `src/electron/*`

**思路：** 主进程窗口、托盘、快捷键、自动更新等经典 Electron 结构。Web 部署为主时 **可不构建**；若打包桌面，需单独处理 **与 Web 相同的 API 代理**（本地无 `/api/ai` 时需配 dev server 或内置 proxy）。

---

### 4.24 构建与本地开发（Vite）

**文件：** `vite.config.ts`

- **React 插件** + 开发 Server `host: true`、`open: true`。
- **代理**：`/__minimax-ai`、`/__minimax-tts` → `https://api.minimaxi.com`，`changeOrigin` 解决浏览器 CORS。

**`package.json` 的 `build`：** 构建前删除 `dist` 与 `node_modules/.vite`，减轻 **CI 与 Cloudflare 缓存导致的旧 bundle** 问题。

---

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

### 修正 10：技术文档第四章扩展为「全模块」实现说明

**问题：** 原技术文档仅侧重核心链路，未逐模块说明职责与调用关系。

**修正：** 重写第四章，补全 UI 壳、聊天子组件、`ChatWindow` 编排、三维各层、AI/TTS 变体、工具类、Settings 各 Tab、Store 分工、IndexedDB、自建库、Vite/Electron 可选路径，并标注备选/未挂载组件与历史双轨配置注意点。

---

*文档由 Cursor AI 辅助整理，持续更新中。*
