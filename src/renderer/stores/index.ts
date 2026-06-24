import { create } from 'zustand'
import type { AppSettings, FavoriteRecord, GlossaryEntry, HistoryRecord, LanguageCode, ProviderTranslationResult, SpeechOptimizationRecord, TranslationResult, VoiceDictionaryEntry } from '../../shared/types'
import { MAX_HISTORY_COUNT, MAX_SPEECH_OPTIMIZATION_COUNT } from '../../shared/types'
import { DEFAULT_PROVIDER_CONFIGS, PROVIDER_LABELS } from '../../main/providers'

interface TranslationState {
  inputText: string
  sourceLang: 'auto' | LanguageCode
  targetLang: LanguageCode
  result: TranslationResult | null
  results: ProviderTranslationResult[] | null
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

interface GlossaryState {
  glossary: GlossaryEntry[]
  isLoaded: boolean
  loadGlossary: () => Promise<void>
  saveGlossary: (glossary: GlossaryEntry[]) => Promise<void>
  addGlossaryEntry: (entry: GlossaryEntry) => Promise<void>
  deleteGlossaryEntry: (id: string) => Promise<void>
  updateGlossaryEntry: (id: string, entry: Partial<GlossaryEntry>) => Promise<void>
}

interface VoiceDictionaryState {
  voiceDictionary: VoiceDictionaryEntry[]
  isLoaded: boolean
  loadVoiceDictionary: () => Promise<void>
  saveVoiceDictionary: (voiceDictionary: VoiceDictionaryEntry[]) => Promise<void>
  addVoiceDictionaryEntry: (entry: VoiceDictionaryEntry) => Promise<void>
  deleteVoiceDictionaryEntry: (id: string) => Promise<void>
  updateVoiceDictionaryEntry: (id: string, entry: Partial<VoiceDictionaryEntry>) => Promise<void>
}

interface SpeechOptimizationState {
  records: SpeechOptimizationRecord[]
  isLoaded: boolean
  loadRecords: () => Promise<void>
  addRecord: (record: SpeechOptimizationRecord) => Promise<void>
  deleteRecord: (id: string) => Promise<void>
  clearRecords: () => Promise<void>
}

export type ActiveView = 'translate' | 'glossary' | 'voice-dictionary' | 'settings'

/** Records-style views surfaced from the title-bar toolbar in a slide-over drawer. */
export type DrawerView = 'history' | 'favorites' | 'speech-optimization'

interface UIState {
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
  sidebarCollapsed: boolean
  toggleSidebarCollapsed: () => void
  openDrawer: DrawerView | null
  setOpenDrawer: (drawer: DrawerView | null) => void
}

interface RecordingState {
  isRecording: boolean
  isTranscribing: boolean
  recordingDuration: number
  audioLevel: number
  transcribedText: string | null
  transcriptionError: string | null
  startRecording: (language: 'auto' | LanguageCode) => Promise<void>
  stopRecording: () => void
  cancelRecording: () => void
  toggleRecording: () => void
  setTranscribedText: (text: string | null) => void
  setTranscriptionError: (error: string | null) => void
  clearTranscriptionError: () => void
}

const DEFAULT_SHORTCUTS = {
  toggleWindow: 'CommandOrControl+Alt+T',
  crossSelection: 'CommandOrControl+Alt+C',
}

const defaultSettings: AppSettings = {
  defaultProvider: 'deepseek',
  providers: {
    ...DEFAULT_PROVIDER_CONFIGS,
    iflytek: {
      apiKey: '',
      baseUrl: '',
      model: '',
      appId: '',
      apiSecret: '',
    },
  },
  windowBounds: { width: 900, height: 640 },
  alwaysOnTop: false,
  theme: 'light',
  popupTargetLang: 'zh',
  shortcuts: { ...DEFAULT_SHORTCUTS },
  comparisonMode: false,
  glossary: [],
  voiceDictionary: [],
  popupPinned: false,
  voiceInputEnabled: true,
  voiceInputProvider: 'local',
  voiceInputOptimize: true,
  voiceInputLanguage: 'auto',
  voiceInputShortcut: 'Ctrl+Alt+V',
}

function getConfiguredProviders(settings: AppSettings): string[] {
  return Object.entries(settings.providers)
    .filter(([, config]) => config.apiKey.trim().length > 0)
    .map(([key]) => key)
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
    comparisonMode: settings.comparisonMode ?? defaultSettings.comparisonMode,
    glossary: settings.glossary ?? defaultSettings.glossary,
    voiceDictionary: settings.voiceDictionary ?? defaultSettings.voiceDictionary,
    popupPinned: settings.popupPinned ?? defaultSettings.popupPinned,
    voiceInputEnabled: settings.voiceInputEnabled ?? defaultSettings.voiceInputEnabled,
    voiceInputProvider:
      settings.voiceInputProvider ??
      (mergedProviders.zhipu?.apiKey
        ? 'zhipu'
        : mergedProviders.iflytek?.apiKey && mergedProviders.iflytek?.appId && mergedProviders.iflytek?.apiSecret
          ? 'iflytek'
          : defaultSettings.voiceInputProvider),
    voiceInputOptimize: settings.voiceInputOptimize ?? defaultSettings.voiceInputOptimize,
    voiceInputLanguage: settings.voiceInputLanguage ?? defaultSettings.voiceInputLanguage,
    voiceInputShortcut: settings.voiceInputShortcut ?? defaultSettings.voiceInputShortcut,
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

export const useGlossaryStore = create<GlossaryState>((set) => ({
  glossary: [],
  isLoaded: false,
  loadGlossary: async () => {
    try {
      const raw = await window.electronAPI.getGlossary()
      set({ glossary: raw as GlossaryEntry[], isLoaded: true })
    } catch (error) {
      console.error('Failed to load glossary:', error)
      set({ glossary: [], isLoaded: true })
    }
  },
  saveGlossary: async (glossary) => {
    try {
      await window.electronAPI.setGlossary(glossary)
      set({ glossary })
    } catch (error) {
      console.error('Failed to save glossary:', error)
    }
  },
  addGlossaryEntry: async (entry) => {
    try {
      const { glossary, saveGlossary } = useGlossaryStore.getState()
      const newGlossary = [entry, ...glossary.filter((item) => item.id !== entry.id)]
      await saveGlossary(newGlossary)
    } catch (error) {
      console.error('Failed to add glossary entry:', error)
    }
  },
  deleteGlossaryEntry: async (id) => {
    try {
      const { glossary, saveGlossary } = useGlossaryStore.getState()
      const newGlossary = glossary.filter((item) => item.id !== id)
      await saveGlossary(newGlossary)
    } catch (error) {
      console.error('Failed to delete glossary entry:', error)
    }
  },
  updateGlossaryEntry: async (id, entry) => {
    try {
      const { glossary, saveGlossary } = useGlossaryStore.getState()
      const newGlossary = glossary.map((item) =>
        item.id === id ? { ...item, ...entry } : item
      )
      await saveGlossary(newGlossary)
    } catch (error) {
      console.error('Failed to update glossary entry:', error)
    }
  },
}))

export const useVoiceDictionaryStore = create<VoiceDictionaryState>((set) => ({
  voiceDictionary: [],
  isLoaded: false,
  loadVoiceDictionary: async () => {
    try {
      const raw = await window.electronAPI.getVoiceDictionary()
      set({ voiceDictionary: raw as VoiceDictionaryEntry[], isLoaded: true })
    } catch (error) {
      console.error('Failed to load voice dictionary:', error)
      set({ voiceDictionary: [], isLoaded: true })
    }
  },
  saveVoiceDictionary: async (voiceDictionary) => {
    try {
      await window.electronAPI.setVoiceDictionary(voiceDictionary)
      set({ voiceDictionary })
    } catch (error) {
      console.error('Failed to save voice dictionary:', error)
    }
  },
  addVoiceDictionaryEntry: async (entry) => {
    try {
      const { voiceDictionary, saveVoiceDictionary } = useVoiceDictionaryStore.getState()
      const newDictionary = [entry, ...voiceDictionary.filter((item) => item.id !== entry.id)]
      await saveVoiceDictionary(newDictionary)
    } catch (error) {
      console.error('Failed to add voice dictionary entry:', error)
    }
  },
  deleteVoiceDictionaryEntry: async (id) => {
    try {
      const { voiceDictionary, saveVoiceDictionary } = useVoiceDictionaryStore.getState()
      const newDictionary = voiceDictionary.filter((item) => item.id !== id)
      await saveVoiceDictionary(newDictionary)
    } catch (error) {
      console.error('Failed to delete voice dictionary entry:', error)
    }
  },
  updateVoiceDictionaryEntry: async (id, entry) => {
    try {
      const { voiceDictionary, saveVoiceDictionary } = useVoiceDictionaryStore.getState()
      const newDictionary = voiceDictionary.map((item) =>
        item.id === id ? { ...item, ...entry } : item
      )
      await saveVoiceDictionary(newDictionary)
    } catch (error) {
      console.error('Failed to update voice dictionary entry:', error)
    }
  },
}))

export const useSpeechOptimizationStore = create<SpeechOptimizationState>((set) => ({
  records: [],
  isLoaded: false,
  loadRecords: async () => {
    try {
      const raw = await window.electronAPI.getSpeechOptimizations()
      set({ records: raw as SpeechOptimizationRecord[], isLoaded: true })
    } catch (error) {
      console.error('Failed to load speech optimization records:', error)
      set({ records: [], isLoaded: true })
    }
  },
  addRecord: async (record) => {
    try {
      await window.electronAPI.addSpeechOptimization(record)
      set((state) => ({
        records: [record, ...state.records.filter((item) => item.id !== record.id)].slice(
          0,
          MAX_SPEECH_OPTIMIZATION_COUNT
        ),
      }))
    } catch (error) {
      console.error('Failed to add speech optimization record:', error)
    }
  },
  deleteRecord: async (id) => {
    try {
      await window.electronAPI.deleteSpeechOptimizationItem(id)
      set((state) => ({
        records: state.records.filter((item) => item.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete speech optimization record:', error)
    }
  },
  clearRecords: async () => {
    try {
      await window.electronAPI.clearSpeechOptimizations()
      set({ records: [] })
    } catch (error) {
      console.error('Failed to clear speech optimization records:', error)
    }
  },
}))

// Audio helpers for voice recording
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2
  const blockAlign = 1 * bytesPerSample
  const dataSize = samples.length * bytesPerSample

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // 16-bit
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const pcm = new Int16Array(buffer, 44, samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  return buffer
}

async function convertBlobToWavBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext()
  const decoded = await audioContext.decodeAudioData(arrayBuffer)
  await audioContext.close()

  const targetSampleRate = 16000
  const offlineContext = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetSampleRate), targetSampleRate)
  const source = offlineContext.createBufferSource()
  source.buffer = decoded
  source.connect(offlineContext.destination)
  source.start()

  const rendered = await offlineContext.startRendering()
  const monoSamples = rendered.getChannelData(0)
  const wavBuffer = encodeWav(monoSamples, targetSampleRate)
  return arrayBufferToBase64(wavBuffer)
}

const MAX_RECORDING_SECONDS = 60

let mediaRecorderRef: MediaRecorder | null = null
let audioChunksRef: Blob[] = []
let streamRef: MediaStream | null = null
let timerRef: ReturnType<typeof setInterval> | null = null
let maxDurationTimerRef: ReturnType<typeof setTimeout> | null = null
let cancelPendingRef = false
let audioContextRef: AudioContext | null = null
let analyserRef: AnalyserNode | null = null
let levelRafRef: number | null = null

function stopAudioLevelMeter(): void {
  if (levelRafRef !== null) {
    cancelAnimationFrame(levelRafRef)
    levelRafRef = null
  }
  if (audioContextRef) {
    void audioContextRef.close()
    audioContextRef = null
  }
  analyserRef = null
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  isTranscribing: false,
  recordingDuration: 0,
  audioLevel: 0,
  transcribedText: null,
  transcriptionError: null,

  setTranscribedText: (text) => set({ transcribedText: text }),
  setTranscriptionError: (error) => set({ transcriptionError: error }),
  clearTranscriptionError: () => set({ transcriptionError: null }),

  stopRecording: () => {
    if (mediaRecorderRef?.state === 'recording') {
      mediaRecorderRef.stop()
    }
    if (streamRef) {
      streamRef.getTracks().forEach((track) => track.stop())
      streamRef = null
    }
    if (timerRef) {
      clearInterval(timerRef)
      timerRef = null
    }
    if (maxDurationTimerRef) {
      clearTimeout(maxDurationTimerRef)
      maxDurationTimerRef = null
    }
    stopAudioLevelMeter()
    set({ isRecording: false, recordingDuration: 0, audioLevel: 0 })
  },

  cancelRecording: () => {
    if (mediaRecorderRef?.state === 'recording') {
      cancelPendingRef = true
      mediaRecorderRef.stop()
    }
    if (streamRef) {
      streamRef.getTracks().forEach((track) => track.stop())
      streamRef = null
    }
    if (timerRef) {
      clearInterval(timerRef)
      timerRef = null
    }
    if (maxDurationTimerRef) {
      clearTimeout(maxDurationTimerRef)
      maxDurationTimerRef = null
    }
    stopAudioLevelMeter()
    set({ isRecording: false, recordingDuration: 0, audioLevel: 0 })
  },

  startRecording: async (language) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef = stream

      // Real-time microphone level meter so the waveform only moves when the
      // user actually speaks (flat line on silence).
      try {
        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        audioContext.createMediaStreamSource(stream).connect(analyser)
        audioContextRef = audioContext
        analyserRef = analyser

        const buffer = new Uint8Array(analyser.fftSize)
        let smoothed = 0
        const tick = () => {
          if (!analyserRef) return
          analyserRef.getByteTimeDomainData(buffer)
          let sumSquares = 0
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128
            sumSquares += v * v
          }
          const rms = Math.sqrt(sumSquares / buffer.length)
          // Noise floor + gain, then a perceptual curve (pow < 1) so normal
          // speech reads as a full waveform instead of a few short bars.
          const raw = rms < 0.015 ? 0 : Math.min(1, (rms - 0.015) * 6)
          const level = Math.pow(raw, 0.6)
          // Fast-ish attack, slow release: bars rise to speech but fade down
          // gently instead of snapping back to flat on silence.
          const coeff = level > smoothed ? 0.18 : 0.03
          smoothed = smoothed * (1 - coeff) + level * coeff
          if (smoothed < 0.001) smoothed = 0
          set({ audioLevel: smoothed })
          levelRafRef = requestAnimationFrame(tick)
        }
        levelRafRef = requestAnimationFrame(tick)
      } catch (meterErr) {
        console.warn('[recording] audio level meter unavailable:', meterErr)
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef = mediaRecorder
      audioChunksRef = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        useRecordingStore.getState().stopRecording()
        if (cancelPendingRef) {
          cancelPendingRef = false
          audioChunksRef = []
          return
        }
        if (audioChunksRef.length === 0) {
          useRecordingStore.getState().setTranscriptionError('未录制到音频')
          return
        }

        const audioBlob = new Blob(audioChunksRef, { type: mediaRecorder.mimeType || 'audio/webm' })
        set({ isTranscribing: true })
        try {
          const audioBase64 = await convertBlobToWavBase64(audioBlob)
          const result = await window.electronAPI.transcribeAudio({ audioBase64, language })
          const text = result.text?.trim()
          if (!text) {
            // No meaningful speech detected; silently ignore so we don't disturb the user
            return
          }
          useRecordingStore.getState().setTranscribedText(text)
        } catch (err) {
          console.error('语音转文字失败:', err)
          useRecordingStore.getState().setTranscriptionError(err instanceof Error ? err.message : '语音转文字失败')
        } finally {
          set({ isTranscribing: false })
        }
      }

      mediaRecorder.start()
      set({ isRecording: true, recordingDuration: 0 })

      timerRef = setInterval(() => {
        set((state) => ({ recordingDuration: state.recordingDuration + 1 }))
      }, 1000)

      maxDurationTimerRef = setTimeout(() => {
        if (mediaRecorderRef?.state === 'recording') {
          mediaRecorderRef.stop()
        }
      }, MAX_RECORDING_SECONDS * 1000)
    } catch (err) {
      console.error('无法访问麦克风:', err)
      useRecordingStore.getState().setTranscriptionError('无法访问麦克风，请检查权限设置')
    }
  },

  toggleRecording: () => {
    const { isRecording, isTranscribing, startRecording } = useRecordingStore.getState()
    if (isTranscribing) return
    if (isRecording) {
      useRecordingStore.getState().stopRecording()
    } else {
      const settings = useSettingsStore.getState().settings
      void startRecording(settings.voiceInputLanguage)
    }
  },
}))

export const useTranslationStore = create<TranslationState>((set, get) => ({
  inputText: '',
  sourceLang: 'auto',
  targetLang: 'en',
  result: null,
  results: null,
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
      set({ result: null, results: null, error: null })
      return
    }

    const trimmedText = inputText.trim()
    const configuredProviders = getConfiguredProviders(settings)
    const useComparisonMode = settings.comparisonMode && configuredProviders.length >= 2

    set({ isLoading: true, error: null, result: null, results: null })

    try {
      if (useComparisonMode) {
        // Initialize results with loading state for each provider
        set({
          results: configuredProviders.map((provider) => ({
            provider,
            result: null,
            error: null,
            isLoading: true,
          })),
        })

        const multiResult = await window.electronAPI.translateMulti({
          text: trimmedText,
          sourceLang,
          targetLang,
          providers: configuredProviders.map((provider) => ({
            provider,
            config: settings.providers[provider],
          })),
        })

        const results = multiResult.results
        const successCount = results.filter((r) => r.result && !r.error).length

        // Add history using default provider result if available, otherwise first success
        const primaryResult =
          results.find((r) => r.provider === settings.defaultProvider && r.result)?.result ??
          results.find((r) => r.result)?.result

        if (primaryResult) {
          const historyRecord: HistoryRecord = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            sourceText: trimmedText,
            translatedText: primaryResult.translatedText,
            sourceLang,
            targetLang,
            detectedSourceLang: primaryResult.detectedSourceLang,
            provider: settings.defaultProvider,
            timestamp: Date.now(),
          }
          void useHistoryStore.getState().addHistory(historyRecord)
        }

        set({
          results,
          isLoading: false,
          error: successCount === 0 ? '所有模型翻译均失败，请检查 API Key 和网络' : null,
        })
      } else {
        const providerConfig = settings.providers[settings.defaultProvider]
        if (!providerConfig) {
          throw new Error(`未找到 Provider: ${PROVIDER_LABELS[settings.defaultProvider] || settings.defaultProvider}`)
        }

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
      }
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
      results: null,
      error: null,
      isLoading: false,
      shouldSkipNextAutoTranslate: true,
    })
  },
  resetSkipFlag: () => set({ shouldSkipNextAutoTranslate: false }),
}))

export const useUIStore = create<UIState>((set) => ({
  activeView: 'translate',
  setActiveView: (view) => set({ activeView: view }),
  sidebarCollapsed: false,
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  openDrawer: null,
  setOpenDrawer: (drawer) => set({ openDrawer: drawer }),
}))
