import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface DropdownOption<T extends string> {
  value: T
  label: string
}

interface DropdownProps<T extends string> {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  className?: string
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder = '请选择',
  className = '',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder

  useEffect(() => {
    if (!open) return

    const handleDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDocClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleSelect = (next: T) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`
          flex items-center justify-between gap-2 h-9 px-3 text-sm font-medium
          rounded-full border transition-colors outline-none
          bg-stone-100 dark:bg-stone-800
          border-transparent
          text-stone-700 dark:text-stone-200
          hover:bg-stone-200 dark:hover:bg-stone-700
          focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-100/15
        `}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={`
            shrink-0 text-stone-400 dark:text-stone-500 transition-transform
            ${open ? 'rotate-180' : ''}
          `}
        />
      </button>

      {open && (
        <div
          className={`
            absolute z-50 mt-1.5 min-w-full
            rounded-xl border shadow-lg
            bg-white dark:bg-stone-800
            border-stone-200 dark:border-stone-700
            py-1
          `}
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm
                  transition-colors
                  ${isSelected
                    ? 'text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-700'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700/50'}
                `}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && (
                  <Check size={14} className="shrink-0 text-stone-900 dark:text-stone-100" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
