/**
 * MessageBubble - 情感化消息气泡组件
 * 提供丰富的情感表达和流畅的动画效果
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './MessageBubble.module.css';

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

// 组件属性接口
export interface MessageBubbleProps {
  /** 消息内容 */
  content: string;
  /** 情感类型（仅assistant消息有效） */
  emotion?: EmotionType;
  /** 时间戳 */
  timestamp: string;
  /** 是否为自己的消息 */
  isOwn?: boolean;
  /** 是否正在输入 */
  isTyping?: boolean;
  /** 最大显示行数 */
  maxLines?: number;
  /** 点击回调 */
  onClick?: () => void;
  /** 双击回调 */
  onDoubleClick?: () => void;
}

/**
 * 情感配置映射
 */
const emotionConfigs: Record<EmotionType, {
  gradient: string;
  borderColor: string;
  shadowColor: string;
  icon: string;
}> = {
  happy: {
    gradient: 'linear-gradient(135deg, #81c784 0%, #66bb6a 100%)',
    borderColor: '#4caf50',
    shadowColor: 'rgba(76, 175, 80, 0.4)',
    icon: '😊',
  },
  sad: {
    gradient: 'linear-gradient(135deg, #64b5f6 0%, #42a5f5 100%)',
    borderColor: '#2196f3',
    shadowColor: 'rgba(33, 150, 243, 0.4)',
    icon: '😔',
  },
  angry: {
    gradient: 'linear-gradient(135deg, #ef5350 0%, #e53935 100%)',
    borderColor: '#f44336',
    shadowColor: 'rgba(244, 67, 54, 0.4)',
    icon: '😠',
  },
  surprised: {
    gradient: 'linear-gradient(135deg, #ffb74d 0%, #ffa726 100%)',
    borderColor: '#ff9800',
    shadowColor: 'rgba(255, 152, 0, 0.4)',
    icon: '😮',
  },
  fearful: {
    gradient: 'linear-gradient(135deg, #7e57c2 0%, #5e35b1 100%)',
    borderColor: '#673ab7',
    shadowColor: 'rgba(103, 58, 183, 0.4)',
    icon: '😨',
  },
  disgusted: {
    gradient: 'linear-gradient(135deg, #4db6ac 0%, #26a69a 100%)',
    borderColor: '#009688',
    shadowColor: 'rgba(0, 150, 136, 0.4)',
    icon: '😒',
  },
  neutral: {
    gradient: 'linear-gradient(135deg, #78909c 0%, #546e7a 100%)',
    borderColor: '#607d8b',
    shadowColor: 'rgba(96, 125, 139, 0.4)',
    icon: '😐',
  },
  thinking: {
    gradient: 'linear-gradient(135deg, #90a4ae 0%, #78909c 100%)',
    borderColor: '#8d6e63',
    shadowColor: 'rgba(141, 110, 99, 0.4)',
    icon: '🤔',
  },
};

/**
 * 获取渐变颜色
 */
const getGradient = (emotion: EmotionType | undefined, isOwn: boolean): string => {
  if (isOwn) {
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }
  if (!emotion) {
    return emotionConfigs.neutral.gradient;
  }
  return emotionConfigs[emotion].gradient;
};

/**
 * 获取阴影颜色
 */
const getShadowColor = (emotion: EmotionType | undefined, isOwn: boolean): string => {
  if (isOwn) {
    return 'rgba(102, 126, 234, 0.4)';
  }
  if (!emotion) {
    return emotionConfigs.neutral.shadowColor;
  }
  return emotionConfigs[emotion].shadowColor;
};

/**
 * 打字机效果组件
 */
const TypewriterText: React.FC<{ text: string; speed?: number }> = ({
  text,
  speed = 30,
}) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    let currentIndex = 0;

    const timer = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return <span>{displayedText}</span>;
};

/**
 * 打字指示器组件
 */
const TypingIndicator: React.FC = () => {
  return (
    <div className={styles.typingIndicator}>
      <motion.span
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.2 }}
      />
      <motion.span
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.2, delay: 0.2 }}
      />
      <motion.span
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.2, delay: 0.4 }}
      />
    </div>
  );
};

/**
 * MessageBubble 组件主体
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({
  content,
  emotion,
  timestamp,
  isOwn = false,
  isTyping = false,
  maxLines,
  onClick,
  onDoubleClick,
}) => {
  const [showFullContent, setShowFullContent] = useState(true);

  // 检测是否需要折叠
  const shouldCollapse = useCallback(() => {
    if (!maxLines) return false;
    const lineHeight = 20; // 假设行高为20px
    const maxHeight = lineHeight * maxLines;
    const container = document.createElement('div');
    container.style.fontSize = '14px';
    container.style.lineHeight = '1.5';
    container.style.position = 'absolute';
    container.style.visibility = 'hidden';
    container.style.width = '280px';
    container.textContent = content;
    document.body.appendChild(container);
    const height = container.offsetHeight;
    document.body.removeChild(container);
    return height > maxHeight;
  }, [content, maxLines]);

  const isCollapsed = shouldCollapse();

  // 处理消息点击
  const handleClick = useCallback(() => {
    if (isCollapsed) {
      setShowFullContent(!showFullContent);
    }
    onClick?.();
  }, [isCollapsed, showFullContent, onClick]);

  // 气泡样式
  const bubbleStyle = {
    background: getGradient(emotion, isOwn),
    boxShadow: `0 4px 15px ${getShadowColor(emotion, isOwn)}`,
  };

  return (
    <motion.div
      className={`${styles.bubbleContainer} ${isOwn ? styles.ownBubble : styles.otherBubble}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
    >
      {/* 情感图标 */}
      {!isOwn && emotion && (
        <motion.div
          className={styles.emotionIcon}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          {emotionConfigs[emotion]?.icon}
        </motion.div>
      )}

      {/* 消息气泡 */}
      <div className={styles.bubble} style={bubbleStyle}>
        <AnimatePresence mode="wait">
          {isTyping ? (
            <motion.div
              key="typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TypingIndicator />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={styles.content}
              style={{
                maxHeight: showFullContent ? 'none' : `${maxLines ? maxLines * 20 : 60}px`,
                overflow: 'hidden',
              }}
            >
              <TypewriterText text={content} />
              {isCollapsed && !showFullContent && (
                <span className={styles.expandHint}>...查看更多</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 时间戳 */}
      <span className={styles.timestamp}>{timestamp}</span>

      {/* 状态图标 */}
      {isOwn && (
        <motion.div
          className={styles.statusIcon}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {isTyping ? (
            <span className={styles.sending}>•••</span>
          ) : (
            <span className={styles.sent}>✓✓</span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default MessageBubble;
