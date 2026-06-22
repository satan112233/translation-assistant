import { useEffect, useState } from 'react'
import { X, Settings, Monitor, Sun, Moon, Keyboard } from 'lucide-react'
import { useSettingsStore } from '../stores'
import { PROVIDER_LABELS } from '../../main/providers'
import { LanguageSelector } from './LanguageSelector'
import { ShortcutInput } from './ShortcutInput'
import type { AppSettings } from '../../shared/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const THEME_OPTIONS = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const

const DEFAULT_SHORTCUTS = {
  toggleWindow: 'CommandOrControl+Shift+T',
  crossSelection: 'CommandOrControl+Shift+C',
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, isLoaded, saveSettings } = useSettingsStore()
  const [draft, setDraft] = useState<AppSettings | null>(null)

  useEffect(() => {
    if (isOpen && isLoaded) {
      setDraft({ ...settings })
    }
  }, [isOpen, isLoaded, settings])

  if (!isOpen || !draft) return null

  const handleSave = async () => {
    try {
      // Validate shortcut conflicts
      const shortcuts = draft.shortcuts || DEFAULT_SHORTCUTS
      if (
        shortcuts.toggleWindow &&
        shortcuts.crossSelection &&
        shortcuts.toggleWindow === shortcuts.crossSelection
      ) {
        window.alert('快捷键冲突：两个全局快捷键不能设置为相同的组合')
        return
      }

      await saveSettings(draft)
      onClose()
    } catch (err) {
      console.error('保存设置失败:', err)
      const message = err instanceof Error ? err.message : '未知错误'
      window.alert(`保存失败：${message}`)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[560px] max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-600 dark:text-gray-300" />
            <h2 className="text-base font-medium text-gray-800 dark:text-gray-100">设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">外观主题</label>
            <div className="flex gap-2">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setDraft({ ...draft, theme: value })}
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
              onChange={(lang) => setDraft({ ...draft, popupTargetLang: lang })}
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">设置划词翻译时默认使用的目标语言。</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">剪贴板监听</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">复制任意文本后自动弹出翻译窗口</p>
            </div>
            <button
              onClick={() => setDraft({ ...draft, clipboardMonitor: !draft.clipboardMonitor })}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${draft.clipboardMonitor
                  ? 'bg-blue-600'
                  : 'bg-gray-300 dark:bg-gray-600'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${draft.clipboardMonitor ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

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
                  onClick={() => setDraft({ ...draft, defaultProvider: key })}
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
                  onClick={() => setDraft({ ...draft, comparisonMode: !draft.comparisonMode })}
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
                  placeholder="输入 API Key"
                  className="w-full h-9 px-3 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Base URL</label>
                <input
                  type="text"
                  value={activeConfig.baseUrl}
                  onChange={(e) => updateProvider(activeProvider, 'baseUrl', e.target.value)}
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
                  placeholder="模型名称"
                  className="w-full h-9 px-3 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={
              draft.shortcuts?.toggleWindow &&
              draft.shortcuts?.crossSelection &&
              draft.shortcuts.toggleWindow === draft.shortcuts.crossSelection
            }
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
