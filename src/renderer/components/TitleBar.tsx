import { Minus, X, Pin, PinOff, Sun, Moon, History, Star, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSettingsStore, useUIStore } from '../stores'

export function TitleBar() {
  const { settings, saveSettings } = useSettingsStore()
  const { openDrawer, setOpenDrawer } = useUIStore()
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(settings.alwaysOnTop)

  useEffect(() => {
    setIsAlwaysOnTop(settings.alwaysOnTop)
  }, [settings.alwaysOnTop])

  const handleMinimize = () => {
    window.electronAPI.windowMinimize()
  }

  const handleClose = () => {
    window.electronAPI.windowClose()
  }

  const toggleAlwaysOnTop = () => {
    const next = !isAlwaysOnTop
    setIsAlwaysOnTop(next)
    window.electronAPI.windowSetAlwaysOnTop(next)
    void saveSettings({ ...settings, alwaysOnTop: next })
  }

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark'
    void saveSettings({ ...settings, theme: nextTheme })
  }

  return (
    <div className="h-10 flex items-center justify-between bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 select-none app-drag-region">
      <div className="flex items-center px-4">
        <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">翻译助手</span>
        <span className="ml-2 text-xs text-stone-400 dark:text-stone-500">({__APP_VERSION__})</span>
      </div>
      <div className="flex items-center gap-0.5 pr-1">
        <button
          onClick={() => setOpenDrawer('history')}
          className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
            openDrawer === 'history'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
              : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="翻译历史"
        >
          <History size={15} />
        </button>
        <button
          onClick={() => setOpenDrawer('favorites')}
          className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
            openDrawer === 'favorites'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
              : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="收藏夹"
        >
          <Star size={15} />
        </button>
        <button
          onClick={() => setOpenDrawer('speech-optimization')}
          className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
            openDrawer === 'speech-optimization'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
              : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="语音优化记录"
        >
          <Sparkles size={15} />
        </button>

        <div className="mx-1 h-5 w-px bg-stone-200 dark:bg-stone-700" />

        <button
          onClick={toggleTheme}
          className="h-8 w-8 flex items-center justify-center rounded-full text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title={settings.theme === 'dark' ? '切换浅色' : '切换深色'}
        >
          {settings.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          onClick={toggleAlwaysOnTop}
          className="h-8 w-8 flex items-center justify-center rounded-full text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title={isAlwaysOnTop ? '取消置顶' : '窗口置顶'}
        >
          {isAlwaysOnTop ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
        <button
          onClick={handleMinimize}
          className="h-8 w-8 flex items-center justify-center rounded-full text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="最小化"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-8 flex items-center justify-center rounded-full text-stone-500 dark:text-stone-400 hover:bg-red-500 hover:text-white transition-colors"
          title="退出"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
