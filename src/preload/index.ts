import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { FavoriteRecord, GlossaryEntry, HistoryRecord, MultiTranslateRequest, MultiTranslateResult, ReadTextFileResult, SaveTextFileRequest, SaveTextFileResult, SpeechOptimizationRecord, TranscribeAudioRequest, TranscribeAudioResult, TranslateRequest, TranslationResult } from '../shared/types'

export interface ElectronAPI {
  getSettings: () => Promise<unknown>
  setSettings: (settings: unknown) => Promise<boolean>
  translate: (request: TranslateRequest) => Promise<TranslationResult>
  translateMulti: (request: MultiTranslateRequest) => Promise<MultiTranslateResult>
  ocrImage: (imageBase64: string) => Promise<string>
  transcribeAudio: (request: TranscribeAudioRequest) => Promise<TranscribeAudioResult>
  getFilePath: (file: File) => string
  readTextFile: (filePath: string) => Promise<ReadTextFileResult>
  saveTextFile: (request: SaveTextFileRequest) => Promise<SaveTextFileResult>
  getGlossary: () => Promise<GlossaryEntry[]>
  setGlossary: (glossary: GlossaryEntry[]) => Promise<boolean>
  getHistory: () => Promise<HistoryRecord[]>
  addHistory: (record: HistoryRecord) => Promise<boolean>
  deleteHistoryItem: (id: string) => Promise<boolean>
  clearHistory: () => Promise<boolean>
  getSpeechOptimizations: () => Promise<SpeechOptimizationRecord[]>
  addSpeechOptimization: (record: SpeechOptimizationRecord) => Promise<boolean>
  deleteSpeechOptimizationItem: (id: string) => Promise<boolean>
  clearSpeechOptimizations: () => Promise<boolean>
  getFavorites: () => Promise<FavoriteRecord[]>
  addFavorite: (record: FavoriteRecord) => Promise<boolean>
  deleteFavorite: (id: string) => Promise<boolean>
  updateFavoriteNote: (id: string, note: string) => Promise<boolean>
  windowMinimize: () => Promise<void>
  windowClose: () => Promise<void>
  windowSetAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>
  closePopup: () => Promise<void>
  onStartGlobalRecording: (callback: () => void) => () => void
  onStopGlobalRecording: (callback: () => void) => () => void
  sendGlobalVoiceResult: (text: string) => void
  stopGlobalRecording: () => void
  onToggleVoiceRecording: (callback: () => void) => () => void
}

const api: ElectronAPI = {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  translate: (request) => ipcRenderer.invoke('translate', request),
  translateMulti: (request) => ipcRenderer.invoke('translate-multi', request),
  ocrImage: (imageBase64) => ipcRenderer.invoke('ocr-image', imageBase64),
  transcribeAudio: (request) => ipcRenderer.invoke('transcribe-audio', request),
  getFilePath: (file) => webUtils.getPathForFile(file),
  readTextFile: (filePath) => ipcRenderer.invoke('read-text-file', filePath),
  saveTextFile: (request) => ipcRenderer.invoke('save-text-file', request),
  getGlossary: () => ipcRenderer.invoke('get-glossary'),
  setGlossary: (glossary) => ipcRenderer.invoke('set-glossary', glossary),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (record) => ipcRenderer.invoke('add-history', record),
  deleteHistoryItem: (id) => ipcRenderer.invoke('delete-history-item', id),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getSpeechOptimizations: () => ipcRenderer.invoke('get-speech-optimizations'),
  addSpeechOptimization: (record) => ipcRenderer.invoke('add-speech-optimization', record),
  deleteSpeechOptimizationItem: (id) => ipcRenderer.invoke('delete-speech-optimization-item', id),
  clearSpeechOptimizations: () => ipcRenderer.invoke('clear-speech-optimizations'),
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  addFavorite: (record) => ipcRenderer.invoke('add-favorite', record),
  deleteFavorite: (id) => ipcRenderer.invoke('delete-favorite', id),
  updateFavoriteNote: (id, note) => ipcRenderer.invoke('update-favorite-note', id, note),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowSetAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('window-set-always-on-top', alwaysOnTop),
  closePopup: () => ipcRenderer.invoke('close-popup'),
  onStartGlobalRecording: (callback) => {
    const wrapped = (_event: IpcRendererEvent) => callback()
    ipcRenderer.on('start-global-recording', wrapped)
    return () => ipcRenderer.removeListener('start-global-recording', wrapped)
  },
  onStopGlobalRecording: (callback) => {
    const wrapped = (_event: IpcRendererEvent) => callback()
    ipcRenderer.on('stop-global-recording', wrapped)
    return () => ipcRenderer.removeListener('stop-global-recording', wrapped)
  },
  sendGlobalVoiceResult: (text) => ipcRenderer.send('global-voice-result', text),
  stopGlobalRecording: () => ipcRenderer.send('stop-global-recording-manual'),
  onToggleVoiceRecording: (callback) => {
    const wrapped = (_event: IpcRendererEvent) => callback()
    ipcRenderer.on('toggle-voice-recording', wrapped)
    return () => ipcRenderer.removeListener('toggle-voice-recording', wrapped)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
