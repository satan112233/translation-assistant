import { useEffect, useState } from 'react'
import { BookOpen, Plus, Pencil, Search, Trash2 } from 'lucide-react'
import { useGlossaryStore } from '../stores'
import type { GlossaryEntry } from '../../shared/types'

export function GlossaryPanel() {
  const { glossary, isLoaded, loadGlossary, addGlossaryEntry, deleteGlossaryEntry, updateGlossaryEntry } = useGlossaryStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [termDraft, setTermDraft] = useState('')
  const [translationDraft, setTranslationDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')

  useEffect(() => {
    void loadGlossary()
  }, [loadGlossary])

  const filtered = glossary.filter((entry) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      entry.term.toLowerCase().includes(q) ||
      entry.translation.toLowerCase().includes(q) ||
      (entry.note?.toLowerCase().includes(q) ?? false)
    )
  })

  const startAdd = () => {
    setEditingId('new')
    setTermDraft('')
    setTranslationDraft('')
    setNoteDraft('')
  }

  const startEdit = (entry: GlossaryEntry) => {
    setEditingId(entry.id)
    setTermDraft(entry.term)
    setTranslationDraft(entry.translation)
    setNoteDraft(entry.note || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setTermDraft('')
    setTranslationDraft('')
    setNoteDraft('')
  }

  const saveEntry = async () => {
    const term = termDraft.trim()
    const translation = translationDraft.trim()
    if (!term || !translation) return

    if (editingId === 'new') {
      const entry: GlossaryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        term,
        translation,
        note: noteDraft.trim() || undefined,
      }
      await addGlossaryEntry(entry)
    } else if (editingId) {
      await updateGlossaryEntry(editingId, {
        term,
        translation,
        note: noteDraft.trim() || undefined,
      })
    }
    cancelEdit()
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteGlossaryEntry(id)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">术语库</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">({glossary.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={startAdd}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
            title="添加术语"
          >
            <Plus size={16} />
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
            placeholder="搜索术语..."
            className="w-full h-8 pl-8 pr-3 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-gray-400 dark:text-gray-500">加载中...</span>
          </div>
        ) : editingId === 'new' || editingId ? (
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">术语</label>
              <input
                type="text"
                value={termDraft}
                onChange={(e) => setTermDraft(e.target.value)}
                placeholder="输入术语原文"
                className="w-full h-8 px-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">指定译法</label>
              <input
                type="text"
                value={translationDraft}
                onChange={(e) => setTranslationDraft(e.target.value)}
                placeholder="输入指定译法"
                className="w-full h-8 px-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">备注（可选）</label>
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="添加备注说明"
                className="w-full h-8 px-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveEntry()}
                disabled={!termDraft.trim() || !translationDraft.trim()}
                className="flex-1 h-8 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              >
                保存
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 h-8 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
            <BookOpen size={32} className="mb-2 opacity-40" />
            <span className="text-sm">{searchQuery ? '未找到匹配项' : '暂无术语'}</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="group relative p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-1 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <button
                    onClick={() => startEdit(entry)}
                    className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="编辑"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => void handleDelete(e, entry.id)}
                    className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="pr-16">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{entry.term}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">→ {entry.translation}</p>
                  {entry.note && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{entry.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
