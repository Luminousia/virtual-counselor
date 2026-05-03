/**
 * Chat 模块导出
 * 统一导出所有聊天相关组件
 */

// 聊天界面主组件
export { default as ChatInterface, type ChatInterfaceProps, type Message, type EmotionType } from './ChatInterface';

// 消息气泡组件
export { default as MessageBubble, type MessageBubbleProps } from './MessageBubble';

// 语音输入按钮组件
export { default as VoiceInputButton, type VoiceInputButtonProps } from './VoiceInputButton';

// 语音聊天演示组件
export { default as VoiceChatDemo } from './VoiceChatDemo';
