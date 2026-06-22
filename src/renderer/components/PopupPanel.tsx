import { useEffect, useState } from 'react'
import { X, Copy, Check, ArrowRightLeft, Pin, PinOff } from 'lucide-react'
import { useSettingsStore } from '../stores'
import { PROVIDER_LABELS } from '../../main/providers'
import { useTheme } from '../hooks/useTheme'

export function PopupPanel() {
  const params = new URLSearchParams(window.location.search)
  const initialText = params.get('text') || ''

  const { settings, isLoaded, loadSettings, saveSettings } = useSettingsStore()
  const [targetLang, setTargetLang] = useState<'zh' | 'en' | 'ja'>(settings.popupTargetLang ?? 'zh')
  const [result, setResult] = useState<{ translatedText: string; detectedSourceLang?: string; pronunciation?: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useTheme(settings.theme, isLoaded)

  useEffect(() => {
    if (!isLoaded) return
    let lang = settings.popupTargetLang ?? 'zh'

    // Auto-detect input language and switch target to avoid same-language translation
    const detected = detectInputLanguage(initialText)
    if (detected) {
      if (detected === 'zh') lang = 'en'
      else if (detected === 'en') lang = 'zh'
      else if (detected === 'ja') lang = 'zh'
    }

    if (lang !== targetLang) {
      setTargetLang(lang)
    }
    if (initialText.trim()) {
      void performTranslate(initialText, 'auto', lang)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded])

  const performTranslate = async (text: string, sourceLang: 'auto' | 'zh' | 'en' | 'ja', target: 'zh' | 'en' | 'ja') => {
    const providerConfig = settings.providers[settings.defaultProvider]
    if (!providerConfig) {
      setError('未配置翻译模型')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await window.electronAPI.translate({
        text,
        sourceLang,
        targetLang: target,
        provider: settings.defaultProvider,
        config: providerConfig,
      })
      setResult({
        translatedText: data.translatedText,
        detectedSourceLang: data.detectedSourceLang,
        pronunciation: data.pronunciation,
      })
      if (settings.autoCopyResult) {
        void navigator.clipboard.writeText(data.translatedText)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '翻译失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTargetChange = (lang: 'zh' | 'en' | 'ja') => {
    setTargetLang(lang)
    void saveSettings({ ...settings, popupTargetLang: lang })
    if (initialText.trim()) {
      void performTranslate(initialText, 'auto', lang)
    }
  }

  const handleCopy = async () => {
    if (!result?.translatedText) return
    await navigator.clipboard.writeText(result.translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleClose = () => {
    void window.electronAPI.closePopup()
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 app-drag-region">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{PROVIDER_LABELS[settings.defaultProvider] || settings.defaultProvider}</span>
          <select
            value={targetLang}
            onChange={(e) => handleTargetChange(e.target.value as 'zh' | 'en' | 'ja')}
            className="h-6 px-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded focus:outline-none"
          >
            <option value="zh">中文</option>
            <option value="en">英语</option>
            <option value="ja">日语</option>
          </select>
        </div>
        <button
          onClick={() => void saveSettings({ ...settings, popupPinned: !settings.popupPinned })}
          className={`
            p-1 rounded transition-colors
            ${settings.popupPinned
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}
          `}
          title={settings.popupPinned ? '取消固定' : '固定弹窗'}
        >
          {settings.popupPinned ? <Pin size={14} /> : <PinOff size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="p-1 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-3">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">原文</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{initialText}</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-sm text-gray-400 dark:text-gray-500">翻译中...</span>
          </div>
        ) : error ? (
          <div className="py-4">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => void performTranslate(initialText, 'auto', targetLang)}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              重试
            </button>
          </div>
        ) : result ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">译文</p>
              {result.detectedSourceLang && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  检测为 {getLanguageLabel(result.detectedSourceLang)}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-100 break-words leading-relaxed mb-2">{result.translatedText}</p>
            {result.pronunciation && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">读音：{result.pronunciation}</p>
            )}
            <button
              onClick={() => void handleCopy()}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? '已复制' : '复制译文'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function getLanguageLabel(code: string): string {
  const labels: Record<string, string> = {
    zh: '中文',
    en: '英语',
    ja: '日语',
  }
  return labels[code] || code
}

function detectInputLanguage(text: string): 'zh' | 'en' | 'ja' | null {
  let chineseCount = 0
  let japaneseCount = 0
  let englishCount = 0
  let meaningful = 0

  for (const char of text) {
    if (/[一-鿿]/.test(char)) {
      chineseCount++
      meaningful++
    } else if (/[぀-ゟ゠-ヿ]/.test(char)) {
      japaneseCount++
      meaningful++
    } else if (/[a-zA-Z]/.test(char)) {
      englishCount++
      meaningful++
    }
  }

  if (meaningful === 0) return null
  if (chineseCount / meaningful >= 0.3) return 'zh'
  if (japaneseCount / meaningful >= 0.3) return 'ja'
  if (englishCount / meaningful >= 0.5) return 'en'
  return null
}
