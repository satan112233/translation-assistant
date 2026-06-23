import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, Copy, Check, Languages, Volume2, Square, Star, FileDown } from 'lucide-react'
import { useTranslationStore, useSettingsStore, useHistoryStore, useFavoritesStore, useRecordingStore } from '../stores'
import { LanguageSelector } from './LanguageSelector'
import { VoiceRecorder } from './VoiceRecorder'
import { PROVIDER_LABELS } from '../../main/providers'
import type { LanguageCode, ProviderTranslationResult, TranslationResult } from '../../shared/types'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function TranslationPanel() {
  const {
    inputText,
    sourceLang,
    targetLang,
    result,
    results,
    isLoading,
    error,
    shouldSkipNextAutoTranslate,
    setInputText,
    setSourceLang,
    setTargetLang,
    swapLanguages,
    translate,
    resetSkipFlag,
  } = useTranslationStore()
  const { settings, isLoaded } = useSettingsStore()
  const { loadHistory } = useHistoryStore()
  const { loadFavorites } = useFavoritesStore()
  const { isTranscribing, transcribedText, setTranscribedText } = useRecordingStore()
  const [isOcrProcessing, setIsOcrProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const translateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRequestRef = useRef({ inputText, sourceLang, targetLang })

  useEffect(() => {
    void loadHistory()
    void loadFavorites()
    return () => {
      if (translateTimeoutRef.current) clearTimeout(translateTimeoutRef.current)
    }
  }, [loadHistory, loadFavorites])

  // Auto-focus textarea when the translate view becomes active
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Apply voice transcription result to input
  useEffect(() => {
    if (transcribedText !== null && transcribedText.trim()) {
      setInputText(transcribedText)
      setTranscribedText(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcribedText])

  // Auto-switch target language based on detected input text (only when sourceLang is 'auto')
  useEffect(() => {
    if (sourceLang !== 'auto') return
    const text = inputText.trim()
    if (text.length < 3) return

    const detected = detectInputLanguage(text)
    if (!detected) return

    // Desired target: zh→en, en→zh, ja→zh
    let desiredTarget: 'zh' | 'en' | 'ja' | null = null
    if (detected === 'zh') desiredTarget = 'en'
    else if (detected === 'en') desiredTarget = 'zh'
    else if (detected === 'ja') desiredTarget = 'zh'

    if (desiredTarget && desiredTarget !== targetLang) {
      setTargetLang(desiredTarget)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, sourceLang])

  useEffect(() => {
    const currentRequest = { inputText, sourceLang, targetLang }
    if (
      inputText === lastRequestRef.current.inputText &&
      sourceLang === lastRequestRef.current.sourceLang &&
      targetLang === lastRequestRef.current.targetLang
    ) {
      return
    }
    lastRequestRef.current = currentRequest

    if (shouldSkipNextAutoTranslate) {
      resetSkipFlag()
      return
    }

    if (translateTimeoutRef.current) clearTimeout(translateTimeoutRef.current)
    translateTimeoutRef.current = setTimeout(() => {
      void translate()
    }, 600)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, sourceLang, targetLang])

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    // Only accept files from the local filesystem
    if (e.dataTransfer.files.length > 1) {
      alert('请一次只拖拽一个文件')
      return
    }

    try {
      const filePath = window.electronAPI.getFilePath(file)
      const readResult = await window.electronAPI.readTextFile(filePath)
      setInputText(readResult.content)
      // Auto-translate will be triggered by the useEffect watching inputText
    } catch (err) {
      console.error('读取文件失败:', err)
      alert(err instanceof Error ? err.message : '读取文件失败')
    }
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    let imageItem: DataTransferItem | null = null

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        imageItem = item
        break
      }
    }

    if (!imageItem) return // Let normal text paste through

    e.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) return

    setIsOcrProcessing(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('读取图片失败'))
        reader.readAsDataURL(file)
      })

      const recognizedText = await window.electronAPI.ocrImage(base64)
      setInputText(recognizedText)
      // Auto-translate will be triggered by the useEffect watching inputText
    } catch (err) {
      console.error('OCR paste failed:', err)
      alert(err instanceof Error ? err.message : '图片识别失败')
    } finally {
      setIsOcrProcessing(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <Languages size={18} className="text-blue-600 dark:text-blue-400" />
          <LanguageSelector
            includeAuto
            value={sourceLang}
            onChange={setSourceLang}
          />
          <button
            onClick={swapLanguages}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
            title="交换语言"
          >
            <ArrowRightLeft size={16} />
          </button>
          <LanguageSelector
            value={targetLang}
            onChange={setTargetLang}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {isLoaded
              ? settings.comparisonMode
                ? '对比翻译'
                : PROVIDER_LABELS[settings.defaultProvider] || settings.defaultProvider
              : '加载中...'}
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Input area */}
        <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div
            className="flex-1 relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              ref={textareaRef}
              onPaste={handlePaste}
              placeholder="输入要翻译的文本，粘贴图片进行 OCR 识别，或拖拽 .txt / .md 文件到此处…"
              className={cn(
                'w-full h-full p-4 resize-none outline-none text-[15px] leading-relaxed bg-transparent',
                isDragging
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-100 placeholder:text-blue-400 dark:placeholder:text-blue-300'
                  : 'text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500'
              )}
              spellCheck={false}
            />
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 dark:bg-blue-500/10 pointer-events-none">
                <div className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg shadow-lg">
                  释放以读取文件
                </div>
              </div>
            )}
            {isOcrProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">正在识别图片文字...</span>
                </div>
              </div>
            )}
            {isTranscribing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">正在识别语音...</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex-none flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
            <span className="text-xs text-gray-400 dark:text-gray-500">{inputText.length} 字符</span>
            <div className="flex items-center gap-2">
              {settings.voiceInputEnabled && (
                <VoiceRecorder />
              )}
              <button
                onClick={() => setInputText('')}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                清空
              </button>
            </div>
          </div>
        </div>

        {/* Result area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
          <div className="flex-1 p-4 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-400 dark:text-gray-500">正在翻译...</span>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-sm text-red-500 mb-2">{error}</p>
                  <button
                    onClick={() => void translate()}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    重试
                  </button>
                </div>
              </div>
            ) : results ? (
              <div className="space-y-4">
                {results.map((item) => (
                  <ProviderResultCard
                    key={item.provider}
                    item={item}
                    inputText={inputText}
                    sourceLang={sourceLang}
                    targetLang={targetLang}
                  />
                ))}
              </div>
            ) : result ? (
              <div className="space-y-4">
                <SingleResultView
                  result={result}
                  inputText={inputText}
                  sourceLang={sourceLang}
                  targetLang={targetLang}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-sm text-gray-400 dark:text-gray-500">翻译结果将显示在这里</span>
              </div>
            )}
          </div>
        </div>
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
    // CJK Unified Ideographs (Chinese)
    if (/[一-鿿]/.test(char)) {
      chineseCount++
      meaningful++
    }
    // Hiragana + Katakana (Japanese)
    else if (/[぀-ゟ゠-ヿ]/.test(char)) {
      japaneseCount++
      meaningful++
    }
    // English letters
    else if (/[a-zA-Z]/.test(char)) {
      englishCount++
      meaningful++
    }
    // Numbers and common punctuation are ignored for detection
  }

  if (meaningful === 0) return null

  // Threshold: need at least 30% of meaningful chars to call it that language
  if (chineseCount / meaningful >= 0.3) return 'zh'
  if (japaneseCount / meaningful >= 0.3) return 'ja'
  if (englishCount / meaningful >= 0.5) return 'en'

  return null
}

interface SingleResultViewProps {
  result: TranslationResult
  inputText: string
  sourceLang: 'auto' | LanguageCode
  targetLang: LanguageCode
}

function SingleResultView({ result, inputText, sourceLang, targetLang }: SingleResultViewProps) {
  const { settings } = useSettingsStore()
  const { favorites, addFavorite } = useFavoritesStore()
  const [copied, setCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }

  const handleSpeak = () => {
    if (!result.translatedText) return

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const langMap: Record<string, string> = {
      zh: 'zh-CN',
      en: 'en-US',
      ja: 'ja-JP',
    }

    const utterance = new SpeechSynthesisUtterance(result.translatedText)
    utterance.lang = langMap[targetLang] || 'zh-CN'
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
  }

  const handleFavorite = () => {
    if (!inputText.trim()) return
    const trimmedText = inputText.trim()
    const isFavorited = favorites.some(
      (f) => f.sourceText === trimmedText && f.translatedText === result.translatedText
    )
    if (isFavorited) return

    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sourceText: trimmedText,
      translatedText: result.translatedText,
      sourceLang,
      targetLang,
      detectedSourceLang: result.detectedSourceLang,
      provider: settings.defaultProvider,
      timestamp: Date.now(),
      note: '',
    }
    void addFavorite(record)
  }

  const handleExportResult = async () => {
    if (!result.translatedText) return

    const dateStr = new Date().toISOString().slice(0, 10)
    const fileName = `translated_${dateStr}.txt`
    const content = [
      '【原文】',
      inputText.trim(),
      '',
      '【译文】',
      result.translatedText,
      result.pronunciation ? `\n【读音】${result.pronunciation}` : '',
      result.alternatives?.length ? `\n【备选译法】\n${result.alternatives.join('\n')}` : '',
    ].join('\n')

    try {
      const saveResult = await window.electronAPI.saveTextFile({ fileName, content })
      if (saveResult.canceled) return
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      saveResult.filePath && console.log('已保存到:', saveResult.filePath)
    } catch (err) {
      console.error('导出译文失败:', err)
      alert(err instanceof Error ? err.message : '导出译文失败')
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
          {result.translatedText}
        </p>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => void handleSpeak()}
            className={`
              p-1.5 rounded-md transition-colors
              ${isSpeaking
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}
            `}
            title={isSpeaking ? '停止朗读' : '朗读译文'}
          >
            {isSpeaking ? <Square size={14} fill="currentColor" /> : <Volume2 size={16} />}
          </button>
          <button
            onClick={() => void handleFavorite()}
            className={`
              p-1.5 rounded-md transition-colors
              ${favorites.some((f) => f.sourceText === inputText.trim() && f.translatedText === result.translatedText)
                ? 'text-yellow-500 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'}
            `}
            title="收藏"
          >
            <Star size={16} />
          </button>
          <button
            onClick={() => void handleExportResult()}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
            title="导出译文"
          >
            <FileDown size={16} />
          </button>
          <button
            onClick={() => void handleCopy(result.translatedText)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
            title="复制译文"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {result.pronunciation && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium">读音：</span> {result.pronunciation}
        </div>
      )}

      {result.detectedSourceLang && sourceLang === 'auto' && (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          检测到：{getLanguageLabel(result.detectedSourceLang)}
        </div>
      )}

      {result.alternatives && result.alternatives.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">备选译法</p>
          <div className="space-y-1">
            {result.alternatives.map((alt, index) => (
              <div
                key={index}
                className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 px-2 py-1 rounded"
                onClick={() => void handleCopy(alt)}
              >
                {alt}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

interface ProviderResultCardProps {
  item: ProviderTranslationResult
  inputText: string
  sourceLang: 'auto' | LanguageCode
  targetLang: LanguageCode
}

function ProviderResultCard({ item, inputText, sourceLang, targetLang }: ProviderResultCardProps) {
  const { favorites, addFavorite } = useFavoritesStore()
  const [copied, setCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }

  const handleSpeak = (text: string) => {
    if (!text) return

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const langMap: Record<string, string> = {
      zh: 'zh-CN',
      en: 'en-US',
      ja: 'ja-JP',
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = langMap[targetLang] || 'zh-CN'
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
  }

  const handleFavorite = () => {
    if (!item.result || !inputText.trim()) return
    const trimmedText = inputText.trim()
    const isFavorited = favorites.some(
      (f) => f.sourceText === trimmedText && f.translatedText === item.result!.translatedText
    )
    if (isFavorited) return

    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sourceText: trimmedText,
      translatedText: item.result.translatedText,
      sourceLang,
      targetLang,
      detectedSourceLang: item.result.detectedSourceLang,
      provider: item.provider,
      timestamp: Date.now(),
      note: '',
    }
    void addFavorite(record)
  }

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {PROVIDER_LABELS[item.provider] || item.provider}
          </span>
          {item.isLoading && (
            <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          )}
          {item.error && (
            <span className="text-xs text-red-500">失败</span>
          )}
        </div>
        {item.result && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => void handleSpeak(item.result!.translatedText)}
              className={`
                p-1 rounded-md transition-colors
                ${isSpeaking
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}
              `}
              title={isSpeaking ? '停止朗读' : '朗读译文'}
            >
              {isSpeaking ? <Square size={12} fill="currentColor" /> : <Volume2 size={14} />}
            </button>
            <button
              onClick={() => void handleFavorite()}
              className={`
                p-1 rounded-md transition-colors
                ${favorites.some((f) => f.sourceText === inputText.trim() && f.translatedText === item.result!.translatedText)
                  ? 'text-yellow-500 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'}
              `}
              title="收藏"
            >
              <Star size={14} />
            </button>
            <button
              onClick={() => void handleCopy(item.result!.translatedText)}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
              title="复制译文"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        )}
      </div>

      {item.isLoading && !item.result && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400 dark:text-gray-500">正在翻译...</span>
        </div>
      )}

      {item.error && (
        <p className="text-sm text-red-500">{item.error}</p>
      )}

      {item.result && (
        <div className="space-y-2">
          <p className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
            {item.result.translatedText}
          </p>
          {item.result.pronunciation && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">读音：</span> {item.result.pronunciation}
            </div>
          )}
          {item.result.detectedSourceLang && sourceLang === 'auto' && (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              检测到：{getLanguageLabel(item.result.detectedSourceLang)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
