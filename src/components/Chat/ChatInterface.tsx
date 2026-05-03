/**
 * ChatInterface - 现代化聊天界面组件
 * 提供流畅的对话体验，支持情感化消息展示和语音交互
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VirtualHuman from '../VirtualHuman/VirtualHuman';
import StatusIndicator from '../VirtualHuman/StatusIndicator';
import EmotionIndicator from '../VirtualHuman/EmotionIndicator';
import VoiceInputButton from './VoiceInputButton';
import MessageBubble from './MessageBubble';
import styles from './ChatInterface.module.css';

// 消息类型定义
export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  emotion?: EmotionType;
  timestamp: Date;
  isTyping?: boolean;
}

// 情感类型
export type EmotionType = 
  | 'happy' 
  | 'sad' 
  | 'angry' 
  | 'surprised' 
  | 'fearful' 
  | 'disgusted' 
  | 'neutral'
  | 'thinking';

// 消息气泡样式配置
export interface BubbleStyle {
  gradient: string;
  borderColor: string;
  shadowColor: string;
}

// 组件属性接口
export interface ChatInterfaceProps {
  /** 虚拟人模型URL */
  modelUrl?: string;
  /** 初始消息列表 */
  initialMessages?: Message[];
  /** 虚拟人当前情感 */
  virtualHumanEmotion?: EmotionType;
  /** 虚拟人是否正在说话 */
  isVirtualHumanSpeaking?: boolean;
  /** 语音识别文本 */
  recognizedText?: string;
  /** 录音中状态 */
  isRecording?: boolean;
  /** 是否显示情感指示器 */
  showEmotionIndicator?: boolean;
  /** 是否显示状态指示器 */
  showStatusIndicator?: boolean;
  /** 自定义标题 */
  title?: string;
  /** 发送消息回调 */
  onSendMessage?: (message: string) => void;
  /** 语音输入开始回调 */
  onVoiceStart?: () => void;
  /** 语音输入结束回调 */
  onVoiceEnd?: () => void;
  /** 情感变化回调 */
  onEmotionChange?: (emotion: EmotionType) => void;
  /** 模型加载完成回调 */
  onModelLoad?: (model: any) => void;
  /** 输入框占位符 */
  placeholder?: string;
  /** 是否禁用输入 */
  disabled?: boolean;
}

/**
 * 获取情感对应的气泡样式
 */
const getBubbleStyle = (emotion: EmotionType): BubbleStyle => {
  const styles: Record<EmotionType, BubbleStyle> = {
    happy: {
      gradient: 'linear-gradient(135deg, #81c784 0%, #66bb6a 100%)',
      borderColor: '#4caf50',
      shadowColor: 'rgba(76, 175, 80, 0.4)',
    },
    sad: {
      gradient: 'linear-gradient(135deg, #64b5f6 0%, #42a5f5 100%)',
      borderColor: '#2196f3',
      shadowColor: 'rgba(33, 150, 243, 0.4)',
    },
    angry: {
      gradient: 'linear-gradient(135deg, #ef5350 0%, #e53935 100%)',
      borderColor: '#f44336',
      shadowColor: 'rgba(244, 67, 54, 0.4)',
    },
    surprised: {
      gradient: 'linear-gradient(135deg, #ffb74d 0%, #ffa726 100%)',
      borderColor: '#ff9800',
      shadowColor: 'rgba(255, 152, 0, 0.4)',
    },
    fearful: {
      gradient: 'linear-gradient(135deg, #7e57c2 0%, #5e35b1 100%)',
      borderColor: '#673ab7',
      shadowColor: 'rgba(103, 58, 183, 0.4)',
    },
    disgusted: {
      gradient: 'linear-gradient(135deg, #4db6ac 0%, #26a69a 100%)',
      borderColor: '#009688',
      shadowColor: 'rgba(0, 150, 136, 0.4)',
    },
    neutral: {
      gradient: 'linear-gradient(135deg, #78909c 0%, #546e7a 100%)',
      borderColor: '#607d8b',
      shadowColor: 'rgba(96, 125, 139, 0.4)',
    },
    thinking: {
      gradient: 'linear-gradient(135deg, #90a4ae 0%, #78909c 100%)',
      borderColor: '#8d6e63',
      shadowColor: 'rgba(141, 110, 99, 0.4)',
    },
  };
  return styles[emotion] || styles.neutral;
};

/**
 * 生成唯一消息ID
 */
const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * ChatInterface 组件主体
 */
const ChatInterface: React.FC<ChatInterfaceProps> = ({
  modelUrl,
  initialMessages = [],
  virtualHumanEmotion = 'neutral',
  isVirtualHumanSpeaking = false,
  recognizedText = '',
  isRecording = false,
  showEmotionIndicator = true,
  showStatusIndicator = true,
  title = '与小暖对话',
  onSendMessage,
  onVoiceStart,
  onVoiceEnd,
  onEmotionChange,
  onModelLoad,
  placeholder = '输入消息或点击麦克风进行语音输入...',
  disabled = false,
}) => {
  // 消息列表状态
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  // 输入文本状态
  const [inputText, setInputText] = useState('');
  // 滚动容器引用
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 输入框引用
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /**
   * 自动滚动到最新消息
   */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /**
   * 处理消息发送
   */
  const handleSendMessage = useCallback(() => {
    if (!inputText.trim() || disabled) return;

    const newMessage: Message = {
      id: generateMessageId(),
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    onSendMessage?.(inputText.trim());
    setInputText('');
  }, [inputText, disabled, onSendMessage]);

  /**
   * 处理键盘输入（支持Ctrl+Enter换行）
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  /**
   * 处理语音输入文本更新
   */
  useEffect(() => {
    if (recognizedText) {
      setInputText(recognizedText);
    }
  }, [recognizedText]);

  /**
   * 处理语音输入开始
   */
  const handleVoiceStart = useCallback(() => {
    onVoiceStart?.();
  }, [onVoiceStart]);

  /**
   * 处理语音输入结束
   */
  const handleVoiceEnd = useCallback(() => {
    onVoiceEnd?.();
  }, [onVoiceEnd]);

  /**
   * 处理发送按钮点击
   */
  const handleSendClick = useCallback(() => {
    handleSendMessage();
  }, [handleSendMessage]);

  /**
   * 格式化时间显示
   */
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      {/* 头部区域 */}
      <motion.header 
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{title}</h1>
          {showEmotionIndicator && (
            <EmotionIndicator 
              emotion={virtualHumanEmotion} 
              size="small"
            />
          )}
        </div>
        <div className={styles.headerRight}>
          {showStatusIndicator && (
            <StatusIndicator 
              isSpeaking={isVirtualHumanSpeaking}
              emotion={virtualHumanEmotion}
            />
          )}
        </div>
      </motion.header>

      {/* 主内容区域 */}
      <div className={styles.mainContent}>
        {/* 3D虚拟人展示区域 */}
        <motion.aside 
          className={styles.virtualHumanPanel}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className={styles.modelContainer}>
            <VirtualHuman
              isSpeaking={isVirtualHumanSpeaking || false}
              emotion={virtualHumanEmotion as any}
            />
          </div>
          {/* 虚拟人信息卡片 */}
          <motion.div 
            className={styles.infoCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className={styles.infoAvatar}>
              <span>暖</span>
            </div>
            <div className={styles.infoContent}>
              <h3 className={styles.infoName}>小暖</h3>
              <p className={styles.infoStatus}>
                {isVirtualHumanSpeaking ? '正在说话...' : '在线'}
              </p>
            </div>
          </motion.div>
        </motion.aside>

        {/* 聊天区域 */}
        <motion.div 
          className={styles.chatPanel}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {/* 消息列表 */}
          <div className={styles.messageList}>
            <AnimatePresence initial={false}>
              {messages.length === 0 && (
                <motion.div
                  className={styles.emptyState}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className={styles.emptyIcon}>💬</div>
                  <p className={styles.emptyText}>
                    开始与小暖对话吧！
                    <br />
                    <small>可以输入文字或使用语音输入</small>
                  </p>
                </motion.div>
              )}
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`${styles.messageItem} ${
                    message.type === 'user' ? styles.userMessage : styles.assistantMessage
                  }`}
                >
                  <div className={styles.messageAvatar}>
                    {message.type === 'user' ? (
<span>我</span>
                    ) : (
                      <span>暖</span>
                    )}
                  </div>
                  <div className={styles.messageContent}>
                    <MessageBubble
                      content={message.content}
                      emotion={message.type === 'assistant' ? message.emotion : undefined}
                      timestamp={formatTime(message.timestamp)}
                      isOwn={message.type === 'user'}
                      isTyping={message.isTyping}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {/* 滚动锚点 */}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <motion.div 
            className={styles.inputArea}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <div className={styles.inputWrapper}>
              <textarea
                ref={inputRef}
                className={styles.textInput}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
              />
              <VoiceInputButton
                isRecording={isRecording}
                onStart={handleVoiceStart}
                onEnd={handleVoiceEnd}
                disabled={disabled}
              />
            </div>
            <motion.button
              className={styles.sendButton}
              onClick={handleSendClick}
              disabled={!inputText.trim() || disabled}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className={styles.sendIcon}>➤</span>
              <span className={styles.sendText}>发送</span>
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default ChatInterface;
