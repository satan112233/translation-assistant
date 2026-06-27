import { useState } from 'react'
import { History, Trash2, Clock, X } from 'lucide-react'
import { useHistoryStore, useTranslationStore, useUIStore } from '../stores'
import { ConfirmDialog } from './ConfirmDialog'
import { MAX_HISTORY_COUNT } from '../../shared/types'
import type { HistoryRecord } from '../../shared/types'

export function HistoryPanel({ onClose }: { onClose?: () => void }) {
  const { history, isLoaded, clearHistory, deleteHistoryItem } = useHistoryStore()
  const { loadFromHistory } = useTranslationStore()
  const { setActiveView } = useUIStore()
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleRecordClick = (record: HistoryRecord) => {
    loadFromHistory(record)
    setActiveView('translate')
    onClose?.()
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteHistoryItem(id)
  }

  const handleClear = async () => {
    setShowClearConfirm(false)
    await clearHistory()
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-stone-900">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">翻译历史</h2>
          <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-500 dark:text-stone-400">{history.length}/{MAX_HISTORY_COUNT}</span>
        </div>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-2 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="清空历史"
            >
              <Trash2 size={16} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="icon-btn"
              title="关闭"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="清空翻译历史"
        message="确定要清空全部翻译历史吗？"
        detail="此操作不可恢复。"
        confirmText="清空"
        cancelText="取消"
        variant="danger"
        onConfirm={() => void handleClear()}
        onCancel={() => setShowClearConfirm(false)}
      />

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-stone-400 dark:text-stone-500">加载中...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-400 dark:text-stone-500">
            <History size={32} className="mb-2 opacity-40" />
            <span className="text-sm">暂无翻译历史</span>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((record) => (
              <div
                key={record.id}
                onClick={() => handleRecordClick(record)}
                className="group relative p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <button
                  onClick={(e) => void handleDelete(e, record.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除此记录"
                >
                  <Trash2 size={14} />
                </button>
                <div className="flex items-center gap-2 mb-1.5 pr-8">
                  <span className="text-xs px-2 py-0.5 bg-stone-200/70 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-full">
                    {getLanguageLabel(record.sourceLang)} → {getLanguageLabel(record.targetLang)}
                  </span>
                  {record.detectedSourceLang && record.sourceLang === 'auto' && (
                    <span className="text-xs text-stone-400 dark:text-stone-500">
                      检测为 {getLanguageLabel(record.detectedSourceLang)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-800 dark:text-stone-100 line-clamp-2 mb-1">{record.sourceText}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 mb-1.5">{record.translatedText}</p>
                <div className="flex items-center text-xs text-stone-400 dark:text-stone-500">
                  <Clock size={12} className="mr-1" />
                  {formatTime(record.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getLanguageLabel(code: string): string {
  const labels: Record<string, string> = {
    auto: '自动',
    zh: '中文',
    en: '英语',
    ja: '日语',
  }
  return labels[code] || code
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
