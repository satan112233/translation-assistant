import { OpenAICompatibleProvider } from './openaiCompatible'
import type { ProviderConfig, TranslationProvider } from '../../shared/types'

export const DEFAULT_PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  deepseek: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  openai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  gemini: {
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-1.5-flash',
  },
  zhipu: {
    apiKey: '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
  },
  iflytek: {
    apiKey: '',
    baseUrl: '',
    model: '',
    appId: '',
    apiSecret: '',
  },
}

export const PROVIDER_LABELS: Record<string, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  gemini: 'Gemini',
  zhipu: '智谱 AI',
  iflytek: '科大讯飞',
}

export function createProvider(name: string, config: ProviderConfig): TranslationProvider {
  return new OpenAICompatibleProvider(PROVIDER_LABELS[name] || name, config)
}
