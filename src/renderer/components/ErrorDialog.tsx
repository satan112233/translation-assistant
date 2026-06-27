import { AlertTriangle, X, Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface ErrorDialogProps {
  isOpen: boolean
  title?: string
  message: string
  onClose: () => void
}

export function ErrorDialog({ isOpen, title = '出错了', message, onClose }: ErrorDialogProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/70 dark:border-stone-700/60">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
            <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="icon-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="bg-stone-100 dark:bg-stone-800 rounded-xl p-3 border border-stone-200 dark:border-stone-700">
            <p className="text-sm text-stone-800 dark:text-stone-200 break-all select-text font-mono leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-200/70 dark:border-stone-700/60">
          <button
            onClick={handleCopy}
            className="btn-ghost"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '已复制' : '复制错误信息'}
          </button>
          <button
            onClick={onClose}
            className="btn-primary"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
