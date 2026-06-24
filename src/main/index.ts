import { app, shell, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, clipboard, screen, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import koffi from 'koffi'
import Store from 'electron-store'
import { createProvider } from './providers'
import { terminateActiveWhisperProcess, transcribeAudio as transcribeWithWhisper } from './whisper-service'
import { terminateActiveSherpaProcess, transcribeAudio as transcribeWithSherpa } from './sherpa-onnx-service'
import { transcribeWithZhipu } from './zhipu-asr-service'
import { transcribeWithIflytek } from './iflytek-asr-service'
import { optimizeSpeech } from './utils/speech-optimizer'
import { editTextWithVoice } from './utils/voice-editor'
import { MAX_HISTORY_COUNT, MAX_SPEECH_OPTIMIZATION_COUNT } from '../shared/types'
import type { GlossaryEntry, MultiTranslateRequest, MultiTranslateResult, TranslateRequest, TranscribeAudioRequest, SpeechOptimizationRecord, VoiceDictionaryEntry } from '../shared/types'
import { createWorker, type Worker } from 'tesseract.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function isMeaningfulSpeechText(text: string): boolean {
  if (!text || !text.trim()) return false
  // Consider text meaningful if it contains at least one CJK, Latin letter, Hiragana/Katakana, or digit
  return /[一-龥a-zA-Z0-9぀-ゟ゠-ヿ]/.test(text)
}

process.env.APP_ROOT = path.join(__dirname, '../..')

// Windows API for simulating copy in cross-selection translation
const user32 = koffi.load('user32.dll')
const GetForegroundWindow = user32.func('void *GetForegroundWindow()')
const SetForegroundWindow = user32.func('int SetForegroundWindow(void *)')
const keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uint64 dwExtraInfo)')
const GetAsyncKeyState = user32.func('short GetAsyncKeyState(int vKey)')

const VK_SHIFT = 0x10
const VK_CONTROL = 0x11
const VK_MENU = 0x12
const VK_C = 0x43
const VK_V = 0x56
const KEYEVENTF_KEYUP = 0x0002

const HOTKEY_VKEYS = [VK_SHIFT, VK_CONTROL, VK_MENU, VK_C]

const GLOBAL_VOICE_SHORTCUT = 'Ctrl+Alt+V'
const GLOBAL_VOICE_EDIT_SHORTCUT = 'Ctrl+Alt+E'
const GLOBAL_VOICE_TRANSLATE_SHORTCUT = 'Ctrl+Alt+F'

type GlobalVoiceMode = 'transcribe' | 'edit' | 'translate'

async function waitForHotkeyRelease(): Promise<void> {
  // Wait until all keys involved in the global shortcut are released.
  // This prevents the simulated Ctrl+C from becoming Ctrl+Shift+C
  // when the user is still holding the cross-selection shortcut.
  while (HOTKEY_VKEYS.some((vk) => (GetAsyncKeyState(vk) & 0x8000) !== 0)) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const packageJson = JSON.parse(readFileSync(path.join(process.env.APP_ROOT, 'package.json'), 'utf-8'))
const appVersion = packageJson.version || '0.0.0'

console.log(`[main] Translation Assistant v${appVersion}`)
console.log('[main] process.argv:', process.argv)

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

const devServerUrl = process.env.ELECTRON_RENDERER_URL

process.env.VITE_PUBLIC = devServerUrl
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Initialize secure store for API keys, settings, and history
const DEFAULT_SHORTCUTS = {
  toggleWindow: 'CommandOrControl+Alt+T',
  crossSelection: 'CommandOrControl+Alt+C',
}

const store = new Store<{
  settings: {
    defaultProvider: string
    providers: Record<string, { apiKey: string; baseUrl: string; model: string; appId?: string; apiSecret?: string }>
    windowBounds: { x?: number; y?: number; width: number; height: number }
    alwaysOnTop: boolean
    theme: 'light' | 'dark' | 'system'
    popupTargetLang: 'zh' | 'en' | 'ja'
    shortcuts: { toggleWindow: string; crossSelection: string }
    comparisonMode: boolean
    glossary: GlossaryEntry[]
    voiceDictionary: VoiceDictionaryEntry[]
    popupPinned: boolean
    voiceInputEnabled: boolean
    voiceInputProvider: 'local' | 'zhipu' | 'iflytek' | 'sherpa'
    voiceInputOptimize: boolean
    voiceInputLanguage: 'auto' | 'zh' | 'en' | 'ja'
    voiceInputShortcut: string
  }
  history: Array<{
    id: string
    sourceText: string
    translatedText: string
    sourceLang: 'auto' | 'zh' | 'en' | 'ja'
    targetLang: 'zh' | 'en' | 'ja'
    detectedSourceLang?: 'zh' | 'en' | 'ja'
    provider: string
    timestamp: number
  }>
  favorites: Array<{
    id: string
    sourceText: string
    translatedText: string
    sourceLang: 'auto' | 'zh' | 'en' | 'ja'
    targetLang: 'zh' | 'en' | 'ja'
    detectedSourceLang?: 'zh' | 'en' | 'ja'
    provider: string
    timestamp: number
    note?: string
  }>
  speechOptimizations: SpeechOptimizationRecord[]
  shortcutsResetToAlt?: boolean
}>({
  defaults: {
    settings: {
      defaultProvider: 'deepseek',
      providers: {
        deepseek: {
          apiKey: '',
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
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
      },
      windowBounds: { width: 900, height: 640 },
      alwaysOnTop: false,
      theme: 'light',
      popupTargetLang: 'zh',
      shortcuts: DEFAULT_SHORTCUTS,
      comparisonMode: false,
      glossary: [],
      voiceDictionary: [],
      popupPinned: false,
      voiceInputEnabled: true,
      voiceInputProvider: 'local',
      voiceInputOptimize: true,
      voiceInputLanguage: 'auto',
      voiceInputShortcut: 'Ctrl+Alt+V',
    },
    history: [],
    favorites: [],
    speechOptimizations: [],
  },
})

let win: BrowserWindow | null = null
let popupWin: BrowserWindow | null = null
let voiceWin: BrowserWindow | null = null
let recordingPopupWin: BrowserWindow | null = null
let tray: Tray | null = null
let ocrWorker: Worker | null = null

let voiceShortcutRegistered = false
let globalVoiceRecording = false
let globalVoiceMode: GlobalVoiceMode = 'transcribe'
let pendingEditText = ''
let lastForegroundHwnd: unknown = null
let pendingRecordingState: { isRecording: boolean; isTranscribing: boolean; recordingDuration: number; audioLevel?: number } | null = null

async function initOcrWorker(): Promise<void> {
  try {
    console.log('[main] initializing OCR worker...')
    ocrWorker = await createWorker('chi_sim+eng+jpn', undefined, {
      errorHandler: (e) => console.error('[tesseract]', e),
    })
    console.log('[main] OCR worker ready')
  } catch (error) {
    console.error('[main] failed to initialize OCR worker:', error)
  }
}

function createWindow(): void {
  const bounds = store.get('settings.windowBounds')

  win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    title: '翻译助手',
    show: false,
    autoHideMenuBar: true,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    ...(process.platform === 'linux' ? { icon: '' } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setAlwaysOnTop(store.get('settings.alwaysOnTop'))

  win.on('ready-to-show', () => {
    win?.show()
  })

  win.on('close', () => {
    if (win) {
      store.set('settings.windowBounds', win.getBounds())
    }
  })

  win.on('closed', () => {
    win = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev mode diagnostics
  if (devServerUrl) {
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error('[main] failed to load URL:', errorCode, errorDescription)
    })
    win.webContents.on('did-finish-load', () => {
      console.log('[main] renderer finished loading')
    })
    win.webContents.on('preload-error', (_event, preloadPath, error) => {
      console.error('[main] preload error:', preloadPath, error)
    })
  }

  if (devServerUrl) {
    console.log('[main] loading dev server URL:', devServerUrl)
    // Clear renderer cache in dev mode to avoid loading stale code
    void win.webContents.session.clearCache()
    win.loadURL(devServerUrl, {
      extraHeaders: 'Cache-Control: no-cache',
    })
  } else {
    console.log('[main] VITE_DEV_SERVER_URL not set, loading production build from:', RENDERER_DIST)
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function createPopupWindow(selectedText: string): void {
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const workArea = display.workArea

  const width = 440
  const height = 260

  let x = cursorPoint.x + 16
  let y = cursorPoint.y + 16

  if (x + width > workArea.x + workArea.width) {
    x = cursorPoint.x - width - 16
  }
  if (y + height > workArea.y + workArea.height) {
    y = cursorPoint.y - height - 16
  }

  x = Math.max(workArea.x, x)
  y = Math.max(workArea.y, y)

  if (popupWin) {
    popupWin.close()
    popupWin = null
  }

  popupWin = new BrowserWindow({
    width,
    height,
    x,
    y,
    title: '翻译结果',
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  popupWin.on('ready-to-show', () => {
    popupWin?.show()
  })

  popupWin.on('blur', () => {
    const settings = store.get('settings')
    if (!settings.popupPinned) {
      popupWin?.close()
      popupWin = null
    }
  })

  popupWin.on('closed', () => {
    popupWin = null
  })

  const encodedText = encodeURIComponent(selectedText)
  const popupUrl = devServerUrl
    ? `${devServerUrl}?mode=popup&text=${encodedText}`
    : `file://${path.join(RENDERER_DIST, 'index.html')}?mode=popup&text=${encodedText}`

  void popupWin.loadURL(popupUrl)
}

function isMainWindowFocused(): boolean {
  if (!win) return false
  const mainHwnd = win.getNativeWindowHandle()
  const fgHwnd = GetForegroundWindow()
  if (!fgHwnd) return false
  const mainValue = mainHwnd.readBigUInt64LE(0)
  const fgValue = BigInt(fgHwnd as unknown as bigint)
  return mainValue === fgValue
}

function registerVoiceShortcut(): void {
  if (voiceShortcutRegistered) return
  const success = globalShortcut.register(GLOBAL_VOICE_SHORTCUT, () => {
    void handleGlobalVoiceToggle('transcribe')
  })
  if (!success) {
    console.error('[main] failed to register global voice shortcut:', GLOBAL_VOICE_SHORTCUT)
    return
  }
  globalShortcut.register(GLOBAL_VOICE_EDIT_SHORTCUT, () => {
    void handleGlobalVoiceToggle('edit')
  })
  globalShortcut.register(GLOBAL_VOICE_TRANSLATE_SHORTCUT, () => {
    void handleGlobalVoiceToggle('translate')
  })
  voiceShortcutRegistered = true
  console.log('[main] global voice shortcuts registered:', GLOBAL_VOICE_SHORTCUT, GLOBAL_VOICE_EDIT_SHORTCUT, GLOBAL_VOICE_TRANSLATE_SHORTCUT)
}

function unregisterVoiceShortcut(): void {
  if (!voiceShortcutRegistered) return
  globalShortcut.unregister(GLOBAL_VOICE_SHORTCUT)
  globalShortcut.unregister(GLOBAL_VOICE_EDIT_SHORTCUT)
  globalShortcut.unregister(GLOBAL_VOICE_TRANSLATE_SHORTCUT)
  voiceShortcutRegistered = false
  console.log('[main] global voice shortcuts unregistered')
}

function createVoiceWindow(): void {
  if (voiceWin) return
  voiceWin = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    frame: false,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  voiceWin.on('closed', () => {
    voiceWin = null
  })

  const voiceUrl = devServerUrl
    ? `${devServerUrl}?mode=voice`
    : `file://${path.join(RENDERER_DIST, 'index.html')}?mode=voice`

  void voiceWin.loadURL(voiceUrl)
}

function closeVoiceWindow(): void {
  voiceWin?.close()
  voiceWin = null
}

function createRecordingPopupWindow(): void {
  // Show on whichever monitor the cursor is on, but pin the popup to a fixed
  // spot: horizontally centered, near the bottom just above the taskbar.
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const workArea = display.workArea

  const width = 360
  const height = 150
  const bottomMargin = 16

  // workArea already excludes the taskbar, so its bottom edge sits right above it.
  const x = workArea.x + Math.floor((workArea.width - width) / 2)
  const y = workArea.y + workArea.height - height - bottomMargin

  if (recordingPopupWin) {
    recordingPopupWin.close()
    recordingPopupWin = null
  }

  recordingPopupWin = new BrowserWindow({
    width,
    height,
    x,
    y,
    title: '语音输入中',
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    type: 'toolbar',
    focusable: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  recordingPopupWin.setAlwaysOnTop(true, 'screen-saver')

  recordingPopupWin.on('ready-to-show', () => {
    recordingPopupWin?.showInactive()
  })

  recordingPopupWin.on('closed', () => {
    recordingPopupWin = null
  })

  recordingPopupWin.webContents.on('did-finish-load', () => {
    if (pendingRecordingState) {
      recordingPopupWin?.webContents.send('recording-popup-state', pendingRecordingState)
    }
  })

  const popupUrl = devServerUrl
    ? `${devServerUrl}?mode=recording-popup`
    : `file://${path.join(RENDERER_DIST, 'index.html')}?mode=recording-popup`

  void recordingPopupWin.loadURL(popupUrl)
}

function closeRecordingPopupWindow(): void {
  recordingPopupWin?.close()
  recordingPopupWin = null
}

async function handleGlobalVoiceToggle(mode: GlobalVoiceMode): Promise<void> {
  const settings = store.get('settings')
  if (!settings.voiceInputEnabled) return

  // Already recording: stop and let the active mode finish processing.
  if (globalVoiceRecording) {
    globalVoiceRecording = false
    voiceWin?.webContents.send('stop-global-recording')
    return
  }

  // Plain voice input also works inside the main window (handled by the renderer).
  // Edit / translate target external selections & apps, so ignore them when the
  // main window is focused.
  if (isMainWindowFocused()) {
    if (mode === 'transcribe') {
      win?.webContents.send('toggle-voice-recording')
    }
    return
  }

  // Remember the foreground window so we can paste back into it later.
  lastForegroundHwnd = GetForegroundWindow()
  if (!lastForegroundHwnd) return

  // Edit mode needs the currently selected text before recording the command.
  if (mode === 'edit') {
    await waitForHotkeyRelease()
    pendingEditText = await captureSelectedText()
    if (!pendingEditText) {
      console.log('[main] voice edit: no text selected, aborting')
      globalVoiceMode = 'transcribe'
      return
    }
  } else {
    pendingEditText = ''
  }

  globalVoiceMode = mode
  globalVoiceRecording = true
  if (!voiceWin) {
    createVoiceWindow()
    voiceWin!.webContents.once('did-finish-load', () => {
      console.log('[main] voiceWin finished loading, sending start-global-recording')
      voiceWin?.webContents.send('start-global-recording')
    })
  } else {
    console.log('[main] voiceWin already exists, sending start-global-recording')
    voiceWin.webContents.send('start-global-recording')
  }
  createRecordingPopupWindow()
}

async function simulatePasteToForeground(text: string): Promise<void> {
  if (!text) return
  if (!lastForegroundHwnd) {
    console.log('[main] no foreground window recorded, cannot paste')
    return
  }

  const originalClipboard = clipboard.readText()
  clipboard.writeText(text)
  await new Promise((resolve) => setTimeout(resolve, 50))

  SetForegroundWindow(lastForegroundHwnd)
  await new Promise((resolve) => setTimeout(resolve, 80))

  keybd_event(VK_CONTROL, 0, 0, 0n)
  await new Promise((resolve) => setTimeout(resolve, 15))
  keybd_event(VK_V, 0, 0, 0n)
  await new Promise((resolve) => setTimeout(resolve, 15))
  keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0n)
  await new Promise((resolve) => setTimeout(resolve, 15))
  keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0n)

  setTimeout(() => {
    clipboard.writeText(originalClipboard)
  }, 300)
}

async function simulateCopy(): Promise<void> {
  try {
    const hwnd = GetForegroundWindow()
    if (!hwnd) return

    SetForegroundWindow(hwnd)
    await new Promise((resolve) => setTimeout(resolve, 50))

    keybd_event(VK_CONTROL, 0, 0, 0n)
    await new Promise((resolve) => setTimeout(resolve, 15))
    keybd_event(VK_C, 0, 0, 0n)
    await new Promise((resolve) => setTimeout(resolve, 15))
    keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0n)
    await new Promise((resolve) => setTimeout(resolve, 15))
    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0n)

    await new Promise((resolve) => setTimeout(resolve, 120))
  } catch (error) {
    console.error('[main] simulate copy failed:', error)
  }
}

async function captureSelectedText(): Promise<string> {
  const originalText = clipboard.readText()
  clipboard.writeText('')

  let selectedText = ''
  for (let i = 0; i < 3; i++) {
    await simulateCopy()
    selectedText = clipboard.readText().trim()
    if (selectedText) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  setTimeout(() => {
    clipboard.writeText(originalText)
  }, 300)

  return selectedText
}

async function handleCrossSelection(): Promise<void> {
  // Wait for the global shortcut keys to be released before simulating Ctrl+C.
  // Otherwise Shift may still be held down and the simulated copy becomes
  // Ctrl+Shift+C, which many apps treat differently from Ctrl+C.
  await waitForHotkeyRelease()

  const selectedText = await captureSelectedText()
  if (!selectedText) {
    console.log('[main] no text selected')
    return
  }

  console.log('[main] cross-selection text:', selectedText.slice(0, 50))
  createPopupWindow(selectedText)
}

function createTray(): void {
  // Use a simple 16x16 blank image as tray icon (will work on Windows)
  const emptyIcon = nativeImage.createEmpty()
  tray = new Tray(emptyIcon)
  tray.setToolTip('翻译助手')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '显示/隐藏',
        click: () => toggleWindow(),
      },
      {
        label: '退出',
        click: () => {
          app.quit()
        },
      },
    ])
  )
  tray.on('click', () => toggleWindow())
}

function toggleWindow(): void {
  if (!win) {
    createWindow()
    return
  }
  if (win.isVisible()) {
    win.hide()
  } else {
    win.show()
  }
}

function registerGlobalShortcut(): void {
  const shortcuts = store.get('settings.shortcuts') || DEFAULT_SHORTCUTS

  if (shortcuts.toggleWindow) {
    globalShortcut.register(shortcuts.toggleWindow, () => {
      toggleWindow()
    })
  }

  if (shortcuts.crossSelection) {
    globalShortcut.register(shortcuts.crossSelection, () => {
      void handleCrossSelection()
    })
  }

  const settings = store.get('settings')
  if (settings.voiceInputEnabled) {
    registerVoiceShortcut()
  }
}

function unregisterGlobalShortcut(): void {
  globalShortcut.unregisterAll()
  voiceShortcutRegistered = false
}

// IPC handlers
ipcMain.handle('get-settings', () => {
  return store.get('settings')
})

ipcMain.handle('set-settings', (_event, settings) => {
  try {
    console.log('[main] received set-settings:', JSON.stringify(settings, null, 2))
    const prev = store.get('settings')
    store.set('settings', settings)
    win?.setAlwaysOnTop(settings.alwaysOnTop)

    // Re-register global shortcuts when shortcuts change
    const shortcutsChanged =
      JSON.stringify(prev.shortcuts || DEFAULT_SHORTCUTS) !==
      JSON.stringify(settings.shortcuts || DEFAULT_SHORTCUTS)
    if (shortcutsChanged) {
      unregisterGlobalShortcut()
      registerGlobalShortcut()
    }

    // Register/unregister global voice hotkey when voice input setting changes
    if (settings.voiceInputEnabled !== prev.voiceInputEnabled) {
      if (settings.voiceInputEnabled) {
        registerVoiceShortcut()
        if (!voiceWin) createVoiceWindow()
      } else {
        unregisterVoiceShortcut()
        closeVoiceWindow()
        closeRecordingPopupWindow()
      }
    }

    return true
  } catch (error) {
    console.error('[main] failed to save settings:', error)
    throw error
  }
})

ipcMain.handle('translate', async (_event, request: TranslateRequest) => {
  try {
    console.log('[main] translate request:', request.provider, request.sourceLang, '->', request.targetLang)
    const glossary = store.get('settings').glossary || []
    const provider = createProvider(request.provider, request.config)
    const result = await provider.translate({
      text: request.text,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
    }, glossary)
    console.log('[main] translate result:', result.translatedText.slice(0, 50))
    return result
  } catch (error) {
    console.error('[main] translate error:', error)
    throw error
  }
})

ipcMain.handle('translate-multi', async (_event, request: MultiTranslateRequest) => {
  try {
    console.log(
      '[main] translate-multi request:',
      request.providers.map((p) => p.provider).join(', '),
      request.sourceLang,
      '->',
      request.targetLang
    )

    const glossary = store.get('settings').glossary || []

    const settled = await Promise.allSettled(
      request.providers.map(async ({ provider, config }) => {
        const p = createProvider(provider, config)
        const result = await p.translate({
          text: request.text,
          sourceLang: request.sourceLang,
          targetLang: request.targetLang,
        }, glossary)
        return { provider, result }
      })
    )

    const results: MultiTranslateResult['results'] = settled.map((item, index) => {
      const provider = request.providers[index].provider
      if (item.status === 'fulfilled') {
        return {
          provider,
          result: item.value.result,
          error: null,
          isLoading: false,
        }
      }
      return {
        provider,
        result: null,
        error: item.reason instanceof Error ? item.reason.message : String(item.reason),
        isLoading: false,
      }
    })

    console.log(
      '[main] translate-multi results:',
      results.map((r) => `${r.provider}=${r.error ? 'error' : 'ok'}`).join(', ')
    )

    return { results }
  } catch (error) {
    console.error('[main] translate-multi error:', error)
    throw error
  }
})

ipcMain.handle('get-glossary', () => {
  return store.get('settings').glossary || []
})

ipcMain.handle('set-glossary', (_event, glossary: GlossaryEntry[]) => {
  try {
    store.set('settings.glossary', glossary)
    return true
  } catch (error) {
    console.error('[main] failed to set glossary:', error)
    throw error
  }
})

ipcMain.handle('get-voice-dictionary', () => {
  return store.get('settings').voiceDictionary || []
})

ipcMain.handle('set-voice-dictionary', (_event, voiceDictionary: VoiceDictionaryEntry[]) => {
  try {
    store.set('settings.voiceDictionary', voiceDictionary)
    return true
  } catch (error) {
    console.error('[main] failed to set voice dictionary:', error)
    throw error
  }
})

ipcMain.handle('get-history', () => {
  return store.get('history')
})

ipcMain.handle('add-history', (_event, record) => {
  try {
    const history = store.get('history')
    const newHistory = [record, ...history.filter((item) => item.id !== record.id)].slice(0, MAX_HISTORY_COUNT)
    store.set('history', newHistory)
    return true
  } catch (error) {
    console.error('[main] failed to add history:', error)
    throw error
  }
})

ipcMain.handle('clear-history', () => {
  try {
    store.set('history', [])
    return true
  } catch (error) {
    console.error('[main] failed to clear history:', error)
    throw error
  }
})

ipcMain.handle('delete-history-item', (_event, id: string) => {
  try {
    const history = store.get('history')
    const newHistory = history.filter((item) => item.id !== id)
    store.set('history', newHistory)
    return true
  } catch (error) {
    console.error('[main] failed to delete history item:', error)
    throw error
  }
})

ipcMain.handle('get-speech-optimizations', () => {
  return store.get('speechOptimizations')
})

ipcMain.handle('add-speech-optimization', (_event, record: SpeechOptimizationRecord) => {
  try {
    const speechOptimizations = store.get('speechOptimizations')
    const newSpeechOptimizations = [record, ...speechOptimizations.filter((item) => item.id !== record.id)].slice(
      0,
      MAX_SPEECH_OPTIMIZATION_COUNT
    )
    store.set('speechOptimizations', newSpeechOptimizations)
    return true
  } catch (error) {
    console.error('[main] failed to add speech optimization:', error)
    throw error
  }
})

ipcMain.handle('clear-speech-optimizations', () => {
  try {
    store.set('speechOptimizations', [])
    return true
  } catch (error) {
    console.error('[main] failed to clear speech optimizations:', error)
    throw error
  }
})

ipcMain.handle('delete-speech-optimization-item', (_event, id: string) => {
  try {
    const speechOptimizations = store.get('speechOptimizations')
    const newSpeechOptimizations = speechOptimizations.filter((item) => item.id !== id)
    store.set('speechOptimizations', newSpeechOptimizations)
    return true
  } catch (error) {
    console.error('[main] failed to delete speech optimization item:', error)
    throw error
  }
})

ipcMain.handle('get-favorites', () => {
  return store.get('favorites')
})

ipcMain.handle('add-favorite', (_event, record) => {
  try {
    const favorites = store.get('favorites')
    const newFavorites = [record, ...favorites.filter((item) => item.id !== record.id)]
    store.set('favorites', newFavorites)
    return true
  } catch (error) {
    console.error('[main] failed to add favorite:', error)
    throw error
  }
})

ipcMain.handle('delete-favorite', (_event, id: string) => {
  try {
    const favorites = store.get('favorites')
    const newFavorites = favorites.filter((item) => item.id !== id)
    store.set('favorites', newFavorites)
    return true
  } catch (error) {
    console.error('[main] failed to delete favorite:', error)
    throw error
  }
})

ipcMain.handle('update-favorite-note', (_event, id: string, note: string) => {
  try {
    const favorites = store.get('favorites')
    const newFavorites = favorites.map((item) =>
      item.id === id ? { ...item, note } : item
    )
    store.set('favorites', newFavorites)
    return true
  } catch (error) {
    console.error('[main] failed to update favorite note:', error)
    throw error
  }
})

ipcMain.handle('window-minimize', () => {
  win?.minimize()
})

ipcMain.handle('window-close', () => {
  app.quit()
})

ipcMain.handle('window-set-always-on-top', (_event, alwaysOnTop: boolean) => {
  win?.setAlwaysOnTop(alwaysOnTop)
})

ipcMain.handle('close-popup', () => {
  popupWin?.close()
  popupWin = null
})

function detectVoiceLang(text: string): 'zh' | 'en' | 'ja' {
  // Japanese kana takes priority; CJK ideographs without kana are treated as Chinese.
  if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja'
  if (/[一-鿿]/.test(text)) return 'zh'
  return 'en'
}

async function translateTextForVoice(text: string): Promise<string> {
  const settings = store.get('settings')
  const providerName = settings.defaultProvider
  const config = settings.providers?.[providerName]
  if (!config?.apiKey?.trim()) {
    throw new Error(`未配置 ${providerName} 的 API Key，无法进行语音直译`)
  }

  // Auto target: zh→en, en→zh, ja→zh (same rule as the translation panel).
  const sourceLang = detectVoiceLang(text)
  const targetLang: 'zh' | 'en' = sourceLang === 'zh' ? 'en' : 'zh'

  const glossary = settings.glossary || []
  const provider = createProvider(providerName, config)
  const result = await provider.translate(
    { text, sourceLang, targetLang },
    glossary
  )
  return result.translatedText
}

ipcMain.on('global-voice-result', async (_event, text: string) => {
  console.log('[main] global voice result:', text.slice(0, 50), 'mode:', globalVoiceMode)
  closeRecordingPopupWindow()
  globalVoiceRecording = false

  const mode = globalVoiceMode
  const editText = pendingEditText
  globalVoiceMode = 'transcribe'
  pendingEditText = ''

  try {
    if (mode === 'edit') {
      if (!text.trim() || !editText.trim()) return
      const config = store.get('settings').providers?.deepseek
      if (!config?.apiKey?.trim()) {
        throw new Error('未配置 DeepSeek API Key，无法启用语音编辑')
      }
      const edited = await editTextWithVoice(editText, text, config)
      await simulatePasteToForeground(edited)
      return
    }

    if (mode === 'translate') {
      if (!text.trim()) return
      const translated = await translateTextForVoice(text)
      await simulatePasteToForeground(translated)
      return
    }

    await simulatePasteToForeground(text)
  } catch (error) {
    console.error('[main] global voice result processing failed:', error)
    // Fall back to pasting the recognized text so the user's speech is not lost.
    if (mode === 'translate' && text.trim()) {
      await simulatePasteToForeground(text)
    }
  }
})

ipcMain.on('stop-global-recording-manual', () => {
  console.log('[main] manual stop global recording requested from popup')
  if (globalVoiceRecording) {
    voiceWin?.webContents.send('stop-global-recording')
  }
})

ipcMain.on('cancel-global-voice', () => {
  console.log('[main] cancel global voice requested from popup')
  closeRecordingPopupWindow()
  globalVoiceMode = 'transcribe'
  pendingEditText = ''
  if (globalVoiceRecording) {
    globalVoiceRecording = false
    voiceWin?.webContents.send('cancel-global-recording')
  }
})

ipcMain.on('recording-popup-ready', () => {
  console.log('[main] recording popup ready, sending pending state:', pendingRecordingState)
  if (pendingRecordingState) {
    recordingPopupWin?.webContents.send('recording-popup-state', {
      ...pendingRecordingState,
      mode: globalVoiceMode,
      editPreview: pendingEditText.slice(0, 40),
    })
  }
})

ipcMain.on('recording-state', (_event, state: { isRecording: boolean; isTranscribing: boolean; recordingDuration: number; audioLevel?: number }) => {
  console.log('[main] received recording-state:', state)
  pendingRecordingState = state
  recordingPopupWin?.webContents.send('recording-popup-state', {
    ...state,
    mode: globalVoiceMode,
    editPreview: pendingEditText.slice(0, 40),
  })
})

const MAX_TEXT_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TEXT_EXTENSIONS = new Set(['.txt', '.md'])

ipcMain.handle('read-text-file', async (_event, filePath: string) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('文件路径无效')
    }

    const ext = path.extname(filePath).toLowerCase()
    if (!ALLOWED_TEXT_EXTENSIONS.has(ext)) {
      throw new Error(`不支持的文件格式：${ext}，仅支持 .txt 和 .md`)
    }

    const stats = await import('node:fs').then((fs) => fs.promises.stat(filePath))
    if (stats.size > MAX_TEXT_FILE_SIZE) {
      throw new Error(`文件过大（${Math.round(stats.size / 1024)}KB），请上传小于 2MB 的文本文件`)
    }

    const content = readFileSync(filePath, 'utf-8')
    return {
      name: path.basename(filePath),
      content,
    }
  } catch (error) {
    console.error('[main] read text file error:', error)
    throw error
  }
})

ipcMain.handle('save-text-file', async (_event, request: { fileName: string; content: string }) => {
  try {
    const { fileName, content } = request
    if (!fileName || typeof content !== 'string') {
      throw new Error('文件名或内容无效')
    }

    const result = win
      ? await dialog.showSaveDialog(win, {
          defaultPath: fileName,
          filters: [
            { name: 'Text Files', extensions: ['txt', 'md'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        })
      : await dialog.showSaveDialog({
          defaultPath: fileName,
          filters: [
            { name: 'Text Files', extensions: ['txt', 'md'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    writeFileSync(result.filePath, content, 'utf-8')
    return { canceled: false, filePath: result.filePath }
  } catch (error) {
    console.error('[main] save text file error:', error)
    throw error
  }
})

// OCR from image data URL (used for paste-from-clipboard image)
ipcMain.handle('ocr-image', async (_event, imageBase64: string) => {
  try {
    console.log('[main] starting OCR on pasted image...')
    if (!ocrWorker) {
      console.log('[main] OCR worker not ready, creating on demand...')
      ocrWorker = await createWorker('chi_sim+eng+jpn', undefined, {
        errorHandler: (e) => console.error('[tesseract]', e),
      })
    }
    const ret = await ocrWorker.recognize(imageBase64)
    const recognizedText = ret.data.text.trim()

    if (!recognizedText) {
      throw new Error('未能识别出文字，请尝试粘贴更清晰的图片。')
    }

    console.log('[main] OCR result:', recognizedText.slice(0, 50))
    return recognizedText
  } catch (error) {
    console.error('[main] OCR error:', error)
    throw error
  }
})

// Speech-to-text from base64-encoded WAV audio
ipcMain.handle('transcribe-audio', async (_event, request: TranscribeAudioRequest) => {
  try {
    const settings = store.get('settings')
    const provider = settings.voiceInputProvider || 'local'
    let rawText = ''

    if (provider === 'zhipu') {
      console.log('[main] starting Zhipu ASR transcription...')
      const apiKey = settings.providers?.zhipu?.apiKey
      rawText = await transcribeWithZhipu(request.audioBase64, apiKey || '')
      console.log('[main] Zhipu ASR result:', rawText.slice(0, 50))
    } else if (provider === 'iflytek') {
      console.log('[main] starting iFlytek ASR transcription...')
      const iflytek = settings.providers?.iflytek
      rawText = await transcribeWithIflytek(
        request.audioBase64,
        {
          apiKey: iflytek?.apiKey || '',
          baseUrl: '',
          model: '',
          appId: iflytek?.appId || '',
          apiSecret: iflytek?.apiSecret || '',
        }
      )
      console.log('[main] iFlytek ASR result:', rawText.slice(0, 50))
    } else if (provider === 'sherpa') {
      console.log('[main] starting Sherpa-onnx transcription...')
      const result = await transcribeWithSherpa(request)
      rawText = result.text
      console.log('[main] Sherpa-onnx result:', rawText.slice(0, 50))
    } else {
      console.log('[main] starting whisper.cpp transcription...')
      const result = await transcribeWithWhisper(request)
      rawText = result.text
      console.log('[main] transcription result:', rawText.slice(0, 50))
    }

    if (!isMeaningfulSpeechText(rawText)) {
      console.log('[main] no meaningful speech detected, ignoring')
      return { text: '' }
    }

    // Voice-edit commands must stay verbatim (they are instructions, not prose),
    // so skip the spoken-text optimization for that mode.
    if (settings.voiceInputOptimize && rawText.trim() && globalVoiceMode !== 'edit') {
      console.log('[main] optimizing spoken text with DeepSeek...')
      const deepseekConfig = settings.providers?.deepseek
      if (!deepseekConfig?.apiKey?.trim()) {
        throw new Error('未配置 DeepSeek API Key，无法启用口语内容优化')
      }
      const optimizedText = await optimizeSpeech(rawText, deepseekConfig, settings.glossary, settings.voiceDictionary)
      console.log('[main] optimized text:', optimizedText.slice(0, 50))

      if (!isMeaningfulSpeechText(optimizedText)) {
        console.log('[main] optimized text contains no meaningful speech, ignoring')
        return { text: '' }
      }

      // Save optimization record for later review
      const record: SpeechOptimizationRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        rawText,
        optimizedText,
        timestamp: Date.now(),
      }
      const existing = store.get('speechOptimizations')
      store.set(
        'speechOptimizations',
        [record, ...existing.filter((item) => item.id !== record.id)].slice(0, MAX_SPEECH_OPTIMIZATION_COUNT)
      )

      return { text: optimizedText }
    }

    return { text: rawText }
  } catch (error) {
    console.error('[main] transcription error:', error)
    throw error
  }
})

function migrateShortcuts(): void {
  // One-time reset: drop any previously-saved shortcuts and adopt the new
  // Ctrl+Alt defaults. Runs once, so the user can still customize afterwards.
  if (store.get('shortcutsResetToAlt')) return
  store.set('settings.shortcuts', DEFAULT_SHORTCUTS)
  store.set('shortcutsResetToAlt', true)
  console.log('[main] reset shortcuts to Ctrl+Alt defaults:', DEFAULT_SHORTCUTS)
}

app.whenReady().then(async () => {
  console.log(`[main] app ready, version ${appVersion}`)
  migrateShortcuts()
  createWindow()
  createTray()
  registerGlobalShortcut()

  const settings = store.get('settings')
  if (settings.voiceInputEnabled) {
    createVoiceWindow()
  }

  // Pre-init OCR worker in background so first use is fast
  void initOcrWorker()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      win?.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep app running in tray on Windows
  }
})

app.on('before-quit', async () => {
  globalShortcut.unregisterAll()
  voiceShortcutRegistered = false
  closeVoiceWindow()
  closeRecordingPopupWindow()
  tray?.destroy()
  terminateActiveWhisperProcess()
  terminateActiveSherpaProcess()
  if (ocrWorker) {
    try {
      await ocrWorker.terminate()
      console.log('[main] OCR worker terminated')
    } catch {
      // ignore
    }
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  voiceShortcutRegistered = false
})
