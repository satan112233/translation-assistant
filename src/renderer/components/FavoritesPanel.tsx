import { useState } from 'react'
import { Star, Trash2, Search, Download, X } from 'lucide-react'
import { useFavoritesStore, useTranslationStore, useUIStore } from '../stores'
import type { FavoriteRecord } from '../../shared/types'

export function FavoritesPanel({ onClose }: { onClose?: () => void }) {
  const { favorites, isLoaded, deleteFavorite, updateFavoriteNote } = useFavoritesStore()
  const { loadFromHistory } = useTranslationStore()
  const { setActiveView } = useUIStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

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
    setActiveView('translate')
    onClose?.()
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
    <div className="flex flex-col h-full bg-white dark:bg-stone-900">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">收藏夹</h2>
          <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-500 dark:text-stone-400">{favorites.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {favorites.length > 0 && (
            <button
              onClick={handleExport}
              className="icon-btn"
              title="导出收藏"
            >
              <Download size={16} />
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

      <div className="px-5 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索收藏..."
            className="input-field h-9 pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-stone-400 dark:text-stone-500">加载中...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-400 dark:text-stone-500">
            <Star size={32} className="mb-2 opacity-40" />
            <span className="text-sm">{searchQuery ? '未找到匹配项' : '暂无收藏'}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((record) => (
              <div
                key={record.id}
                onClick={() => handleLoad(record)}
                className="group relative p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <button
                  onClick={(e) => void handleDelete(e, record.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除收藏"
                >
                  <Trash2 size={14} />
                </button>
                <div className="flex items-center gap-2 mb-1.5 pr-8">
                  <span className="text-xs px-2 py-0.5 bg-stone-200/70 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-full">
                    {getLanguageLabel(record.sourceLang)} → {getLanguageLabel(record.targetLang)}
                  </span>
                </div>
                <p className="text-sm text-stone-800 dark:text-stone-100 line-clamp-2 mb-1">{record.sourceText}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 mb-1.5">{record.translatedText}</p>
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
                      className="input-field flex-1 h-7 text-xs"
                      autoFocus
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void saveNote(record.id)
                      }}
                      className="btn-primary px-3 py-0.5 text-xs"
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
                    className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 cursor-text"
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
