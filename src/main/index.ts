import { app, shell, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, clipboard, screen, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import koffi from 'koffi'
import Store from 'electron-store'
import { createProvider } from './providers'
import { MAX_HISTORY_COUNT } from '../shared/types'
import type { MultiTranslateRequest, MultiTranslateResult, TranslateRequest } from '../shared/types'
import { createWorker, type Worker } from 'tesseract.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

// Windows API for simulating copy in cross-selection translation
const user32 = koffi.load('user32.dll')
const GetForegroundWindow = user32.func('void *GetForegroundWindow()')
const SetForegroundWindow = user32.func('int SetForegroundWindow(void *)')
const keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uint64 dwExtraInfo)')

const VK_CONTROL = 0x11
const VK_C = 0x43
const KEYEVENTF_KEYUP = 0x0002

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
  toggleWindow: 'CommandOrControl+Shift+T',
  crossSelection: 'CommandOrControl+Shift+C',
}

const store = new Store<{
  settings: {
    defaultProvider: string
    providers: Record<string, { apiKey: string; baseUrl: string; model: string }>
    windowBounds: { x?: number; y?: number; width: number; height: number }
    alwaysOnTop: boolean
    theme: 'light' | 'dark' | 'system'
    popupTargetLang: 'zh' | 'en' | 'ja'
    clipboardMonitor: boolean
    shortcuts: { toggleWindow: string; crossSelection: string }
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
}>({
  defaults: {
    settings: {
      defaultProvider: 'deepseek',
      providers: {
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
      },
      windowBounds: { width: 900, height: 640 },
      alwaysOnTop: false,
      theme: 'light',
      popupTargetLang: 'zh',
      clipboardMonitor: false,
      shortcuts: DEFAULT_SHORTCUTS,
    },
    history: [],
    favorites: [],
  },
})

let win: BrowserWindow | null = null
let popupWin: BrowserWindow | null = null
let tray: Tray | null = null
let ocrWorker: Worker | null = null
let clipboardMonitorInterval: ReturnType<typeof setInterval> | null = null
let lastClipboardText = ''

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

function startClipboardMonitor(): void {
  if (clipboardMonitorInterval) return
  console.log('[main] starting clipboard monitor')
  lastClipboardText = clipboard.readText()
  clipboardMonitorInterval = setInterval(() => {
    const text = clipboard.readText().trim()
    if (!text || text === lastClipboardText || text.length < 2) return
    lastClipboardText = text
    console.log('[main] clipboard changed:', text.slice(0, 50))
    void handleClipboardTranslate(text)
  }, 500)
}

function stopClipboardMonitor(): void {
  if (!clipboardMonitorInterval) return
  console.log('[main] stopping clipboard monitor')
  clearInterval(clipboardMonitorInterval)
  clipboardMonitorInterval = null
}

async function handleClipboardTranslate(text: string): Promise<void> {
  // Avoid creating popup if main window is focused (user is actively using the app)
  if (win?.isFocused()) return
  createPopupWindow(text)
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

  const width = 360
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
    popupWin?.close()
    popupWin = null
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

async function handleCrossSelection(): Promise<void> {
  const originalText = clipboard.readText()

  // Clear clipboard so we can detect whether copy succeeded
  clipboard.writeText('')

  let selectedText = ''
  for (let i = 0; i < 3; i++) {
    await simulateCopy()
    selectedText = clipboard.readText().trim()
    if (selectedText) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Restore original clipboard
  setTimeout(() => {
    clipboard.writeText(originalText)
  }, 300)

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
}

function unregisterGlobalShortcut(): void {
  globalShortcut.unregisterAll()
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

    // Toggle clipboard monitor when setting changes
    if (settings.clipboardMonitor !== prev.clipboardMonitor) {
      if (settings.clipboardMonitor) {
        startClipboardMonitor()
      } else {
        stopClipboardMonitor()
      }
    }

    // Re-register global shortcuts when shortcuts change
    const shortcutsChanged =
      JSON.stringify(prev.shortcuts || DEFAULT_SHORTCUTS) !==
      JSON.stringify(settings.shortcuts || DEFAULT_SHORTCUTS)
    if (shortcutsChanged) {
      unregisterGlobalShortcut()
      registerGlobalShortcut()
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
    const provider = createProvider(request.provider, request.config)
    const result = await provider.translate({
      text: request.text,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
    })
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

    const settled = await Promise.allSettled(
      request.providers.map(async ({ provider, config }) => {
        const p = createProvider(provider, config)
        const result = await p.translate({
          text: request.text,
          sourceLang: request.sourceLang,
          targetLang: request.targetLang,
        })
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

app.whenReady().then(async () => {
  console.log(`[main] app ready, version ${appVersion}`)
  createWindow()
  createTray()
  registerGlobalShortcut()
  // Pre-init OCR worker in background so first use is fast
  void initOcrWorker()

  // Start clipboard monitor if enabled
  const settings = store.get('settings')
  if (settings.clipboardMonitor) {
    startClipboardMonitor()
  }

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

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
})

app.on('before-quit', async () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
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
})
