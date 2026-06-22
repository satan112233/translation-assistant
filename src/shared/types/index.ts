export type LanguageCode = 'zh' | 'en' | 'ja'

export interface TranslateParams {
  text: string
  sourceLang: 'auto' | LanguageCode
  targetLang: LanguageCode
}

export interface TranslationResult {
  translatedText: string
  pronunciation?: string
  alternatives?: string[]
  detectedSourceLang?: LanguageCode
}

export interface ProviderConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface ShortcutSettings {
  toggleWindow: string
  crossSelection: string
}

export interface AppSettings {
  defaultProvider: string
  providers: Record<string, ProviderConfig>
  windowBounds: { x?: number; y?: number; width: number; height: number }
  alwaysOnTop: boolean
  theme: 'light' | 'dark' | 'system'
  popupTargetLang: LanguageCode
  clipboardMonitor: boolean
  shortcuts: ShortcutSettings
}

export interface ReadTextFileResult {
  name: string
  content: string
}

export interface SaveTextFileRequest {
  fileName: string
  content: string
}

export interface SaveTextFileResult {
  canceled: boolean
  filePath?: string
}

export interface TranslationProvider {
  name: string
  translate(params: TranslateParams): Promise<TranslationResult>
}

export interface TranslateRequest {
  text: string
  sourceLang: 'auto' | LanguageCode
  targetLang: LanguageCode
  provider: string
  config: ProviderConfig
}

export interface HistoryRecord {
  id: string
  sourceText: string
  translatedText: string
  sourceLang: 'auto' | LanguageCode
  targetLang: LanguageCode
  detectedSourceLang?: LanguageCode
  provider: string
  timestamp: number
}

export interface FavoriteRecord {
  id: string
  sourceText: string
  translatedText: string
  sourceLang: 'auto' | LanguageCode
  targetLang: LanguageCode
  detectedSourceLang?: LanguageCode
  provider: string
  timestamp: number
  note?: string
}

export const MAX_HISTORY_COUNT = 20
