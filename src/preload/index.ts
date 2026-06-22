import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { FavoriteRecord, GlossaryEntry, HistoryRecord, MultiTranslateRequest, MultiTranslateResult, ReadTextFileResult, SaveTextFileRequest, SaveTextFileResult, TranslateRequest, TranslationResult } from '../shared/types'

export interface ElectronAPI {
  getSettings: () => Promise<unknown>
  setSettings: (settings: unknown) => Promise<boolean>
  translate: (request: TranslateRequest) => Promise<TranslationResult>
  translateMulti: (request: MultiTranslateRequest) => Promise<MultiTranslateResult>
  ocrImage: (imageBase64: string) => Promise<string>
  getFilePath: (file: File) => string
  readTextFile: (filePath: string) => Promise<ReadTextFileResult>
  saveTextFile: (request: SaveTextFileRequest) => Promise<SaveTextFileResult>
  getGlossary: () => Promise<GlossaryEntry[]>
  setGlossary: (glossary: GlossaryEntry[]) => Promise<boolean>
  getHistory: () => Promise<HistoryRecord[]>
  addHistory: (record: HistoryRecord) => Promise<boolean>
  deleteHistoryItem: (id: string) => Promise<boolean>
  clearHistory: () => Promise<boolean>
  getFavorites: () => Promise<FavoriteRecord[]>
  addFavorite: (record: FavoriteRecord) => Promise<boolean>
  deleteFavorite: (id: string) => Promise<boolean>
  updateFavoriteNote: (id: string, note: string) => Promise<boolean>
  windowMinimize: () => Promise<void>
  windowClose: () => Promise<void>
  windowSetAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>
  closePopup: () => Promise<void>
}

const api: ElectronAPI = {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  translate: (request) => ipcRenderer.invoke('translate', request),
  translateMulti: (request) => ipcRenderer.invoke('translate-multi', request),
  ocrImage: (imageBase64) => ipcRenderer.invoke('ocr-image', imageBase64),
  getFilePath: (file) => webUtils.getPathForFile(file),
  readTextFile: (filePath) => ipcRenderer.invoke('read-text-file', filePath),
  saveTextFile: (request) => ipcRenderer.invoke('save-text-file', request),
  getGlossary: () => ipcRenderer.invoke('get-glossary'),
  setGlossary: (glossary) => ipcRenderer.invoke('set-glossary', glossary),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (record) => ipcRenderer.invoke('add-history', record),
  deleteHistoryItem: (id) => ipcRenderer.invoke('delete-history-item', id),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  addFavorite: (record) => ipcRenderer.invoke('add-favorite', record),
  deleteFavorite: (id) => ipcRenderer.invoke('delete-favorite', id),
  updateFavoriteNote: (id, note) => ipcRenderer.invoke('update-favorite-note', id, note),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowSetAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('window-set-always-on-top', alwaysOnTop),
  closePopup: () => ipcRenderer.invoke('close-popup'),
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
