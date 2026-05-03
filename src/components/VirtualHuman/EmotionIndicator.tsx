/**
 * 情感指示器组件
 * 显示当前情感的详细状态
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './EmotionIndicator.module.css';

type EmotionType = 'happy' | 'sad' | 'angry' | 'surprised' | 'fearful' | 'disgusted' | 'neutral';

interface EmotionIndicatorProps {
  emotion: EmotionType;
}

const emotions: Record<EmotionType, { 
  icon: string; 
  label: string; 
  color: string;
  description: string;
}> = {
  happy: {
    icon: '😊',
    label: '开心',
    color: '#81c784',
    description: '小暖感到很高兴'
  },
  sad: {
    icon: '😔',
    label: '难过',
    color: '#64b5f6',
    description: '小暖理解你的感受'
  },
  angry: {
    icon: '😠',
    label: '关切',
    color: '#e57373',
    description: '小暖很关心你'
  },
  surprised: {
    icon: '😮',
    label: '惊讶',
    color: '#ffb74d',
    description: '这是个意外的发现'
  },
  fearful: {
    icon: '😨',
    label: '担心',
    color: '#9575cd',
    description: '小暖在认真倾听'
  },
  disgusted: {
    icon: '🤢',
    label: '不适',
    color: '#4db6ac',
    description: '让我帮你分析一下'
  },
  neutral: {
    icon: '🙂',
    label: '平和',
    color: '#8d6e63',
    description: '小暖随时准备倾听'
  }
};

const EmotionIndicator: React.FC<EmotionIndicatorProps> = ({ emotion }) => {
  const [showDetails, setShowDetails] = useState(false);
  const currentEmotion = emotions[emotion] || emotions.neutral;
  
  // 自动显示详情
  useEffect(() => {
    setShowDetails(true);
    const timer = setTimeout(() => {
      setShowDetails(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [emotion]);
  
  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <motion.div
        className={styles.mainIndicator}
        style={{ '--emotion-color': currentEmotion.color } as React.CSSProperties}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowDetails(!showDetails)}
      >
        <motion.span 
          className={styles.icon}
          animate={emotion === 'happy' ? {
            rotate: [0, 10, -10, 0],
            scale: [1, 1.1, 1]
          } : emotion === 'sad' ? {
            y: [0, 3, 0]
          } : {}}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
        >
          {currentEmotion.icon}
        </motion.span>
        <span className={styles.label}>{currentEmotion.label}</span>
        <motion.span 
          className={styles.arrow}
          animate={{ rotate: showDetails ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.span>
      </motion.div>
      
      <AnimatePresence>
        {showDetails && (
          <motion.div
            className={styles.details}
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <div className={styles.description}>
              {currentEmotion.description}
            </div>
            
            {/* 情感强度条 */}
            <div className={styles.intensityBar}>
              <div 
                className={styles.intensityFill}
                style={{ 
                  width: emotion === 'neutral' ? '50%' : 
                         emotion === 'happy' || emotion === 'sad' ? '80%' : '60%' 
                }}
              />
            </div>
            
            {/* 情感建议 */}
            <div className={styles.suggestion}>
              <span className={styles.suggestionIcon}>💡</span>
              <span className={styles.suggestionText}>
                {emotion === 'neutral' ? '可以继续分享你的想法' :
                 emotion === 'happy' ? '分享更多让你开心的事吧' :
                 emotion === 'sad' ? '小暖在这里陪你' :
                 '告诉小暖更多吧'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 背景光效 */}
      <motion.div
        className={styles.glow}
        style={{ background: currentEmotion.color }}
        animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
  );
};

export default EmotionIndicator;
