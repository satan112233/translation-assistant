import { AlertTriangle, X } from 'lucide-react'

export interface ConfirmDialogOptions {
  title: string
  message: string
  detail?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  detail,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const isDanger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div
              className={`
                shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                ${isDanger ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}
              `}
            >
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">{title}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{message}</p>
              {detail && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`
              px-4 py-2 text-sm text-white rounded-md transition-colors
              ${isDanger
                ? 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500'
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500'}
            `}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
