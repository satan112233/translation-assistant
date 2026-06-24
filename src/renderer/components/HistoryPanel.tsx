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
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <History size={18} className="text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">翻译历史</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">({history.length}/{MAX_HISTORY_COUNT})</span>
        </div>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              title="清空历史"
            >
              <Trash2 size={16} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
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

      <div className="flex-1 overflow-y-auto">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-gray-400 dark:text-gray-500">加载中...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
            <History size={32} className="mb-2 opacity-40" />
            <span className="text-sm">暂无翻译历史</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {history.map((record) => (
              <div
                key={record.id}
                onClick={() => handleRecordClick(record)}
                className="group relative p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
              >
                <button
                  onClick={(e) => void handleDelete(e, record.id)}
                  className="absolute top-2 right-2 p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除此记录"
                >
                  <Trash2 size={14} />
                </button>
                <div className="flex items-center gap-2 mb-1.5 pr-8">
                  <span className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                    {getLanguageLabel(record.sourceLang)} → {getLanguageLabel(record.targetLang)}
                  </span>
                  {record.detectedSourceLang && record.sourceLang === 'auto' && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      检测为 {getLanguageLabel(record.detectedSourceLang)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-100 line-clamp-2 mb-1">{record.sourceText}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-1.5">{record.translatedText}</p>
                <div className="flex items-center text-xs text-gray-400 dark:text-gray-500">
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
