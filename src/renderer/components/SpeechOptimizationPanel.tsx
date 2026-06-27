import { useEffect, useState } from 'react'
import { Sparkles, Trash2, Clock, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useSpeechOptimizationStore, useTranslationStore, useUIStore } from '../stores'
import { ConfirmDialog } from './ConfirmDialog'
import { MAX_SPEECH_OPTIMIZATION_COUNT } from '../../shared/types'
import type { SpeechOptimizationRecord } from '../../shared/types'

export function SpeechOptimizationPanel({ onClose }: { onClose?: () => void }) {
  const { records, isLoaded, clearRecords, deleteRecord } = useSpeechOptimizationStore()
  const { setInputText } = useTranslationStore()
  const { setActiveView } = useUIStore()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    void useSpeechOptimizationStore.getState().loadRecords()
  }, [])

  const handleRecordClick = (record: SpeechOptimizationRecord) => {
    setInputText(record.optimizedText)
    setActiveView('translate')
    onClose?.()
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteRecord(id)
  }

  const handleClear = async () => {
    setShowClearConfirm(false)
    await clearRecords()
  }

  const toggleExpanded = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-stone-900">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">语音优化记录</h2>
          <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-500 dark:text-stone-400">
            {records.length}/{MAX_SPEECH_OPTIMIZATION_COUNT}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {records.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-2 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="清空记录"
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
        title="清空语音优化记录"
        message="确定要清空全部语音优化记录吗？"
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
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-400 dark:text-stone-500">
            <Sparkles size={32} className="mb-2 opacity-40" />
            <span className="text-sm">暂无语音优化记录</span>
            <span className="text-xs mt-1">开启口语内容优化后录音即可生成记录</span>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((record) => {
              const isExpanded = expandedIds.has(record.id)
              return (
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

                  <div className="mb-1.5 pr-8">
                    <span className="text-xs px-2 py-0.5 bg-stone-200/70 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-full">
                      优化后
                    </span>
                  </div>
                  <p className="text-sm text-stone-800 dark:text-stone-100 line-clamp-2 mb-2">{record.optimizedText}</p>

                  <button
                    onClick={(e) => toggleExpanded(e, record.id)}
                    className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 mb-2"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span>{isExpanded ? '收起原始识别文本' : '查看原始识别文本'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mb-2 p-3 bg-stone-100 dark:bg-stone-800 rounded-xl">
                      <span className="text-xs text-stone-400 dark:text-stone-500">原始识别：</span>
                      <p className="text-sm text-stone-600 dark:text-stone-300 mt-0.5">{record.rawText}</p>
                    </div>
                  )}

                  <div className="flex items-center text-xs text-stone-400 dark:text-stone-500">
                    <Clock size={12} className="mr-1" />
                    {formatTime(record.timestamp)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
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
