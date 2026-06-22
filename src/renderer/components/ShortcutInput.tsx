import { useState, useRef, useCallback } from 'react'
import { RotateCcw, X } from 'lucide-react'

interface ShortcutInputProps {
  value: string
  onChange: (shortcut: string) => void
  defaultValue: string
  label: string
  placeholder?: string
}

const MODIFIER_KEYS = new Set([
  'Control',
  'Meta',
  'Alt',
  'Shift',
  'CapsLock',
  'Tab',
  'Escape',
  'Enter',
])

function eventToAccelerator(e: React.KeyboardEvent<HTMLInputElement>): string | null {
  // Ignore pure modifier presses and navigation keys
  if (MODIFIER_KEYS.has(e.key)) {
    return null
  }

  const modifiers: string[] = []

  if (e.ctrlKey || e.metaKey) {
    modifiers.push('CommandOrControl')
  }
  if (e.altKey) {
    modifiers.push('Alt')
  }
  if (e.shiftKey) {
    modifiers.push('Shift')
  }

  // Require at least one modifier for global shortcuts
  if (modifiers.length === 0) {
    return null
  }

  let key = e.key

  // Normalize special keys to Electron accelerator names
  if (key === ' ') {
    key = 'Space'
  } else if (key.length === 1) {
    key = key.toUpperCase()
  }

  return [...modifiers, key].join('+')
}

export function ShortcutInput({
  value,
  onChange,
  defaultValue,
  label,
  placeholder = '点击此处并按快捷键组合',
}: ShortcutInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setIsRecording(false)
        inputRef.current?.blur()
        return
      }

      const accelerator = eventToAccelerator(e)
      if (accelerator) {
        onChange(accelerator)
        setIsRecording(false)
        inputRef.current?.blur()
      }
    },
    [onChange]
  )

  const displayValue = value || placeholder

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            readOnly
            value={displayValue}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsRecording(true)}
            onBlur={() => setIsRecording(false)}
            className={`
              w-full h-10 px-3 text-sm rounded-md border outline-none transition-colors
              ${isRecording
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'}
              ${!value ? 'text-gray-400 dark:text-gray-500' : ''}
            `}
          />
          {isRecording && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 animate-pulse">
              等待按键
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
          title="恢复默认"
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
        >
          <RotateCcw size={16} />
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="清除"
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {isRecording ? '按下快捷键组合（如 Ctrl+Shift+T），按 Esc 取消' : '点击输入框后按下新的快捷键组合'}
      </p>
    </div>
  )
}
