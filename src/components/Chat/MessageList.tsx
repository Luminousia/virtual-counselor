/**
 * 消息列表组件 - 显示聊天消息
 */

import React, { memo } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface MessageListProps {
  messages: Message[];
  streamingText: string;
  isLoading: boolean;
  isSpeaking?: boolean;  // 保留但可选
}

const MessageItem: React.FC<{ message: Message }> = memo(({ message }) => {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`message ${message.role === 'user' ? 'user-message' : 'ai-message'}`}>
      <div className="message-content">{message.content}</div>
      <div className="message-time">{formattedTime}</div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

const StreamingMessage: React.FC<{ text: string }> = memo(({ text }) => {
  return (
    <div className="message ai-message streaming">
      <div className="message-content">{text}</div>
      <div className="streaming-indicator">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
    </div>
  );
});

StreamingMessage.displayName = 'StreamingMessage';

const TypingIndicator: React.FC = memo(() => {
  return (
    <div className="message ai-message">
      <div className="message-content typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';

const WelcomeMessage: React.FC = memo(() => {
  return (
    <div className="welcome-message">
      <h3>你好，我是小暖</h3>
      <p className="welcome-intro">
        我是你的虚拟数字人心理咨询师，很高兴能在这里陪伴你。
        我会认真倾听，用我的温和、耐心和热情来支持你。
      </p>
    </div>
  );
});

WelcomeMessage.displayName = 'WelcomeMessage';

export const MessageList: React.FC<MessageListProps> = memo(({
  messages,
  streamingText,
  isLoading,
  isSpeaking
}) => {
  return (
    <div className="chat-messages">
      {messages.length === 0 && !streamingText && !isLoading && (
        <WelcomeMessage />
      )}

      {messages.map((msg, index) => (
        <MessageItem key={msg.timestamp || index} message={msg} />
      ))}

      {streamingText && (
        <StreamingMessage text={streamingText} />
      )}

      {isLoading && !streamingText && (
        <TypingIndicator />
      )}
    </div>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
