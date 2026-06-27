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
    <div className="flex flex-col h-full bg-white dark:bg-stone-900">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h1 className="page-title">术语库</h1>
          <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-500 dark:text-stone-400">{glossary.length}</span>
        </div>
        <button
          onClick={startAdd}
          className="btn-primary"
          title="添加术语"
        >
          <Plus size={16} />
          新增
        </button>
      </div>

      <div className="px-6 pb-3">
        <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
          为专业术语、品牌名、行业黑话指定固定译法。翻译时会自动告知模型按你设定的译法翻译这些词，保证术语统一、贴合你的习惯。例如设定「云原生 → Cloud Native」，之后翻译相关内容都会沿用此译法。
        </p>
      </div>

      <div className="px-6 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索术语..."
            className="input-field h-9 pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-stone-400 dark:text-stone-500">加载中...</span>
          </div>
        ) : editingId === 'new' || editingId ? (
          <div className="card p-4 space-y-3">
            <div>
              <label className="block text-xs text-stone-500 dark:text-stone-400 mb-1">术语</label>
              <textarea
                value={termDraft}
                onChange={(e) => setTermDraft(e.target.value)}
                placeholder="输入术语原文"
                rows={2}
                className="input-field py-2 resize-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 dark:text-stone-400 mb-1">指定译法</label>
              <textarea
                value={translationDraft}
                onChange={(e) => setTranslationDraft(e.target.value)}
                placeholder="输入指定译法"
                rows={2}
                className="input-field py-2 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 dark:text-stone-400 mb-1">备注（可选）</label>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="添加备注说明"
                rows={3}
                className="input-field py-2 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={cancelEdit}
                className="btn-ghost h-9 text-xs"
              >
                取消
              </button>
              <button
                onClick={() => void saveEntry()}
                disabled={!termDraft.trim() || !translationDraft.trim()}
                className="btn-primary h-9 text-xs"
              >
                保存
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-400 dark:text-stone-500">
            <BookOpen size={32} className="mb-2 opacity-40" />
            <span className="text-sm">{searchQuery ? '未找到匹配项' : '暂无术语'}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="group relative p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <div className="flex items-center gap-1 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <button
                    onClick={() => startEdit(entry)}
                    className="icon-btn p-1.5"
                    title="编辑"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => void handleDelete(e, entry.id)}
                    className="p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="pr-16">
                  <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{entry.term}</p>
                  <p className="text-sm text-stone-600 dark:text-stone-400">→ {entry.translation}</p>
                  {entry.note && (
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{entry.note}</p>
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
