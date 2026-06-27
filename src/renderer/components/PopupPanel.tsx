import { useEffect, useState } from 'react'
import { X, Copy, Check, Pin, PinOff } from 'lucide-react'
import { useSettingsStore } from '../stores'
import { PROVIDER_LABELS } from '../../main/providers'
import { useTheme } from '../hooks/useTheme'
import { Dropdown } from './Dropdown'

const TARGET_LANG_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
] as const

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
    <div className="flex flex-col h-screen bg-stone-50 dark:bg-stone-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 app-drag-region">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-stone-900 dark:text-stone-100">划词翻译</h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
            {PROVIDER_LABELS[settings.defaultProvider] || settings.defaultProvider}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Dropdown
            value={targetLang}
            options={TARGET_LANG_OPTIONS}
            onChange={(lang) => handleTargetChange(lang as 'zh' | 'en' | 'ja')}
          />
          <button
            onClick={() => void saveSettings({ ...settings, popupPinned: !settings.popupPinned })}
            className={`
              icon-btn
              ${settings.popupPinned
                ? 'text-stone-900 bg-stone-100 dark:bg-stone-800 dark:text-stone-100'
                : ''}
            `}
            title={settings.popupPinned ? '取消固定' : '固定弹窗'}
          >
            {settings.popupPinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
          <button
            onClick={handleClose}
            className="icon-btn"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
          <p className="text-[10px] font-medium text-stone-400 dark:text-stone-500 mb-1">原文</p>
          <p className="text-sm text-stone-700 dark:text-stone-200 break-words leading-relaxed">{initialText}</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-5">
            <div className="w-5 h-5 border-2 border-stone-800 dark:border-stone-200 border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-sm text-stone-500 dark:text-stone-400">翻译中...</span>
          </div>
        ) : error ? (
          <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => void performTranslate(initialText, 'auto', targetLang)}
              className="mt-2 text-xs text-stone-600 dark:text-stone-300 hover:underline"
            >
              重试
            </button>
          </div>
        ) : result ? (
          <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-medium text-stone-400 dark:text-stone-500">译文</p>
              {result.detectedSourceLang && (
                <span className="text-[10px] text-stone-400 dark:text-stone-500">
                  检测为 {getLanguageLabel(result.detectedSourceLang)}
                </span>
              )}
            </div>
            <p className="text-[15px] text-stone-900 dark:text-stone-100 break-words leading-relaxed mb-2">{result.translatedText}</p>
            {result.pronunciation && (
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">读音：{result.pronunciation}</p>
            )}
            <button
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
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
