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
        <div className="flex flex-col h-screen p-6 bg-white dark:bg-gray-900 overflow-auto">
          <p className="text-red-500 font-semibold mb-2">应用渲染出错</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            请把下面的报错信息复制给我：
          </p>
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-3 rounded whitespace-pre-wrap break-all">
            {this.state.error.stack || this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 self-start px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
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
      <ErrorBoundary>
        <MainLayout />
      </ErrorBoundary>
    </div>
  )
}

export default App
