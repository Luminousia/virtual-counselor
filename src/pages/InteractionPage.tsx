import ChatWindow from '../components/Chat/ChatWindow'
import SettingsPanel from '../components/Settings/SettingsPanel'
import './InteractionPage.css'

const InteractionPage = () => {
  return (
    <div className="interaction-page">
      <header className="interaction-header">
        <div className="header-content">
          <h1>与心理咨询师小暖对话</h1>
          <p className="header-subtitle">温和 · 耐心 · 热情</p>
        </div>
      </header>
      <ChatWindow />
      <SettingsPanel />
    </div>
  )
}

export default InteractionPage
