/**
 * 输入区域组件 - 处理用户输入
 */

import React, { memo, useCallback } from 'react';

interface InputAreaProps {
  inputValue: string;
  isLoading: boolean;
  isSpeaking: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  placeholder?: string;
}

export const InputArea: React.FC<InputAreaProps> = memo(({
  inputValue,
  isLoading,
  isSpeaking,
  onInputChange,
  onSend,
  onStop,
  placeholder = "在这里分享你的感受、困扰或任何想说的话..."
}) => {
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }, [onSend]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    onSend();
  }, [inputValue.trim(), isLoading, onSend]);

  const handleStop = useCallback(() => {
    onStop();
  }, [onStop]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);
  }, [onInputChange]);

  return (
    <div className="chat-input-container">
      <textarea
        className="chat-input"
        value={inputValue}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        rows={2}
        disabled={isLoading && !isSpeaking}
      />
      <div className="button-group">
        {isSpeaking && (
          <button className="stop-button" onClick={handleStop}>
            停止
          </button>
        )}
        <button 
          className="send-button" 
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
        >
          发送
        </button>
      </div>
    </div>
  );
});

InputArea.displayName = 'InputArea';

export default InputArea;
