/**
 * VoiceChatDemo - 语音聊天演示组件
 * 展示完整的语音聊天功能集成
 */
import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatInterface, { Message, EmotionType } from './ChatInterface';
import VoiceInputButton from './VoiceInputButton';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import styles from './VoiceChatDemo.module.css';

// 演示消息列表
const demoMessages: Message[] = [
  {
    id: '1',
    type: 'assistant',
    content: '你好！我是小暖，很高兴见到你。有什么我可以帮助你的吗？',
    emotion: 'happy',
    timestamp: new Date(Date.now() - 60000),
  },
];

// 情感类型映射
const emotionLabels: Record<EmotionType, string> = {
  happy: '开心',
  sad: '悲伤',
  angry: '愤怒',
  surprised: '惊讶',
  fearful: '恐惧',
  disgusted: '厌恶',
  neutral: '中性',
  thinking: '思考中',
};

/**
 * VoiceChatDemo 组件
 */
const VoiceChatDemo: React.FC = () => {
  // 消息状态
  const [messages, setMessages] = useState<Message[]>(demoMessages);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // 语音聊天功能
  const {
    isRecording,
    recognizedText,
    interimText,
    isSpeaking,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
  } = useVoiceChat();

  // 当识别文本变化时，更新输入框
  useEffect(() => {
    if (recognizedText) {
      setInputText(recognizedText);
    }
  }, [recognizedText]);

  /**
   * 处理发送消息
   */
  const handleSendMessage = useCallback((content: string) => {
    if (!content.trim()) return;

    // 添加用户消息
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // 模拟助手回复
    setTimeout(() => {
      const emotions: EmotionType[] = ['happy', 'neutral', 'surprised', 'thinking'];
      const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
      
      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        type: 'assistant',
        content: generateResponse(content, randomEmotion),
        emotion: randomEmotion,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);

      // 自动播放语音回复
      speak(assistantMessage.content, assistantMessage.emotion);
    }, 1500);
  }, [speak]);

  /**
   * 处理语音输入开始
   */
  const handleVoiceStart = useCallback(() => {
    startRecording();
  }, [startRecording]);

  /**
   * 处理语音输入结束
   */
  const handleVoiceEnd = useCallback(() => {
    stopRecording();
    // 如果有识别文本，自动发送
    if (recognizedText.trim()) {
      handleSendMessage(recognizedText);
    }
  }, [stopRecording, recognizedText, handleSendMessage]);

  /**
   * 格式化时间
   */
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      {/* 标题栏 */}
      <motion.header 
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={styles.headerContent}>
          <h1 className={styles.title}>语音对话演示</h1>
          <div className={styles.status}>
            {isRecording && (
              <motion.div 
                className={styles.recordingBadge}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <span className={styles.recordingDot}></span>
                录音中
              </motion.div>
            )}
            {isSpeaking && (
              <motion.div 
                className={styles.speakingBadge}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                🔊 播放中
              </motion.div>
            )}
          </div>
        </div>
      </motion.header>

      {/* 状态指示面板 */}
      <motion.div 
        className={styles.statusPanel}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 className={styles.statusTitle}>语音状态</h3>
        
        <div className={styles.statusGrid}>
          {/* 录音状态 */}
          <div className={`${styles.statusItem} ${isRecording ? styles.active : ''}`}>
            <span className={styles.statusLabel}>录音</span>
            <span className={styles.statusValue}>
              {isRecording ? '●' : '○'}
            </span>
          </div>

          {/* 识别文本 */}
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>识别文本</span>
            <span className={styles.statusValue}>
              {interimText || recognizedText || '-'}
            </span>
          </div>

          {/* 播放状态 */}
          <div className={`${styles.statusItem} ${isSpeaking ? styles.active : ''}`}>
            <span className={styles.statusLabel}>播放</span>
            <span className={styles.statusValue}>
              {isSpeaking ? '🔊' : '🔇'}
            </span>
          </div>
        </div>

        {/* 录音波形指示 */}
        <AnimatePresence>
          {isRecording && (
            <motion.div 
              className={styles.waveIndicator}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 40 }}
              exit={{ opacity: 0, height: 0 }}
            >
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.span
                  key={i}
                  className={styles.waveBar}
                  animate={{
                    height: [10, 30, 15, 35, 20, 25, 10],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: i * 0.05,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 聊天界面 */}
      <motion.div 
        className={styles.chatContainer}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <ChatInterface
          virtualHumanEmotion="happy"
          isVirtualHumanSpeaking={isSpeaking}
          recognizedText={recognizedText}
          isRecording={isRecording}
          onSendMessage={handleSendMessage}
          onVoiceStart={handleVoiceStart}
          onVoiceEnd={handleVoiceEnd}
        />
      </motion.div>

      {/* 使用说明 */}
      <motion.div 
        className={styles.helpPanel}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className={styles.helpTitle}>使用说明</h3>
        <ul className={styles.helpList}>
          <li>
            <kbd>点击麦克风</kbd> 或按 <kbd>Space</kbd> 开始录音
          </li>
          <li>
            <kbd>再次点击</kbd> 或按 <kbd>Space</kbd> 停止录音
          </li>
          <li>
            识别完成后会自动发送消息
          </li>
          <li>
            助手回复会自动语音播放
          </li>
        </ul>
      </motion.div>
    </div>
  );
};

/**
 * 生成模拟回复
 */
function generateResponse(input: string, emotion: EmotionType): string {
  const responses: Record<EmotionType, string[]> = {
    happy: [
      '听起来真不错！能详细说说吗？',
      '太棒了！我很感兴趣。',
      '很高兴听到这个消息！',
      '这真是令人开心的一天！',
    ],
    sad: [
      '我理解你的感受。',
      '听起来有些让人难过。',
      '别太担心，一切都会好起来的。',
      '需要我陪你聊聊吗？',
    ],
    angry: [
      '我理解你的感受，慢慢说。',
      '这确实让人很生气。',
      '深呼吸，我们一起想办法。',
      '不要着急，慢慢告诉我。',
    ],
    surprised: [
      '哇！这真是意想不到！',
      '真的吗？太神奇了！',
      '这个消息让我很惊讶！',
      '真的吗？请告诉我更多！',
    ],
    fearful: [
      '别担心，我会帮你的。',
      '一切都会好起来的。',
      '不要害怕，有我在。',
      '慢慢说，我会认真听的。',
    ],
    disgusted: [
      '听起来确实不太舒服。',
      '我能理解你的感受。',
      '这种情况确实让人困扰。',
      '换个话题吧，让我们聊点开心的。',
    ],
    neutral: [
      '我明白了，请继续说。',
      '好的，我听着呢。',
      '然后呢？',
      '请告诉我更多细节。',
    ],
    thinking: [
      '让我想想...',
      '这是一个有趣的问题。',
      '我需要考虑一下。',
      '嗯...你说的有道理。',
    ],
  };

  const options = responses[emotion];
  return options[Math.floor(Math.random() * options.length)];
}

export default VoiceChatDemo;
