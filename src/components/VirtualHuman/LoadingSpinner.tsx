/**
 * 加载动画组件
 */

import React from 'react';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  progress?: number;
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  progress = 0, 
  message = '正在加载...' 
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.spinnerWrapper}>
        {/* 主Spinner */}
        <div className={styles.mainSpinner}>
          <div className={styles.innerCircle} />
          <div className={styles.outerCircle} />
        </div>
        
        {/* 花瓣动画 */}
        <div className={styles.petals}>
          {[...Array(6)].map((_, i) => (
            <div 
              key={i} 
              className={styles.petal}
              style={{ 
                transform: `rotate(${i * 60}deg) translateY(-20px)`,
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
        </div>
      </div>
      
      {/* 进度条 */}
      <div className={styles.progressSection}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={styles.progressText}>
          {progress.toFixed(0)}%
        </span>
      </div>
      
      {/* 提示文字 */}
      <p className={styles.message}>{message}</p>
      
      {/* 小暖提示 */}
      <div className={styles.tips}>
        <span className={styles.tipIcon}>🌸</span>
        <span className={styles.tipText}>
          小暖正在准备中，请稍候...
        </span>
      </div>
    </div>
  );
};

export default LoadingSpinner;
