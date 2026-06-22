import { create } from 'zustand'
import type { AppSettings, FavoriteRecord, HistoryRecord, LanguageCode, TranslationResult } from '../../shared/types'
import { MAX_HISTORY_COUNT } from '../../shared/types'
import { DEFAULT_PROVIDER_CONFIGS, PROVIDER_LABELS } from '../../main/providers'

interface TranslationState {
  inputText: string
  sourceLang: 'auto' | LanguageCode
  targetLang: LanguageCode
  result: TranslationResult | null
  isLoading: boolean
  error: string | null
  shouldSkipNextAutoTranslate: boolean
  setInputText: (text: string) => void
  setSourceLang: (lang: 'auto' | LanguageCode) => void
  setTargetLang: (lang: LanguageCode) => void
  swapLanguages: () => void
  translate: () => Promise<void>
  loadFromHistory: (record: HistoryRecord) => void
  resetSkipFlag: () => void
}

interface SettingsState {
  settings: AppSettings
  isLoaded: boolean
  loadSettings: () => Promise<void>
  saveSettings: (settings: AppSettings) => Promise<void>
  updateProviderConfig: (provider: string, config: Partial<AppSettings['providers'][string]>) => Promise<void>
}

interface HistoryState {
  history: HistoryRecord[]
  isLoaded: boolean
  loadHistory: () => Promise<void>
  addHistory: (record: HistoryRecord) => Promise<void>
  deleteHistoryItem: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
}

interface FavoritesState {
  favorites: FavoriteRecord[]
  isLoaded: boolean
  loadFavorites: () => Promise<void>
  addFavorite: (record: FavoriteRecord) => Promise<void>
  deleteFavorite: (id: string) => Promise<void>
  updateFavoriteNote: (id: string, note: string) => Promise<void>
}

const DEFAULT_SHORTCUTS = {
  toggleWindow: 'CommandOrControl+Shift+T',
  crossSelection: 'CommandOrControl+Alt+X',
}

const defaultSettings: AppSettings = {
  defaultProvider: 'deepseek',
  providers: { ...DEFAULT_PROVIDER_CONFIGS },
  windowBounds: { width: 900, height: 640 },
  alwaysOnTop: false,
  theme: 'light',
  popupTargetLang: 'zh',
  clipboardMonitor: false,
  shortcuts: { ...DEFAULT_SHORTCUTS },
}

function mergeWithDefaults(settings: Partial<AppSettings>): AppSettings {
  const storedProviders = settings.providers || {}

  // Merge providers: stored configs take priority, but new default providers are added
  const mergedProviders: AppSettings['providers'] = {}
  for (const key of Object.keys(defaultSettings.providers)) {
    mergedProviders[key] = {
      ...defaultSettings.providers[key],
      ...(storedProviders[key] || {}),
    }
  }

  return {
    ...defaultSettings,
    ...settings,
    providers: mergedProviders,
    shortcuts: {
      ...defaultSettings.shortcuts,
      ...(settings.shortcuts || {}),
    },
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,
  isLoaded: false,
  loadSettings: async () => {
    try {
      const raw = await window.electronAPI.getSettings()
      const settings = mergeWithDefaults(raw as Partial<AppSettings>)
      set({ settings, isLoaded: true })
    } catch (error) {
      console.error('Failed to load settings:', error)
      set({ settings: defaultSettings, isLoaded: true })
    }
  },
  saveSettings: async (settings) => {
    await window.electronAPI.setSettings(settings)
    set({ settings })
  },
  updateProviderConfig: async (provider, config) => {
    const { settings, saveSettings } = useSettingsStore.getState()
    const newSettings: AppSettings = {
      ...settings,
      providers: {
        ...settings.providers,
        [provider]: {
          ...settings.providers[provider],
          ...config,
        },
      },
    }
    await saveSettings(newSettings)
  },
}))

export const useHistoryStore = create<HistoryState>((set) => ({
  history: [],
  isLoaded: false,
  loadHistory: async () => {
    try {
      const raw = await window.electronAPI.getHistory()
      set({ history: raw as HistoryRecord[], isLoaded: true })
    } catch (error) {
      console.error('Failed to load history:', error)
      set({ history: [], isLoaded: true })
    }
  },
  addHistory: async (record) => {
    try {
      await window.electronAPI.addHistory(record)
      set((state) => ({
        history: [record, ...state.history.filter((item) => item.id !== record.id)].slice(0, MAX_HISTORY_COUNT),
      }))
    } catch (error) {
      console.error('Failed to add history:', error)
    }
  },
  deleteHistoryItem: async (id) => {
    try {
      await window.electronAPI.deleteHistoryItem(id)
      set((state) => ({
        history: state.history.filter((item) => item.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete history item:', error)
    }
  },
  clearHistory: async () => {
    try {
      await window.electronAPI.clearHistory()
      set({ history: [] })
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  },
}))

export const useFavoritesStore = create<FavoritesState>((set) => ({
  favorites: [],
  isLoaded: false,
  loadFavorites: async () => {
    try {
      const raw = await window.electronAPI.getFavorites()
      set({ favorites: raw as FavoriteRecord[], isLoaded: true })
    } catch (error) {
      console.error('Failed to load favorites:', error)
      set({ favorites: [], isLoaded: true })
    }
  },
  addFavorite: async (record) => {
    try {
      await window.electronAPI.addFavorite(record)
      set((state) => ({
        favorites: [record, ...state.favorites.filter((item) => item.id !== record.id)],
      }))
    } catch (error) {
      console.error('Failed to add favorite:', error)
    }
  },
  deleteFavorite: async (id) => {
    try {
      await window.electronAPI.deleteFavorite(id)
      set((state) => ({
        favorites: state.favorites.filter((item) => item.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete favorite:', error)
    }
  },
  updateFavoriteNote: async (id, note) => {
    try {
      await window.electronAPI.updateFavoriteNote(id, note)
      set((state) => ({
        favorites: state.favorites.map((item) =>
          item.id === id ? { ...item, note } : item
        ),
      }))
    } catch (error) {
      console.error('Failed to update favorite note:', error)
    }
  },
}))

export const useTranslationStore = create<TranslationState>((set, get) => ({
  inputText: '',
  sourceLang: 'auto',
  targetLang: 'en',
  result: null,
  isLoading: false,
  error: null,
  shouldSkipNextAutoTranslate: false,
  setInputText: (text) => set({ inputText: text }),
  setSourceLang: (lang) => set({ sourceLang: lang }),
  setTargetLang: (lang) => set({ targetLang: lang }),
  swapLanguages: () => {
    const { sourceLang, targetLang, result } = get()
    if (sourceLang === 'auto') {
      // If source was auto, use detected source as new target, and old target as new source
      const detected = result?.detectedSourceLang
      if (detected) {
        set({ sourceLang: targetLang, targetLang: detected })
      }
    } else {
      set({ sourceLang: targetLang, targetLang: sourceLang })
    }
  },
  translate: async () => {
    const { inputText, sourceLang, targetLang } = get()
    const settings = useSettingsStore.getState().settings

    if (!inputText.trim()) {
      set({ result: null, error: null })
      return
    }

    set({ isLoading: true, error: null, result: null })

    try {
      const providerConfig = settings.providers[settings.defaultProvider]
      if (!providerConfig) {
        throw new Error(`未找到 Provider: ${PROVIDER_LABELS[settings.defaultProvider] || settings.defaultProvider}`)
      }

      const trimmedText = inputText.trim()
      const result = await window.electronAPI.translate({
        text: trimmedText,
        sourceLang,
        targetLang,
        provider: settings.defaultProvider,
        config: providerConfig,
      })

      const historyRecord: HistoryRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sourceText: trimmedText,
        translatedText: result.translatedText,
        sourceLang,
        targetLang,
        detectedSourceLang: result.detectedSourceLang,
        provider: settings.defaultProvider,
        timestamp: Date.now(),
      }
      void useHistoryStore.getState().addHistory(historyRecord)

      set({ result, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '翻译失败', isLoading: false })
    }
  },
  loadFromHistory: (record) => {
    set({
      inputText: record.sourceText,
      sourceLang: record.sourceLang,
      targetLang: record.targetLang,
      result: {
        translatedText: record.translatedText,
        detectedSourceLang: record.detectedSourceLang,
      },
      error: null,
      isLoading: false,
      shouldSkipNextAutoTranslate: true,
    })
  },
  resetSkipFlag: () => set({ shouldSkipNextAutoTranslate: false }),
}))
