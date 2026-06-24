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
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-800 dark:text-gray-200 break-all select-text font-mono leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '已复制' : '复制错误信息'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-md transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
