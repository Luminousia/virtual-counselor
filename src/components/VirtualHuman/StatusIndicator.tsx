/**
 * 状态指示器组件
 * 显示数字人的当前状态（说话中、聆听中等）
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './StatusIndicator.module.css';

interface StatusIndicatorProps {
  isSpeaking: boolean;
  emotion?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  isSpeaking, 
  emotion = 'neutral' 
}) => {
  // 获取情感对应的动画配置
  const getEmotionConfig = (emotion: string) => {
    const configs: Record<string, { color: string; icon: string; animation: string }> = {
      happy: { color: '#81c784', icon: '😊', animation: 'bounce' },
      sad: { color: '#64b5f6', icon: '😔', animation: 'fade' },
      angry: { color: '#e57373', icon: '😠', animation: 'shake' },
      surprised: { color: '#ffb74d', icon: '😮', animation: 'pop' },
      fearful: { color: '#9575cd', icon: '😨', animation: 'tremble' },
      disgusted: { color: '#4db6ac', icon: '🤢', animation: 'rotate' },
      neutral: { color: '#8d6e63', icon: '🙂', animation: 'breathe' }
    };
    
    return configs[emotion] || configs.neutral;
  };
  
  const config = getEmotionConfig(emotion);
  
  return (
    <div className={styles.container}>
      {/* 说话状态 */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            className={styles.speakingIndicator}
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <motion.div 
              className={styles.waveContainer}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className={styles.waveBar}
                  animate={{
                    height: [15, 25, 15, 35, 20, 30, 15],
                    opacity: [0.5, 1, 0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    delay: i * 0.1
                  }}
                />
              ))}
            </motion.div>
            <span className={styles.speakingText}>正在说话</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 聆听状态 */}
      <AnimatePresence>
        {!isSpeaking && (
          <motion.div
            className={styles.listeningIndicator}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <motion.div 
              className={styles.pulseRing}
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className={styles.listeningIcon}>🎧</span>
            <span className={styles.listeningText}>聆听中</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 情感状态指示 */}
      <motion.div
        className={styles.emotionBadge}
        style={{ '--emotion-color': config.color } as React.CSSProperties}
        animate={config.animation === 'bounce' ? {
          y: [0, -8, 0]
        } : config.animation === 'shake' ? {
          x: [-2, 2, -2, 2, 0]
        } : config.animation === 'breathe' ? {
          scale: [1, 1.02, 1]
        } : {}}
        transition={{
          duration: config.animation === 'bounce' ? 2 :
                    config.animation === 'shake' ? 0.5 :
                    config.animation === 'breathe' ? 3 : 1,
          repeat: Infinity,
          repeatType: 'reverse'
        }}
      >
        <span className={styles.emotionIcon}>{config.icon}</span>
        <span className={styles.emotionLabel}>
          {emotion === 'neutral' ? '平和' : 
           emotion === 'happy' ? '开心' :
           emotion === 'sad' ? '难过' :
           emotion === 'angry' ? '生气' :
           emotion === 'surprised' ? '惊讶' : '正常'}
        </span>
      </motion.div>
    </div>
  );
};

export default StatusIndicator;
