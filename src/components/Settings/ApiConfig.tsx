import { useState } from 'react'
import { useAIConfigStore } from '../../store/aiConfigStore'
import './ApiConfig.css'

const ApiConfig: React.FC = () => {
  const { aiConfig, setAIConfig } = useAIConfigStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [formData, setFormData] = useState({
    provider: 'deepseek',
    apiKey: aiConfig.apiKey || '',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: aiConfig.model || 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 2000,
  })

  const handleSave = () => {
    setAIConfig({ apiKey: formData.apiKey, model: formData.model })
    setIsExpanded(false)
    alert('API配置已保存！')
  }

  const handleReset = () => {
    setFormData({
      provider: 'deepseek',
      apiKey: '',
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 2000,
    })
  }

  const presetConfigs = {
    deepseek: {
      provider: 'deepseek',
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
    },
    openai: {
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo',
    },
    custom: {
      provider: 'custom',
      apiUrl: '',
      model: '',
    },
  }

  const handlePresetSelect = (preset: keyof typeof presetConfigs) => {
    setFormData({
      ...formData,
      ...presetConfigs[preset],
    })
  }

  return (
    <div className="api-config">
      <div 
        className="api-config-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="config-title">AI API 配置</span>
        <span className="config-toggle">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="api-config-content">
          <div className="preset-buttons">
            <button
              className="preset-btn"
              onClick={() => handlePresetSelect('deepseek')}
            >
              DeepSeek
            </button>
            <button
              className="preset-btn"
              onClick={() => handlePresetSelect('openai')}
            >
              OpenAI
            </button>
            <button
              className="preset-btn"
              onClick={() => handlePresetSelect('custom')}
            >
              自定义
            </button>
          </div>

          <div className="config-form">
            <div className="form-group">
              <label>API 提供商</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              >
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="custom">自定义</option>
              </select>
            </div>

            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="输入你的API密钥"
              />
            </div>

            <div className="form-group">
              <label>API URL</label>
              <input
                type="text"
                value={formData.apiUrl}
                onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                placeholder="API端点URL"
              />
            </div>

            <div className="form-group">
              <label>模型名称</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="模型名称"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>温度 (Temperature)</label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>最大Token数</label>
                <input
                  type="number"
                  min="100"
                  max="4000"
                  step="100"
                  value={formData.maxTokens}
                  onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="save-btn" onClick={handleSave}>
                保存配置
              </button>
              <button className="reset-btn" onClick={handleReset}>
                重置
              </button>
            </div>

            <div className="config-info">
              <small>当前使用: deepseek - {aiConfig.model || '未配置'}</small>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ApiConfig
