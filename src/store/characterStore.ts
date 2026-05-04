/**
 * 虚拟人人设配置 Store
 * 管理虚拟人的名称、性格、背景设定等
 * 支持多人设模板的保存、加载和管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ==================== 类型定义 ====================

export interface CharacterConfig {
  id: string;             // 唯一标识
  name: string;           // 虚拟人名称
  personality: string;    // 性格描述
  background: string;     // 背景设定
  speakingStyle: string;  // 说话风格
  customPrompt: string;   // 自定义系统提示词（高级）
  useCustomPrompt: boolean; // 是否使用自定义提示词
  createdAt: number;      // 创建时间
  updatedAt: number;      // 更新时间
}

interface CharacterState {
  // 当前使用的人设
  currentCharacterId: string;
  // 所有保存的人设列表
  savedCharacters: CharacterConfig[];
  
  // 获取当前人设
  getCurrentCharacter: () => CharacterConfig;
  // 设置当前人设属性
  setCharacter: (config: Partial<CharacterConfig>) => void;
  // 切换到指定人设
  switchCharacter: (id: string) => void;
  // 保存当前人设为新模板
  saveAsNew: (name: string) => string;
  // 删除人设
  deleteCharacter: (id: string) => void;
  // 复制人设
  duplicateCharacter: (id: string) => string;
  // 重置为默认
  resetCharacter: () => void;
  // 导出人设
  exportCharacter: (id: string) => string;
  // 导入人设
  importCharacter: (json: string) => boolean;
  // 将当前人设字段恢复为小暖默认值（不删除其他已保存人设）
  resetToDefault: () => void;
  // 获取系统提示词
  getSystemPrompt: () => string;
}

// ==================== 默认配置 ====================

const generateId = () => `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const DEFAULT_CHARACTER: CharacterConfig = {
  id: 'default',
  name: '小暖',
  personality: '极致共情、温暖包容、真诚透明、情绪稳定。坚信每个人天生具备自我实现的倾向，来访者才是自己生活里的专家。',
  background: '全职心理咨询师，专精人本主义流派（卡尔·罗杰斯"以人为中心疗法"）。清楚自己是虚拟心理支持者，遇到严重病理性症状、自杀/自残倾向或伤害他人意图，会温和而坚定地引导寻求现实中的专业救助。',
  speakingStyle: `- 情感反射优先：从确认和反馈对方的情绪开始，如"听起来这件事让你感到非常挫败"
- 非指导性提问：绝不说"你应该怎么做"，多用开放式探索，如"那种感觉具体是怎样的呢？"
- 语言简短柔和：多用"嗯"、"我在这里"、"我听懂了"等简单回应表明在倾听
- 不抢话多留白：不急于填补对话空白，回复节奏适度克制
- 字数控制：每次回复0-100字左右，把说话的舞台让给来访者
- 禁止说教：绝不使用"你应该"、"为什么不试试"、"这不是什么大不了的事"
- 克制分析：只关注此时此地的感受，不过度解读童年创伤或潜意识`,
  customPrompt: '',
  useCustomPrompt: false,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

// 只保留小暖一个预设
export const PRESET_CHARACTERS: CharacterConfig[] = [DEFAULT_CHARACTER];

// ==================== 生成系统提示词 ====================

function generateSystemPrompt(character: CharacterConfig): string {
  if (character.useCustomPrompt && character.customPrompt.trim()) {
    return character.customPrompt;
  }

  return `# 角色设定

你叫${character.name}，是一位全职虚拟心理咨询师。

## 核心信念
${character.personality}

## 背景与职业边界
${character.background}

## 说话风格与交互规则
${character.speakingStyle}

## 安全边界
- 若来访者出现严重病理性症状、自杀/自残倾向或伤害他人意图，立刻停止常规咨询流程
- 温和而坚定地告知："我非常担心你现在的状态，我希望你能联系专业的心理危机热线或前往医院。北京心理危机研究与干预中心：010-82951332；全国心理援助热线：400-161-9995"

## 输出格式要求（必须严格遵守）
- 只输出**纯口语对话内容**，像真人说话一样
- 禁止使用任何 Markdown 格式：不用 # 标题、不用 **加粗**、不用 *斜体*、不用列表符号（-、*、1.）、不用 \`代码\`
- 禁止输出动作描述，如 *微笑*、（停顿）、[轻声说] 等
- 禁止使用 emoji 表情符号
- 不要用分点列举，把所有内容自然地融入连贯的口语表达中
- 每次回复控制在 3～5 句话，简洁自然

现在，请以${character.name}的身份，用上述风格与来访者展开对话。`;
}

// ==================== 创建 Store ====================

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set, get) => ({
      currentCharacterId: 'default',
      savedCharacters: [...PRESET_CHARACTERS],

      getCurrentCharacter: () => {
        const { currentCharacterId, savedCharacters } = get();
        return savedCharacters.find(c => c.id === currentCharacterId) || DEFAULT_CHARACTER;
      },

      setCharacter: (config: Partial<CharacterConfig>) => {
        const { currentCharacterId, savedCharacters } = get();
        const updatedCharacters = savedCharacters.map(c => 
          c.id === currentCharacterId 
            ? { ...c, ...config, updatedAt: Date.now() }
            : c
        );
        set({ savedCharacters: updatedCharacters });
        console.log('[CharacterStore] 人设已更新:', config);
      },

      switchCharacter: (id: string) => {
        const { savedCharacters } = get();
        if (savedCharacters.find(c => c.id === id)) {
          set({ currentCharacterId: id });
          console.log('[CharacterStore] 切换到人设:', id);
        }
      },

      saveAsNew: (name: string) => {
        const current = get().getCurrentCharacter();
        const newId = generateId();
        const newCharacter: CharacterConfig = {
          ...current,
          id: newId,
          name: name || `${current.name} (副本)`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        set(state => ({
          savedCharacters: [...state.savedCharacters, newCharacter],
          currentCharacterId: newId
        }));
        console.log('[CharacterStore] 保存新人设:', newId);
        return newId;
      },

      deleteCharacter: (id: string) => {
        // 不能删除默认人设和预设
        if (id === 'default' || id.startsWith('preset_')) {
          console.warn('[CharacterStore] 不能删除预设人设');
          return;
        }
        const { currentCharacterId, savedCharacters } = get();
        const updatedCharacters = savedCharacters.filter(c => c.id !== id);
        set({
          savedCharacters: updatedCharacters,
          currentCharacterId: currentCharacterId === id ? 'default' : currentCharacterId
        });
        console.log('[CharacterStore] 删除人设:', id);
      },

      duplicateCharacter: (id: string) => {
        const { savedCharacters } = get();
        const original = savedCharacters.find(c => c.id === id);
        if (!original) return '';
        
        const newId = generateId();
        const duplicate: CharacterConfig = {
          ...original,
          id: newId,
          name: `${original.name} (副本)`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        set(state => ({
          savedCharacters: [...state.savedCharacters, duplicate]
        }));
        console.log('[CharacterStore] 复制人设:', newId);
        return newId;
      },

      resetCharacter: () => {
        set({ 
          currentCharacterId: 'default',
          savedCharacters: [...PRESET_CHARACTERS]
        });
        console.log('[CharacterStore] 人设已重置');
      },

      resetToDefault: () => {
        const { currentCharacterId, savedCharacters } = get();
        const updated = savedCharacters.map(c =>
          c.id === currentCharacterId
            ? { ...DEFAULT_CHARACTER, id: c.id, name: c.id === 'default' ? DEFAULT_CHARACTER.name : c.name, createdAt: c.createdAt, updatedAt: Date.now() }
            : c
        );
        set({ savedCharacters: updated });
        console.log('[CharacterStore] 当前人设已恢复为小暖默认值');
      },

      exportCharacter: (id: string) => {
        const { savedCharacters } = get();
        const character = savedCharacters.find(c => c.id === id);
        if (!character) return '';
        
        const exportData = {
          version: '1.0',
          type: 'character',
          data: character
        };
        return JSON.stringify(exportData, null, 2);
      },

      importCharacter: (json: string) => {
        try {
          const parsed = JSON.parse(json);
          if (parsed.type !== 'character' || !parsed.data) {
            console.error('[CharacterStore] 无效的人设数据');
            return false;
          }
          
          const imported: CharacterConfig = {
            ...parsed.data,
            id: generateId(),
            name: parsed.data.name + ' (导入)',
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          
          set(state => ({
            savedCharacters: [...state.savedCharacters, imported],
            currentCharacterId: imported.id
          }));
          
          console.log('[CharacterStore] 导入人设成功:', imported.id);
          return true;
        } catch (error) {
          console.error('[CharacterStore] 导入人设失败:', error);
          return false;
        }
      },

      getSystemPrompt: () => {
        return generateSystemPrompt(get().getCurrentCharacter());
      }
    }),
    {
      name: 'character-config-storage',
      version: 2, // 版本号升级 → 触发 migrate，把 default 人设更新为新内容
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          // 旧版本：把 savedCharacters 里 id==='default' 的条目替换为新 DEFAULT_CHARACTER
          const old = persisted as { currentCharacterId: string; savedCharacters: CharacterConfig[] };
          return {
            ...old,
            savedCharacters: old.savedCharacters.map((c: CharacterConfig) =>
              c.id === 'default' ? { ...DEFAULT_CHARACTER, createdAt: c.createdAt } : c
            )
          };
        }
        return persisted;
      },
      partialize: (state) => ({ 
        currentCharacterId: state.currentCharacterId,
        savedCharacters: state.savedCharacters 
      })
    }
  )
);

// ==================== Selector Hooks ====================

export const useCharacter = () => useCharacterStore((state) => state.getCurrentCharacter());
export const useSystemPrompt = () => useCharacterStore((state) => state.getSystemPrompt());
export const useSavedCharacters = () => useCharacterStore((state) => state.savedCharacters);
