/**
 * 聊天窗口组件 - 主协调组件
 * ChatVRM / Discord 风格布局：全屏模型 + 底部悬浮对话框
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { streamingAIService } from '../../services/ai/streamingAIService';
import { SentenceSplitter } from '../../services/ai/sentenceSplitter';
import { ttsQueueManager } from '../../services/tts/ttsQueueManager';
import { emotionAnalyzer } from '../../services/ai/emotionAnalyzer';
import { EmotionType } from '../VirtualHuman/VRMModel';
import { LipSyncResult } from '../../utils/lipSyncAnalyzer';
import { useAssetStore, useCurrentScene } from '../../store/assetStore';
import { useCharacterStore } from '../../store/characterStore';
import { useTTSConfigStore } from '../../store/ttsConfigStore';
import VirtualHuman from '../VirtualHuman/VirtualHuman';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import './ChatWindow.css';

// ==================== 类型定义 ====================

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// 场景配置
interface SceneConfig {
  id: string;
  name: string;
  thumbnail: string;
  background: string;
}

// 预设场景列表（渐变背景）
const PRESET_SCENES: SceneConfig[] = [
  {
    id: 'counseling-room',
    name: '咨询室',
    thumbnail: '/scenes/counseling-room.png',
    background: '/scenes/counseling-room.png'
  },
  {
    id: 'none',
    name: '默认暖色',
    thumbnail: '',
    background: '' // 使用默认的暖色背景
  },
  {
    id: 'gradient-sunset',
    name: '日落渐变',
    thumbnail: '',
    background: 'gradient:linear-gradient(135deg, #f5af19 0%, #f12711 100%)'
  },
  {
    id: 'gradient-ocean',
    name: '海洋渐变',
    thumbnail: '',
    background: 'gradient:linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    id: 'gradient-forest',
    name: '森林渐变',
    thumbnail: '',
    background: 'gradient:linear-gradient(135deg, #134e5e 0%, #71b280 100%)'
  },
  {
    id: 'gradient-night',
    name: '夜空渐变',
    thumbnail: '',
    background: 'gradient:linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)'
  }
];

// ==================== 主组件 ====================

const ChatWindow: React.FC = () => {
  // 消息状态
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  
  // 虚拟人交互状态
  const [currentVolume, setCurrentVolume] = useState(0);
  const [lipSyncData, setLipSyncData] = useState<LipSyncResult | null>(null);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
  const [textType, setTextType] = useState<'question' | 'emphasis' | 'greeting' | 'agreement' | 'normal'>('normal');
  
  // 人设切换监听
  const currentCharacterId = useCharacterStore(state => state.currentCharacterId);
  // 情绪灵敏度
  const emotionSensitivity = useTTSConfigStore(state => state.ttsConfig.emotionSensitivity ?? 0.5);

  // 场景状态（预设场景ID，自定义场景使用 'custom-indexeddb'）
  const { currentPresetSceneId: currentPresetScene, selectPresetScene: setCurrentPresetScene } = useAssetStore();
  const [showSceneSelector, setShowSceneSelector] = useState(false);
  
  // IndexedDB 场景
  const { scenes: customScenes, init: initAssets, selectScene } = useAssetStore();
  const { id: currentCustomSceneId, url: currentCustomSceneUrl } = useCurrentScene();
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sentenceSplitterRef = useRef<SentenceSplitter>(new SentenceSplitter());
  
  // 初始化资源
  useEffect(() => {
    initAssets();
  }, [initAssets]);

  // 人设切换时：清空 AI 对话历史 & 页面消息，让新人设从零开始
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    streamingAIService.clearHistory();
    ttsQueueManager.stop();
    setMessages([]);
    setStreamingText('');
    setCurrentEmotion('neutral');
    console.log('[ChatWindow] 人设已切换，对话历史已清空');
  }, [currentCharacterId]);

  // ==================== 获取当前场景背景 ====================

  const getCurrentSceneBackground = useCallback(() => {
    // 如果选择了 IndexedDB 自定义场景
    if (currentCustomSceneId && currentCustomSceneUrl) {
      return currentCustomSceneUrl;
    }
    // 否则使用预设场景
    const scene = PRESET_SCENES.find(s => s.id === currentPresetScene);
    return scene?.background || '';
  }, [currentPresetScene, currentCustomSceneId, currentCustomSceneUrl]);

  // ==================== 滚动到底部 ====================

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // ==================== TTS回调设置 ====================

  useEffect(() => {
    console.log('[ChatWindow] 设置TTS回调');
    ttsQueueManager.setCallbacks({
      onAudioStart: () => {
        console.log('[ChatWindow] onAudioStart - 开始说话');
        setIsSpeaking(true);
      },
      onAudioEnd: () => {
        console.log('[ChatWindow] onAudioEnd - 停止说话');
        setIsSpeaking(false);
        setLipSyncData(null);
      },
      onVolumeUpdate: (volume) => setCurrentVolume(volume),
      onLipSyncUpdate: (result) => {
        if (Math.random() < 0.01) {
          console.log('[ChatWindow] onLipSyncUpdate:', result);
        }
        setLipSyncData(result);
      },
    });
  }, []);

  // ==================== 发送消息处理 ====================

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    setStreamingText('');

    sentenceSplitterRef.current.reset();

    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      await streamingAIService.streamResponse(
        userMessage,
        (chunk) => {
          setStreamingText((prev) => prev + chunk);
          
          const sentences = sentenceSplitterRef.current.feed(chunk);
          
          for (const sentence of sentences) {
            if (sentence.text.trim()) {
              const sentenceEmotion = emotionAnalyzer.analyze(sentence.text, emotionSensitivity).emotion;
              const mappedSentenceEmotion = sentenceEmotion === 'thinking' ? 'neutral' : sentenceEmotion;
              console.log('[流式TTS] 发送句子:', sentence.text, '情感:', sentenceEmotion);
              ttsQueueManager.addSentence(sentence.text, sentenceEmotion);
              // 实时同步 VRM 表情，不等完整回复
              setCurrentEmotion(mappedSentenceEmotion as EmotionType);
            }
          }
        },
        (fullText) => {
          const remaining = sentenceSplitterRef.current.flush();
          if (remaining && remaining.text.trim()) {
            const remainingEmotion = emotionAnalyzer.analyze(remaining.text, emotionSensitivity).emotion;
            console.log('[流式TTS] 发送剩余句子:', remaining.text, '情感:', remainingEmotion);
            ttsQueueManager.addSentence(remaining.text, remainingEmotion);
          }

          // 用完整文本更新 VRM 表情（整体情感更准确）
          const emotionResult = emotionAnalyzer.analyze(fullText, emotionSensitivity);
          const mappedEmotion = emotionResult.emotion === 'thinking' ? 'neutral' : emotionResult.emotion;
          setCurrentEmotion(mappedEmotion as EmotionType);
          
          const detectedTextType = emotionAnalyzer.detectTextType(fullText);
          setTextType(detectedTextType);

          const newAiMessage: Message = {
            role: 'assistant',
            content: fullText,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, newAiMessage]);
          setStreamingText('');
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error('获取AI回复失败:', error);
      setStreamingText('');
      setIsLoading(false);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: '抱歉，我遇到了一些问题，请稍后再试。',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  }, [inputValue, isLoading]);

  // ==================== 停止处理 ====================

  const handleStop = useCallback(() => {
    ttsQueueManager.stop();
    setIsSpeaking(false);
    setCurrentVolume(0);
  }, []);

  // ==================== 输入处理 ====================

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  // ==================== 场景选择 ====================

  const handlePresetSceneChange = useCallback((sceneId: string) => {
    setCurrentPresetScene(sceneId); // 内部已清 currentSceneId
    setShowSceneSelector(false);
  }, [setCurrentPresetScene]);

  const handleCustomSceneChange = useCallback((sceneId: string) => {
    selectScene(sceneId);
    setShowSceneSelector(false);
  }, [selectScene]);

  // ==================== 渲染 ====================

  const backgroundUrl = getCurrentSceneBackground();
  
  // 解析背景样式
  const getBackgroundStyle = () => {
    if (!backgroundUrl) {
      return { backgroundColor: '#f5f0eb' };
    }
    if (backgroundUrl.startsWith('gradient:')) {
      return { background: backgroundUrl.replace('gradient:', '') };
    }
    return { backgroundImage: `url(${backgroundUrl})` };
  };

  return (
    <div className="chat-window-container">
      {/* 场景背景层 */}
      <div 
        className="scene-background"
        style={getBackgroundStyle()}
      />

      {/* 虚拟人层（全屏） */}
      <div className="virtual-human-section">
        <VirtualHuman 
          isSpeaking={isSpeaking || isLoading} 
          volume={currentVolume}
          lipSyncData={lipSyncData}
          emotion={currentEmotion}
          textType={textType}
          transparent={currentPresetScene !== 'none' || !!currentCustomSceneId}
        />
      </div>

      {/* 顶部工具栏 */}
      <div className="top-toolbar">
        <div className="toolbar-left">
          <div>
            <div className="toolbar-title">小暖</div>
            <div className="toolbar-subtitle">心理咨询师 · 在线</div>
          </div>
        </div>
        <div className="toolbar-right">
          <button 
            className={`toolbar-button ${showSceneSelector ? 'active' : ''}`}
            onClick={() => setShowSceneSelector(!showSceneSelector)}
            title="切换场景"
          >
            🖼️
          </button>
          <button 
            className="toolbar-button"
            onClick={() => window.dispatchEvent(new CustomEvent('openSettings'))}
            title="设置"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* 场景选择器 */}
      <div className={`scene-selector ${showSceneSelector ? 'visible' : ''}`}>
        <div className="scene-selector-title">预设背景</div>
        {PRESET_SCENES.map(scene => {
          // 获取缩略图样式
          const getThumbnailStyle = () => {
            if (scene.thumbnail) return {};
            if (scene.background.startsWith('gradient:')) {
              return { background: scene.background.replace('gradient:', '') };
            }
            return { background: 'linear-gradient(135deg, #f5f0eb, #e8e0d8)' };
          };
          
          const isActive = !currentCustomSceneId && currentPresetScene === scene.id;
          
          return (
            <div
              key={scene.id}
              className={`scene-option ${isActive ? 'active' : ''}`}
              onClick={() => handlePresetSceneChange(scene.id)}
            >
              {scene.thumbnail ? (
                <img 
                  src={scene.thumbnail} 
                  alt={scene.name}
                  className="scene-thumbnail"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="scene-thumbnail" style={getThumbnailStyle()} />
              )}
              <span className="scene-name">{scene.name}</span>
            </div>
          );
        })}
        
        {/* 自定义场景（来自 IndexedDB） */}
        {customScenes.length > 0 && (
          <>
            <div className="scene-selector-title" style={{ marginTop: '12px' }}>自定义背景</div>
            {customScenes.map(scene => (
              <div
                key={scene.id}
                className={`scene-option ${currentCustomSceneId === scene.id ? 'active' : ''}`}
                onClick={() => handleCustomSceneChange(scene.id)}
              >
                {scene.thumbnail ? (
                  <img 
                    src={scene.thumbnail} 
                    alt={scene.name}
                    className="scene-thumbnail"
                  />
                ) : (
                  <div className="scene-thumbnail" style={{ background: '#333' }}>🖼️</div>
                )}
                <span className="scene-name">{scene.name}</span>
              </div>
            ))}
          </>
        )}
        
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
          提示：在设置 → 资源中上传更多背景
        </div>
      </div>

      {/* 聊天面板（底部悬浮） */}
      <div className="chat-section">
        <MessageList
          messages={messages}
          streamingText={streamingText}
          isLoading={isLoading}
          isSpeaking={isSpeaking}
        />

        <InputArea
          inputValue={inputValue}
          isLoading={isLoading}
          isSpeaking={isSpeaking}
          onInputChange={handleInputChange}
          onSend={handleSend}
          onStop={handleStop}
        />
      </div>
      
      {/* 滚动锚点 */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;
