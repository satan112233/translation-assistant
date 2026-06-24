import { useEffect, useState, useRef } from 'react'
import { Settings, Monitor, Sun, Moon, Keyboard, Check, Mic, Eye, EyeOff } from 'lucide-react'
import { useSettingsStore } from '../stores'
import { PROVIDER_LABELS } from '../../main/providers'
import { LanguageSelector } from './LanguageSelector'
import { ShortcutInput } from './ShortcutInput'
import type { AppSettings } from '../../shared/types'

const THEME_OPTIONS = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const

const DEFAULT_SHORTCUTS = {
  toggleWindow: 'CommandOrControl+Alt+T',
  crossSelection: 'CommandOrControl+Alt+C',
}

export function SettingsPanel() {
  const { settings, isLoaded, saveSettings } = useSettingsStore()
  const [draft, setDraft] = useState<AppSettings | null>(null)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const [showIflytekApiKey, setShowIflytekApiKey] = useState(false)
  const [showIflytekApiSecret, setShowIflytekApiSecret] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef(draft)

  // Sync ref with the latest draft on every render so the unmount cleanup can access it
  draftRef.current = draft

  useEffect(() => {
    if (isLoaded) {
      setDraft({ ...settings })
    }
  }, [isLoaded, settings])

  // Persist any unsaved draft when the panel is unmounted
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      const currentDraft = draftRef.current
      if (currentDraft) {
        const shortcuts = currentDraft.shortcuts
        if (
          shortcuts?.toggleWindow &&
          shortcuts?.crossSelection &&
          shortcuts.toggleWindow === shortcuts.crossSelection
        ) {
          return
        }
        void saveSettings(currentDraft).catch((err) => {
          console.error('保存设置失败:', err)
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const validateShortcuts = (shortcuts: AppSettings['shortcuts']) => {
    if (
      shortcuts?.toggleWindow &&
      shortcuts?.crossSelection &&
      shortcuts.toggleWindow === shortcuts.crossSelection
    ) {
      return false
    }
    return true
  }

  const persist = async (nextSettings: AppSettings) => {
    if (!validateShortcuts(nextSettings.shortcuts)) {
      return
    }
    try {
      await saveSettings(nextSettings)
      setSavedIndicator(true)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => setSavedIndicator(false), 1500)
    } catch (err) {
      console.error('保存设置失败:', err)
    }
  }

  if (!isLoaded || !draft) return null

  const saveDraft = async () => {
    if (draft) {
      await persist(draft)
    }
  }

  const updateProvider = (provider: string, field: keyof AppSettings['providers'][string], value: string) => {
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        providers: {
          ...prev.providers,
          [provider]: {
            ...prev.providers[provider],
            [field]: value,
          },
        },
      }
    })
  }

  const activeProvider = draft.defaultProvider
  const activeConfig = draft.providers[activeProvider]
  const configuredProviders = Object.entries(draft.providers)
    .filter(([, config]) => config.apiKey.trim().length > 0)
    .map(([key]) => key)
  const canUseComparisonMode = configuredProviders.length >= 2

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-gray-600 dark:text-gray-300" />
          <h2 className="text-base font-medium text-gray-800 dark:text-gray-100">设置</h2>
        </div>
        {savedIndicator && (
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check size={14} />
            <span>已保存</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">外观主题</label>
            <div className="flex gap-2">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => {
                    const next = { ...draft, theme: value }
                    setDraft(next)
                    void persist(next)
                  }}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors
                    ${draft.theme === value
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'}
                  `}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">划词翻译默认目标语言</label>
            <LanguageSelector
              value={draft.popupTargetLang}
              onChange={(lang) => {
                const next = { ...draft, popupTargetLang: lang }
                setDraft(next)
                void persist(next)
              }}
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">设置划词翻译时默认使用的目标语言。</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Mic size={16} className="text-gray-600 dark:text-gray-300" />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">语音输入</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">在翻译输入框显示麦克风按钮，录音后自动转文字</p>
              </div>
            </div>
            <button
              onClick={() => {
                const next = { ...draft, voiceInputEnabled: !draft.voiceInputEnabled }
                setDraft(next)
                void persist(next)
              }}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${draft.voiceInputEnabled
                  ? 'bg-blue-600'
                  : 'bg-gray-300 dark:bg-gray-600'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${draft.voiceInputEnabled ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {draft.voiceInputEnabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">语音识别服务</label>
                <div className="flex gap-2">
                  {[
                    { value: 'zhipu', label: '智谱 AI', desc: '需配置智谱 API Key' },
                    { value: 'iflytek', label: '科大讯飞', desc: '需配置 AppID / APIKey / APISecret' },
                    { value: 'local', label: '本地 whisper.cpp', desc: '需本地二进制和模型' },
                    { value: 'sherpa', label: '本地 Sherpa', desc: '本地 ONNX 识别，中文效果更好' },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => {
                        const next = { ...draft, voiceInputProvider: value as 'zhipu' | 'iflytek' | 'local' | 'sherpa' }
                        setDraft(next)
                        void persist(next)
                      }}
                      className={`
                        flex-1 px-3 py-2 text-sm rounded-md border transition-colors text-left
                        ${draft.voiceInputProvider === value
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'}
                      `}
                    >
                      <span className="block font-medium">{label}</span>
                      <span className="block text-xs opacity-75 mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {draft.voiceInputProvider === 'iflytek' && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">科大讯飞配置</h3>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">AppID</label>
                    <input
                      type="text"
                      value={draft.providers.iflytek?.appId || ''}
                      onChange={(e) => updateProvider('iflytek', 'appId', e.target.value)}
                      onBlur={saveDraft}
                      placeholder="输入讯飞开放平台 AppID"
                      className="w-full h-9 px-3 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">APIKey</label>
                    <div className="relative">
                      <input
                        type={showIflytekApiKey ? 'text' : 'password'}
                        value={draft.providers.iflytek?.apiKey || ''}
                        onChange={(e) => updateProvider('iflytek', 'apiKey', e.target.value)}
                        onBlur={saveDraft}
                        placeholder="输入讯飞开放平台 APIKey"
                        className="w-full h-9 px-3 pr-9 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowIflytekApiKey((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        tabIndex={-1}
                      >
                        {showIflytekApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">APISecret</label>
                    <div className="relative">
                      <input
                        type={showIflytekApiSecret ? 'text' : 'password'}
                        value={draft.providers.iflytek?.apiSecret || ''}
                        onChange={(e) => updateProvider('iflytek', 'apiSecret', e.target.value)}
                        onBlur={saveDraft}
                        placeholder="输入讯飞开放平台 APISecret"
                        className="w-full h-9 px-3 pr-9 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowIflytekApiSecret((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        tabIndex={-1}
                      >
                        {showIflytekApiSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">口语内容优化</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    使用 DeepSeek 对口语识别结果进行润色：去除填充词和多余重复、处理改口、优化措辞，使其自然清晰流畅，同时保留表达原意
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = { ...draft, voiceInputOptimize: !draft.voiceInputOptimize }
                    setDraft(next)
                    void persist(next)
                  }}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${draft.voiceInputOptimize
                      ? 'bg-blue-600'
                      : 'bg-gray-300 dark:bg-gray-600'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${draft.voiceInputOptimize ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">语音识别语言</label>
                <LanguageSelector
                  includeAuto
                  value={draft.voiceInputLanguage}
                  onChange={(lang) => {
                    const next = { ...draft, voiceInputLanguage: lang }
                    setDraft(next)
                    void persist(next)
                  }}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  选择“自动”时由识别服务自行检测语言。
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg space-y-2.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">语音全局快捷键</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                  在翻译助手或任意外部窗口均可使用
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-300">语音输入（粘贴原文）</span>
                  <span className="px-2 py-1 text-xs rounded border bg-gray-50 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 select-none">Ctrl+Alt+V</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-300">语音编辑（改写选中文本）</span>
                  <span className="px-2 py-1 text-xs rounded border bg-gray-50 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 select-none">Ctrl+Alt+D</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-300">语音直译（说一种语言出译文）</span>
                  <span className="px-2 py-1 text-xs rounded border bg-gray-50 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 select-none">Ctrl+Alt+F</span>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-4">
            <div className="flex items-center gap-2">
              <Keyboard size={16} className="text-gray-600 dark:text-gray-300" />
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">全局快捷键</h3>
            </div>
            <ShortcutInput
              label="显示 / 隐藏主窗口"
              value={draft.shortcuts?.toggleWindow || ''}
              defaultValue={DEFAULT_SHORTCUTS.toggleWindow}
              onChange={(shortcut) =>
                setDraft((prev) => {
                  if (!prev) return prev
                  return {
                    ...prev,
                    shortcuts: {
                      ...(prev.shortcuts || DEFAULT_SHORTCUTS),
                      toggleWindow: shortcut,
                    },
                  }
                })
              }
              onBlur={saveDraft}
            />
            <ShortcutInput
              label="划词翻译"
              value={draft.shortcuts?.crossSelection || ''}
              defaultValue={DEFAULT_SHORTCUTS.crossSelection}
              onChange={(shortcut) =>
                setDraft((prev) => {
                  if (!prev) return prev
                  return {
                    ...prev,
                    shortcuts: {
                      ...(prev.shortcuts || DEFAULT_SHORTCUTS),
                      crossSelection: shortcut,
                    },
                  }
                })
              }
              onBlur={saveDraft}
            />
            {draft.shortcuts?.toggleWindow &&
              draft.shortcuts?.crossSelection &&
              draft.shortcuts.toggleWindow === draft.shortcuts.crossSelection && (
                <p className="text-xs text-red-500">两个全局快捷键不能相同</p>
              )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">默认翻译模型</label>
            <div className="flex gap-2">
              {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    const next = { ...draft, defaultProvider: key }
                    setDraft(next)
                    void persist(next)
                  }}
                  className={`
                    flex-1 px-3 py-2 text-sm rounded-md border transition-colors
                    ${draft.defaultProvider === key
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'}
                  `}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">对比翻译模式</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">同时调用多个模型展示译文对比</p>
              </div>
              {canUseComparisonMode ? (
                <button
                  onClick={() => {
                    const next = { ...draft, comparisonMode: !draft.comparisonMode }
                    setDraft(next)
                    void persist(next)
                  }}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${draft.comparisonMode
                      ? 'bg-blue-600'
                      : 'bg-gray-300 dark:bg-gray-600'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${draft.comparisonMode ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">需配置 ≥2 个模型</span>
              )}
            </div>

            {!canUseComparisonMode && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                配置至少两个模型的 API Key 后可开启对比翻译。
              </p>
            )}

            {canUseComparisonMode && draft.comparisonMode && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  注意：对比翻译模式会同时调用多个模型，消耗更多 Token。
                </p>
              </div>
            )}
          </div>

          {activeConfig && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">{PROVIDER_LABELS[activeProvider] || activeProvider} 配置</h3>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">API Key</label>
                <input
                  type="password"
                  value={activeConfig.apiKey}
                  onChange={(e) => updateProvider(activeProvider, 'apiKey', e.target.value)}
                  onBlur={saveDraft}
                  placeholder="输入 API Key"
                  className="w-full h-9 px-3 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {activeProvider === 'iflytek' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">AppID</label>
                    <input
                      type="text"
                      value={activeConfig.appId || ''}
                      onChange={(e) => updateProvider(activeProvider, 'appId', e.target.value)}
                      onBlur={saveDraft}
                      placeholder="输入 AppID"
                      className="w-full h-9 px-3 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">API Secret</label>
                    <input
                      type="password"
                      value={activeConfig.apiSecret || ''}
                      onChange={(e) => updateProvider(activeProvider, 'apiSecret', e.target.value)}
                      onBlur={saveDraft}
                      placeholder="输入 API Secret"
                      className="w-full h-9 px-3 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Base URL</label>
                <input
                  type="text"
                  value={activeConfig.baseUrl}
                  onChange={(e) => updateProvider(activeProvider, 'baseUrl', e.target.value)}
                  onBlur={saveDraft}
                  placeholder="https://api.example.com/v1"
                  className="w-full h-9 px-3 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">模型</label>
                <input
                  type="text"
                  value={activeConfig.model}
                  onChange={(e) => updateProvider(activeProvider, 'model', e.target.value)}
                  onBlur={saveDraft}
                  placeholder="模型名称"
                  className="w-full h-9 px-3 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
  )
}
