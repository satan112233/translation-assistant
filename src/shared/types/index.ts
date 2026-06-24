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
  appId?: string
  apiSecret?: string
}

export interface ShortcutSettings {
  toggleWindow: string
  crossSelection: string
}

export interface GlossaryEntry {
  id: string
  term: string
  translation: string
  note?: string
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
  comparisonMode: boolean
  glossary: GlossaryEntry[]
  popupPinned: boolean
  autoCopyResult: boolean
  voiceInputEnabled: boolean
  voiceInputProvider: 'local' | 'zhipu' | 'iflytek'
  voiceInputOptimize: boolean
  voiceInputLanguage: 'auto' | LanguageCode
  voiceInputShortcut: string
}

export interface TranscribeAudioRequest {
  audioBase64: string
  language?: 'auto' | LanguageCode
}

export interface TranscribeAudioResult {
  text: string
  language?: string
}

export interface MultiTranslateRequest {
  text: string
  sourceLang: 'auto' | LanguageCode
  targetLang: LanguageCode
  providers: { provider: string; config: ProviderConfig }[]
}

export interface ProviderTranslationResult {
  provider: string
  result: TranslationResult | null
  error: string | null
  isLoading: boolean
}

export interface MultiTranslateResult {
  results: ProviderTranslationResult[]
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

export interface SpeechOptimizationRecord {
  id: string
  rawText: string
  optimizedText: string
  timestamp: number
}

export interface RecordingPopupState {
  isRecording: boolean
  isTranscribing: boolean
  recordingDuration: number
}

export const MAX_SPEECH_OPTIMIZATION_COUNT = 20

export interface TranslationProvider {
  name: string
  translate(params: TranslateParams, glossary?: GlossaryEntry[]): Promise<TranslationResult>
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
