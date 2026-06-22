import { useState } from 'react'
import { Star, X, Trash2, Search, Download } from 'lucide-react'
import { useFavoritesStore, useTranslationStore } from '../stores'
import { ConfirmDialog } from './ConfirmDialog'
import type { FavoriteRecord } from '../../shared/types'

interface FavoritesPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function FavoritesPanel({ isOpen, onClose }: FavoritesPanelProps) {
  const { favorites, isLoaded, deleteFavorite, updateFavoriteNote } = useFavoritesStore()
  const { loadFromHistory } = useTranslationStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  if (!isOpen) return null

  const filtered = favorites.filter((f) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      f.sourceText.toLowerCase().includes(q) ||
      f.translatedText.toLowerCase().includes(q) ||
      (f.note?.toLowerCase().includes(q) ?? false)
    )
  })

  const handleLoad = (record: FavoriteRecord) => {
    loadFromHistory(record)
    onClose()
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteFavorite(id)
  }

  const handleExport = () => {
    const lines = favorites.map((f) => {
      const note = f.note ? ` [${f.note}]` : ''
      return `${f.sourceText} => ${f.translatedText}${note}`
    })
    const text = lines.join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `翻译收藏_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const startEditNote = (record: FavoriteRecord) => {
    setEditingNoteId(record.id)
    setNoteDraft(record.note || '')
  }

  const saveNote = async (id: string) => {
    await updateFavoriteNote(id, noteDraft.trim())
    setEditingNoteId(null)
    setNoteDraft('')
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Star size={18} className="text-yellow-500" />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">收藏夹</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">({favorites.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {favorites.length > 0 && (
            <button
              onClick={handleExport}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
              title="导出收藏"
            >
              <Download size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索收藏..."
            className="w-full h-8 pl-8 pr-3 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-gray-400 dark:text-gray-500">加载中...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
            <Star size={32} className="mb-2 opacity-40" />
            <span className="text-sm">{searchQuery ? '未找到匹配项' : '暂无收藏'}</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((record) => (
              <div
                key={record.id}
                onClick={() => handleLoad(record)}
                className="group relative p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
              >
                <button
                  onClick={(e) => void handleDelete(e, record.id)}
                  className="absolute top-2 right-2 p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除收藏"
                >
                  <Trash2 size={14} />
                </button>
                <div className="flex items-center gap-2 mb-1.5 pr-8">
                  <span className="text-xs px-1.5 py-0.5 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded">
                    {getLanguageLabel(record.sourceLang)} → {getLanguageLabel(record.targetLang)}
                  </span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-100 line-clamp-2 mb-1">{record.sourceText}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-1.5">{record.translatedText}</p>
                {editingNoteId === record.id ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void saveNote(record.id)
                        } else if (e.key === 'Escape') {
                          setEditingNoteId(null)
                        }
                      }}
                      placeholder="添加备注..."
                      className="flex-1 h-7 px-2 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void saveNote(record.id)
                      }}
                      className="px-2 py-0.5 text-xs text-white bg-blue-600 rounded"
                    >
                      保存
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      startEditNote(record)
                    }}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-text"
                  >
                    {record.note || '点击添加备注...'}
                  </div>
                )}
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
