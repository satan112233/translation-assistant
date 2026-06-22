import { useEffect, useState } from 'react'
import { TitleBar } from './components/TitleBar'
import { TranslationPanel } from './components/TranslationPanel'
import { useSettingsStore, useHistoryStore } from './stores'
import { useTheme } from './hooks/useTheme'

function App() {
  const { settings, isLoaded, loadSettings } = useSettingsStore()
  const { loadHistory } = useHistoryStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      void loadSettings()
      void loadHistory()
    } catch (err) {
      console.error('[renderer] failed to load app data:', err)
      setError(err instanceof Error ? err.message : '加载应用数据失败')
    }
  }, [loadSettings, loadHistory])

  useTheme(settings.theme, isLoaded)

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-8 bg-white dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 mb-2">应用加载出错</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900">
      <TitleBar />
      <TranslationPanel />
    </div>
  )
}

export default App
