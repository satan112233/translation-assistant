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
      <div className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div
              className={`
                shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                ${isDanger ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200'}
              `}
            >
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">{title}</h3>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{message}</p>
              {detail && (
                <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{detail}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-200/70 dark:border-stone-700/60">
          <button
            onClick={onCancel}
            className="btn-ghost"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={
              isDanger
                ? 'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors'
                : 'btn-primary'
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
