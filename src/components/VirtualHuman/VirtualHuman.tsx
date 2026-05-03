import VRMModel from './VRMModel'
import { EmotionType } from './VRMModel'
import { LipSyncResult } from '../../utils/lipSyncAnalyzer'
import { useCurrentModel } from '../../store/assetStore'
import './VirtualHuman.css'

// 默认VRM模型路径
// 生产环境：从 jsDelivr CDN 加载（绕过 Cloudflare 25MB 单文件限制）
// model.vrm.bin = gzip 压缩的 VRM（19MB < 25MB 限制），.bin 扩展名避免 Cloudflare CDN 自动解压
// 开发环境使用本地原始 .vrm
const DEFAULT_MODEL_URL = import.meta.env.PROD ? '/model.vrm.bin' : '/model.vrm';

interface VirtualHumanProps {
  isSpeaking: boolean
  volume?: number // 音量 0-1，用于口型同步
  lipSyncData?: LipSyncResult | null // 精确口型数据
  emotion?: EmotionType // 当前情感
  textType?: 'question' | 'emphasis' | 'greeting' | 'agreement' | 'normal'
  modelUrl?: string // VRM模型路径
  transparent?: boolean // 是否使用透明背景（用于显示场景图片）
}

const VirtualHuman: React.FC<VirtualHumanProps> = ({ 
  isSpeaking, 
  volume = 0, 
  lipSyncData,
  emotion = 'neutral',
  textType = 'normal',
  modelUrl: propModelUrl,
  transparent = false
}) => {
  // 从 IndexedDB 获取自定义模型
  const { url: customModelUrl } = useCurrentModel();
  
  // 优先使用 props 传入的模型，其次是 IndexedDB 自定义模型，最后是默认模型
  const modelUrl = propModelUrl || customModelUrl || DEFAULT_MODEL_URL;
  return (
    <div className={`virtual-human-container ${transparent ? 'transparent' : ''}`}>
      <VRMModel 
        modelUrl={modelUrl}
        isSpeaking={isSpeaking} 
        volume={volume} 
        lipSyncData={lipSyncData}
        emotion={emotion}
        textType={textType}
        transparent={transparent}
        onLoad={() => console.log('[VirtualHuman] 模型加载完成')}
        onError={(error) => console.error('[VirtualHuman] 模型加载失败:', error)}
      />
    </div>
  )
}

export default VirtualHuman
