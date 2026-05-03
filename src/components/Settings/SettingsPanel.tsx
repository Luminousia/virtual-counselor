import { useState, useEffect, useRef } from 'react'
import { useTTSConfigStore } from '../../store/ttsConfigStore'
import { useAIConfigStore } from '../../store/aiConfigStore'
import { useCharacterStore, useSavedCharacters } from '../../store/characterStore'
import { useAssetStore } from '../../store/assetStore'
import { indexedDBService } from '../../services/storage/indexedDBService'
import { TTSConfigType, MINIMAX_TTS_VOICES, DetectedEmotion, TTSEmotion } from '../../store/defaultConfig'
import './SettingsPanel.css'

const SettingsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'character' | 'model' | 'tts' | 'assets'>('character')
  const [showNewCharacterInput, setShowNewCharacterInput] = useState(false)
  const [newCharacterName, setNewCharacterName] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [showPromptPreview, setShowPromptPreview] = useState(false)
  const [storageInfo, setStorageInfo] = useState<{ scenes: number; models: number; total: number } | null>(null)
  const [useBuiltin, setUseBuiltin] = useState(true)
  const [showEmotionMap, setShowEmotionMap] = useState(false)
  const [useBuiltinTTS, setUseBuiltinTTS] = useState(true)
  const { ttsConfig, setTTSConfig, updateEmotionMapEntry, resetEmotionMap } = useTTSConfigStore()
  const { aiConfig, setAIConfig } = useAIConfigStore()

  const handleToggleBuiltin = (checked: boolean) => {
    setUseBuiltin(checked)
    if (checked) {
      setAIConfig({ apiKey: '', model: 'deepseek-chat' })
    }
  }

  const handleToggleBuiltinTTS = (checked: boolean) => {
    setUseBuiltinTTS(checked)
    if (checked) {
      setTTSConfig({ apiKey: '' })
    }
  }

  const { 
    currentCharacterId,
    getCurrentCharacter,
    setCharacter, 
    switchCharacter,
    saveAsNew,
    deleteCharacter,
    resetToDefault,
    exportCharacter,
    importCharacter,
    getSystemPrompt,
  } = useCharacterStore()
  const {
    scenes,
    models,
    currentSceneId,
    currentPresetSceneId,
    currentModelId,
    isLoading: assetsLoading,
    init: initAssets,
    addScene,
    deleteScene,
    selectScene,
    selectPresetScene,
    addModel,
    deleteModel,
    selectModel,
    getStorageInfo,
    clearAll: clearAllAssets
  } = useAssetStore()
  const savedCharacters = useSavedCharacters()
  
  const character = getCurrentCharacter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sceneInputRef = useRef<HTMLInputElement>(null)
  const modelInputRef = useRef<HTMLInputElement>(null)

  // 监听打开设置事件
  useEffect(() => {
    const handleOpenSettings = () => setIsOpen(true)
    window.addEventListener('openSettings', handleOpenSettings)
    return () => window.removeEventListener('openSettings', handleOpenSettings)
  }, [])

  // 初始化资源存储
  useEffect(() => {
    initAssets()
  }, [initAssets])

  // 加载存储信息
  useEffect(() => {
    if (activeTab === 'assets') {
      getStorageInfo().then(setStorageInfo)
    }
  }, [activeTab, scenes, models, getStorageInfo])

  // 处理场景文件上传
  const handleSceneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        await addScene(file)
      }
    }
    e.target.value = '' // 清空 input
  }

  // 处理模型文件上传
  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.vrm')) {
        await addModel(file)
      }
    }
    e.target.value = ''
  }

  const handleTTSChange = (field: keyof TTSConfigType, value: any) => {
    setTTSConfig({ [field]: value })
  }

  const handleSaveAsNew = () => {
    if (newCharacterName.trim()) {
      saveAsNew(newCharacterName.trim())
      setNewCharacterName('')
      setShowNewCharacterInput(false)
    }
  }

  const handleExport = (id: string) => {
    const json = exportCharacter(id)
    if (json) {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const char = savedCharacters.find(c => c.id === id)
      a.href = url
      a.download = `character_${char?.name || 'export'}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleImport = () => {
    if (importJson.trim()) {
      const success = importCharacter(importJson.trim())
      if (success) {
        setImportJson('')
        setShowImportModal(false)
        alert('导入成功！')
      } else {
        alert('导入失败，请检查JSON格式')
      }
    }
  }

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setImportJson(content)
      }
      reader.readAsText(file)
    }
  }

  return (
    <>
      <button 
        className="settings-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="设置"
      >
        ⚙️
      </button>

      {isOpen && (
        <div className="settings-overlay" onClick={() => setIsOpen(false)}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>设置</h2>
              <button 
                className="close-btn"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            {/* 标签页切换 */}
            <div className="settings-tabs">
              <button 
                className={`tab-btn ${activeTab === 'character' ? 'active' : ''}`}
                onClick={() => setActiveTab('character')}
              >
                👤 人设
              </button>
              <button 
                className={`tab-btn ${activeTab === 'model' ? 'active' : ''}`}
                onClick={() => setActiveTab('model')}
              >
                🎭 模型
              </button>
              <button 
                className={`tab-btn ${activeTab === 'tts' ? 'active' : ''}`}
                onClick={() => setActiveTab('tts')}
              >
                🎤 语音
              </button>
              <button 
                className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
                onClick={() => setActiveTab('assets')}
              >
                📦 资源
              </button>
            </div>

            <div className="settings-content">
              {/* 人设设置 */}
              {activeTab === 'character' && (
                <div className="character-settings">

                  {/* 若用户保存了多个人设，显示切换器 */}
                  {savedCharacters.length > 1 && (
                    <div className="setting-group">
                      <label>当前人设</label>
                      <div className="character-switcher">
                        <select
                          value={currentCharacterId}
                          onChange={(e) => switchCharacter(e.target.value)}
                        >
                          {savedCharacters.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {currentCharacterId !== 'default' && (
                          <button
                            className="icon-btn danger"
                            title="删除此人设"
                            onClick={() => {
                              if (confirm(`确定删除人设"${character.name}"吗？`)) {
                                deleteCharacter(currentCharacterId)
                              }
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 名称 */}
                  <div className="setting-group">
                    <label>名称</label>
                    <input
                      type="text"
                      value={character.name}
                      onChange={(e) => setCharacter({ name: e.target.value })}
                      placeholder="虚拟人的名字"
                    />
                  </div>

                  {/* 核心信念与性格 */}
                  <div className="setting-group">
                    <label>核心信念 &amp; 性格</label>
                    <textarea
                      value={character.personality}
                      onChange={(e) => setCharacter({ personality: e.target.value })}
                      placeholder="例如：极致共情、温暖包容、真诚透明……坚信来访者才是自己生活的专家"
                      rows={3}
                    />
                  </div>

                  {/* 背景设定 */}
                  <div className="setting-group">
                    <label>身份背景 &amp; 职业边界</label>
                    <textarea
                      value={character.background}
                      onChange={(e) => setCharacter({ background: e.target.value })}
                      placeholder="咨询师的流派、专长，以及遇到危机情况时如何处理……"
                      rows={3}
                    />
                  </div>

                  {/* 说话风格 */}
                  <div className="setting-group">
                    <label>说话风格 &amp; 交互规则</label>
                    <textarea
                      value={character.speakingStyle}
                      onChange={(e) => setCharacter({ speakingStyle: e.target.value })}
                      placeholder={`- 情感反射优先：从确认对方情绪开始\n- 非指导性提问：不说"你应该"，多用开放式探索\n- 字数控制：每次回复 0-100 字\n- 禁止说教，克制分析`}
                      rows={6}
                    />
                  </div>

                  {/* 高级：自定义提示词 */}
                  <div className="setting-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={character.useCustomPrompt}
                        onChange={(e) => setCharacter({ useCustomPrompt: e.target.checked })}
                      />
                      使用完整自定义系统提示词（高级，覆盖以上所有设置）
                    </label>
                  </div>

                  {character.useCustomPrompt && (
                    <div className="setting-group">
                      <label>自定义系统提示词</label>
                      <textarea
                        value={character.customPrompt}
                        onChange={(e) => setCharacter({ customPrompt: e.target.value })}
                        placeholder="完整的系统提示词，将直接发送给 AI，完全覆盖上面的所有设置..."
                        rows={10}
                        className="custom-prompt-textarea"
                      />
                      <small>此提示词将直接发送给 AI，完全覆盖上面的设置</small>
                    </div>
                  )}

                  {/* 提示词预览 */}
                  <div className="prompt-preview-section">
                    <button
                      className="prompt-preview-toggle"
                      onClick={() => setShowPromptPreview(v => !v)}
                    >
                      {showPromptPreview ? '▼' : '▶'} 预览 AI 系统提示词
                    </button>
                    {showPromptPreview && (
                      <pre className="prompt-preview-content">{getSystemPrompt()}</pre>
                    )}
                  </div>

                  <div className="divider" />

                  {/* 操作区 */}
                  <div className="character-actions">
                    {/* 保存为新人设 */}
                    {showNewCharacterInput ? (
                      <div className="new-character-input">
                        <input
                          type="text"
                          value={newCharacterName}
                          onChange={(e) => setNewCharacterName(e.target.value)}
                          placeholder="输入新人设名称"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveAsNew()}
                        />
                        <button className="action-btn primary" onClick={handleSaveAsNew}>保存</button>
                        <button className="action-btn" onClick={() => setShowNewCharacterInput(false)}>取消</button>
                      </div>
                    ) : (
                      <button className="action-btn" onClick={() => setShowNewCharacterInput(true)}>
                        ➕ 另存为新人设
                      </button>
                    )}

                    <button
                      className="action-btn"
                      onClick={() => handleExport(currentCharacterId)}
                      title="导出当前人设 JSON"
                    >
                      📤 导出
                    </button>

                    <button
                      className="action-btn"
                      onClick={() => setShowImportModal(true)}
                    >
                      📥 导入
                    </button>

                    <button
                      className="reset-btn"
                      onClick={() => {
                        if (confirm('恢复小暖的默认性格和说话风格？当前编辑内容将被覆盖。')) {
                          resetToDefault()
                        }
                      }}
                    >
                      恢复默认
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'model' && (
                <div className="ai-model-settings">
                  <h3>AI 对话模型</h3>
                  <p className="settings-desc">
                    基于 DeepSeek 大模型，默认使用内置配置无需任何设置。
                  </p>

                  {/* 内置配置开关 */}
                  <div className="builtin-toggle-card">
                    <label className="builtin-toggle-label">
                      <input
                        type="checkbox"
                        checked={useBuiltin}
                        onChange={(e) => handleToggleBuiltin(e.target.checked)}
                      />
                      <span className="builtin-toggle-text">
                        <strong>使用内置配置</strong>
                        <small>DeepSeek Chat · 内置 Key · 开箱即用</small>
                      </span>
                      {useBuiltin && <span className="builtin-badge">✅ 已启用</span>}
                    </label>
                  </div>

                  {/* 自定义区（取消内置才展开） */}
                  {!useBuiltin && (
                    <div className="custom-ai-section">
                      <div className="setting-group">
                        <label>API Key</label>
                        <div className="api-key-input-row">
                          <input
                            type="password"
                            value={aiConfig.apiKey || ''}
                            onChange={(e) => setAIConfig({ apiKey: e.target.value })}
                            placeholder="输入你的 DeepSeek API Key"
                            autoFocus
                          />
                          {aiConfig.apiKey && (
                            <button
                              className="icon-btn"
                              title="清除"
                              onClick={() => setAIConfig({ apiKey: '' })}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <small className="api-key-status">
                          {aiConfig.apiKey ? '🔑 使用自定义 Key' : '⚠️ 请输入 Key 或重新勾选内置配置'}
                        </small>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* 资源管理 */}
              {activeTab === 'assets' && (
                <div className="assets-settings">
                  <h3>资源管理</h3>
                  <p className="assets-desc">
                    使用浏览器 IndexedDB 存储场景图片和 VRM 模型，无需本地文件夹。
                  </p>

                  {/* 存储使用情况 */}
                  {storageInfo && (
                    <div className="storage-info">
                      <div className="storage-bar">
                        <div className="storage-label">已使用存储空间</div>
                        <div className="storage-value">{indexedDBService.formatSize(storageInfo.total)}</div>
                      </div>
                      <div className="storage-details">
                        <span>🖼️ 场景: {indexedDBService.formatSize(storageInfo.scenes)}</span>
                        <span>🎭 模型: {indexedDBService.formatSize(storageInfo.models)}</span>
                      </div>
                    </div>
                  )}

                  {/* 场景图片管理 */}
                  <div className="asset-section">
                    <div className="section-header">
                      <h4>🖼️ 场景背景图片</h4>
                      <button 
                        className="action-btn primary small"
                        onClick={() => sceneInputRef.current?.click()}
                        disabled={assetsLoading}
                      >
                        ➕ 上传图片
                      </button>
                      <input
                        ref={sceneInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleSceneUpload}
                      />
                    </div>

                    <div className="asset-grid">
                      {/* 内置默认场景（始终显示，不可删除） */}
                      <div
                        className={`asset-card ${!currentSceneId && currentPresetSceneId === 'counseling-room' ? 'active' : ''}`}
                        onClick={() => selectPresetScene('counseling-room')}
                      >
                        <img
                          src="/scenes/counseling-room.png"
                          alt="咨询室"
                          className="asset-thumbnail"
                        />
                        <div className="asset-info">
                          <span className="asset-name">咨询室（内置默认）</span>
                          <span className="asset-size">默认 · 内置</span>
                        </div>
                        {!currentSceneId && currentPresetSceneId === 'counseling-room' && (
                          <span className="asset-active-badge">使用中</span>
                        )}
                      </div>

                      {/* 用户上传的自定义场景 */}
                      {scenes.map(scene => (
                        <div 
                          key={scene.id}
                          className={`asset-card ${currentSceneId === scene.id ? 'active' : ''}`}
                          onClick={() => selectScene(currentSceneId === scene.id ? null : scene.id)}
                        >
                          {scene.thumbnail ? (
                            <img src={scene.thumbnail} alt={scene.name} className="asset-thumbnail" />
                          ) : (
                            <div className="asset-placeholder">🖼️</div>
                          )}
                          <div className="asset-info">
                            <span className="asset-name" title={scene.name}>{scene.name}</span>
                            <span className="asset-size">{indexedDBService.formatSize(scene.size)}</span>
                          </div>
                          <button
                            className="asset-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`删除场景 "${scene.name}"？`)) {
                                deleteScene(scene.id)
                              }
                            }}
                            title="删除"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* VRM 模型管理 */}
                  <div className="asset-section">
                    <div className="section-header">
                      <h4>🎭 VRM 模型</h4>
                      <button 
                        className="action-btn primary small"
                        onClick={() => modelInputRef.current?.click()}
                        disabled={assetsLoading}
                      >
                        ➕ 上传模型
                      </button>
                      <input
                        ref={modelInputRef}
                        type="file"
                        accept=".vrm"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleModelUpload}
                      />
                    </div>

                    <div className="asset-list">
                      {/* 内置默认模型（始终显示，不可删除） */}
                      <div
                        className={`asset-list-item ${!currentModelId ? 'active' : ''}`}
                        onClick={() => selectModel(null)}
                      >
                        <div className="asset-icon">🎭</div>
                        <div className="asset-info">
                          <span className="asset-name">小暖（内置默认）</span>
                          <span className="asset-size">默认 · 内置</span>
                        </div>
                        {!currentModelId && (
                          <span className="asset-active-badge">使用中</span>
                        )}
                      </div>

                      {/* 用户上传的自定义模型 */}
                      {models.map(model => (
                        <div 
                          key={model.id}
                          className={`asset-list-item ${currentModelId === model.id ? 'active' : ''}`}
                          onClick={() => selectModel(currentModelId === model.id ? null : model.id)}
                        >
                          <div className="asset-icon">🎭</div>
                          <div className="asset-info">
                            <span className="asset-name" title={model.name}>{model.name}</span>
                            <span className="asset-size">{indexedDBService.formatSize(model.size)}</span>
                          </div>
                          {currentModelId === model.id && (
                            <span className="asset-active-badge">使用中</span>
                          )}
                          <button
                            className="asset-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`删除模型 "${model.name}"？`)) {
                                deleteModel(model.id)
                              }
                            }}
                            title="删除"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 清空所有数据 */}
                  <div className="asset-actions">
                    <button 
                      className="reset-btn"
                      onClick={() => {
                        if (confirm('确定要清空所有资源吗？此操作不可恢复！')) {
                          clearAllAssets()
                        }
                      }}
                    >
                      🗑️ 清空所有资源
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'tts' && (
                <div className="tts-settings">
                  <h3>语音合成（MiniMax）</h3>

                  {/* 内置配置开关 */}
                  <div className="builtin-toggle-card">
                    <label className="builtin-toggle-label">
                      <input
                        type="checkbox"
                        checked={useBuiltinTTS}
                        onChange={(e) => handleToggleBuiltinTTS(e.target.checked)}
                      />
                      <span className="builtin-toggle-text">
                        <strong>使用内置配置</strong>
                        <small>MiniMax TTS · 内置 Key · 开箱即用</small>
                      </span>
                      {useBuiltinTTS && <span className="builtin-badge">✅ 已启用</span>}
                    </label>
                  </div>

                  {/* 自定义 API Key（取消内置才展开） */}
                  {!useBuiltinTTS && (
                    <div className="custom-ai-section">
                      <div className="setting-group">
                        <label>API Key</label>
                        <div className="api-key-input-row">
                          <input
                            type="password"
                            value={ttsConfig.apiKey || ''}
                            onChange={(e) => handleTTSChange('apiKey', e.target.value)}
                            placeholder="输入你的 MiniMax API Key"
                            autoFocus
                          />
                          {ttsConfig.apiKey && (
                            <button
                              className="icon-btn"
                              title="清除"
                              onClick={() => handleTTSChange('apiKey', '')}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <small className="api-key-status">
                          {ttsConfig.apiKey ? '🔑 使用自定义 Key' : '⚠️ 请输入 Key 或重新勾选内置配置'}
                        </small>
                      </div>
                    </div>
                  )}

                  {/* ── 音色 ── */}
                  <div className="tts-section-title">音色</div>

                  <div className="setting-group">
                    <label>选择音色</label>
                    <select
                      value={ttsConfig.voice}
                      onChange={(e) => handleTTSChange('voice', e.target.value)}
                    >
                      <optgroup label="女性音色">
                        {MINIMAX_TTS_VOICES.filter(v => v.gender === 'female').map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="男性音色">
                        {MINIMAX_TTS_VOICES.filter(v => v.gender === 'male').map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* ── 调音台 ── */}
                  <div className="tts-section-title">调音台</div>

                  <div className="setting-group">
                    <label>
                      语速
                      <span className="slider-value">{ttsConfig.speed.toFixed(1)}x</span>
                    </label>
                    <div className="slider-row">
                      <span className="slider-label-min">慢</span>
                      <input
                        type="range" min="0.5" max="2" step="0.1"
                        value={ttsConfig.speed}
                        onChange={(e) => handleTTSChange('speed', parseFloat(e.target.value))}
                      />
                      <span className="slider-label-max">快</span>
                    </div>
                  </div>

                  <div className="setting-group">
                    <label>
                      音调
                      <span className="slider-value">{ttsConfig.pitch > 0 ? `+${ttsConfig.pitch}` : ttsConfig.pitch} 半音</span>
                    </label>
                    <div className="slider-row">
                      <span className="slider-label-min">低</span>
                      <input
                        type="range" min="-12" max="12" step="1"
                        value={ttsConfig.pitch}
                        onChange={(e) => handleTTSChange('pitch', parseInt(e.target.value))}
                      />
                      <span className="slider-label-max">高</span>
                    </div>
                  </div>

                  <div className="setting-group">
                    <label>
                      音量
                      <span className="slider-value">{Math.round(ttsConfig.volume * 100)}%</span>
                    </label>
                    <div className="slider-row">
                      <span className="slider-label-min">静</span>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={ttsConfig.volume}
                        onChange={(e) => handleTTSChange('volume', parseFloat(e.target.value))}
                      />
                      <span className="slider-label-max">满</span>
                    </div>
                  </div>

                  {/* ── 说话节奏 ── */}
                  <div className="tts-section-title">说话节奏</div>

                  <div className="setting-group">
                    <label>
                      句间停顿
                      <span className="slider-value">{ttsConfig.sentencePause ?? 0} ms</span>
                    </label>
                    <div className="slider-row">
                      <span className="slider-label-min">紧凑</span>
                      <input
                        type="range" min="0" max="1000" step="50"
                        value={ttsConfig.sentencePause ?? 0}
                        onChange={(e) => handleTTSChange('sentencePause', parseInt(e.target.value))}
                      />
                      <span className="slider-label-max">舒缓</span>
                    </div>
                  </div>

                  {/* ── 情感表达 ── */}
                  <div className="tts-section-title">情感表达</div>

                  <div className="setting-group">
                    <label>
                      情绪灵敏度
                      <span className="slider-value">
                        {(ttsConfig.emotionSensitivity ?? 0.5) < 0.35
                          ? '低'
                          : (ttsConfig.emotionSensitivity ?? 0.5) > 0.65
                          ? '高'
                          : '中'}
                      </span>
                    </label>
                    <div className="slider-row">
                      <span className="slider-label-min">克制</span>
                      <input
                        type="range" min="0" max="1" step="0.1"
                        value={ttsConfig.emotionSensitivity ?? 0.5}
                        onChange={(e) => handleTTSChange('emotionSensitivity', parseFloat(e.target.value))}
                      />
                      <span className="slider-label-max">敏感</span>
                    </div>
                    <small>低：需多个情绪词才切换语气；高：一个词即触发</small>
                  </div>

                  {/* 情绪映射表（可展开） */}
                  <div className="emotion-map-section">
                    <button
                      className="prompt-preview-toggle"
                      onClick={() => setShowEmotionMap(v => !v)}
                    >
                      {showEmotionMap ? '▼' : '▶'} 自定义情绪 → 语气映射
                    </button>
                    {showEmotionMap && (
                      <div className="emotion-map-table">
                        <div className="emotion-map-header">
                          <span>AI 检测情绪</span>
                          <span>小暖 TTS 语气</span>
                        </div>
                        {(
                          [
                            { key: 'happy' as DetectedEmotion, label: '😊 开心' },
                            { key: 'neutral' as DetectedEmotion, label: '😐 平静' },
                            { key: 'thinking' as DetectedEmotion, label: '🤔 思考' },
                            { key: 'sad' as DetectedEmotion, label: '😢 悲伤' },
                            { key: 'angry' as DetectedEmotion, label: '😠 激动' },
                            { key: 'surprised' as DetectedEmotion, label: '😮 惊讶' },
                          ] as const
                        ).map(({ key, label }) => (
                          <div key={key} className="emotion-map-row">
                            <span>{label}</span>
                            <select
                              value={(ttsConfig.customEmotionMap ?? {})[key] ?? 'happy'}
                              onChange={(e) => updateEmotionMapEntry(key, e.target.value as TTSEmotion)}
                            >
                              <option value="happy">😊 温暖 (happy)</option>
                              <option value="neutral">😐 平稳 (neutral)</option>
                              <option value="sad">😢 低沉 (sad)</option>
                              <option value="angry">😠 激动 (angry)</option>
                              <option value="surprised">😮 惊喜 (surprised)</option>
                            </select>
                          </div>
                        ))}
                        <button className="action-btn" style={{ marginTop: 8 }} onClick={resetEmotionMap}>
                          恢复默认映射
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="tts-status">
                    <span className="status-badge minimax">☁️ MiniMax</span>
                    <span className="voice-name">
                      {MINIMAX_TTS_VOICES.find(v => v.id === ttsConfig.voice)?.name || ttsConfig.voice}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 导入模态框 */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>导入人设</h3>
            <p>粘贴人设 JSON 或选择文件</p>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{"version": "1.0", "type": "character", "data": {...}}'
              rows={10}
            />
            <div className="modal-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileImport}
              />
              <button className="action-btn" onClick={() => fileInputRef.current?.click()}>
                📁 选择文件
              </button>
              <button className="action-btn primary" onClick={handleImport}>
                导入
              </button>
              <button className="action-btn" onClick={() => setShowImportModal(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SettingsPanel
