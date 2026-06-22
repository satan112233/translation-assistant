import { Minus, X, Pin, PinOff, Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSettingsStore } from '../stores'

export function TitleBar() {
  const { settings, saveSettings } = useSettingsStore()
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
    <div className="h-10 flex items-center justify-between bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 select-none app-drag-region">
      <div className="flex items-center px-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">翻译助手</span>
        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">({__APP_VERSION__})</span>
      </div>
      <div className="flex items-center">
        <button
          onClick={toggleTheme}
          className="h-10 w-10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={settings.theme === 'dark' ? '切换浅色' : '切换深色'}
        >
          {settings.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          onClick={toggleAlwaysOnTop}
          className="h-10 w-10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={isAlwaysOnTop ? '取消置顶' : '窗口置顶'}
        >
          {isAlwaysOnTop ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
        <button
          onClick={handleMinimize}
          className="h-10 w-10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="最小化"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleClose}
          className="h-10 w-10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white transition-colors"
          title="退出"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
