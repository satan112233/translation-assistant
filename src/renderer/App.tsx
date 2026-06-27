import { useEffect, useState, Component, type ReactNode } from 'react'
import { TitleBar } from './components/TitleBar'
import { MainLayout } from './components/MainLayout'
import { useSettingsStore, useHistoryStore } from './stores'
import { useTheme } from './hooks/useTheme'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[renderer] caught render error:', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col h-screen p-6 bg-white dark:bg-stone-900 overflow-auto">
          <p className="text-red-500 font-semibold mb-2">应用渲染出错</p>
          <p className="text-sm text-stone-700 dark:text-stone-300 mb-4">
            请把下面的报错信息复制给我：
          </p>
          <pre className="text-xs bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 p-3 rounded-xl whitespace-pre-wrap break-all">
            {this.state.error.stack || this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn-primary mt-4 self-start"
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
      <div className="flex items-center justify-center h-screen p-8 bg-white dark:bg-stone-900">
        <div className="text-center">
          <p className="text-red-500 mb-2">应用加载出错</p>
          <p className="text-sm text-stone-600 dark:text-stone-300">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-stone-900">
      <TitleBar />
      <ErrorBoundary>
        <MainLayout />
      </ErrorBoundary>
    </div>
  )
}

export default App
