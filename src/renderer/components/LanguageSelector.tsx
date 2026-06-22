import type { LanguageCode } from '../../shared/types'

interface LanguageSelectorProps {
  value: 'auto' | LanguageCode
  onChange: (value: 'auto' | LanguageCode) => void
  includeAuto?: boolean
  label?: string
}

const OPTIONS: { value: 'auto' | LanguageCode; label: string }[] = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
]

export function LanguageSelector({ value, onChange, includeAuto = false, label }: LanguageSelectorProps) {
  const options = includeAuto ? OPTIONS : OPTIONS.filter((o) => o.value !== 'auto')

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'auto' | LanguageCode)}
        className="h-8 px-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
