import { Dropdown } from './Dropdown'
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
      {label && <span className="text-xs text-stone-500 dark:text-stone-400">{label}</span>}
      <Dropdown
        value={value}
        options={options}
        onChange={onChange}
      />
    </div>
  )
}
