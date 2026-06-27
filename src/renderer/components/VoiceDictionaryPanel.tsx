import { useEffect, useState } from 'react'
import { SpellCheck, Plus, Pencil, Search, Trash2 } from 'lucide-react'
import { useVoiceDictionaryStore } from '../stores'
import type { VoiceDictionaryEntry } from '../../shared/types'

export function VoiceDictionaryPanel() {
  const {
    voiceDictionary,
    isLoaded,
    loadVoiceDictionary,
    addVoiceDictionaryEntry,
    deleteVoiceDictionaryEntry,
    updateVoiceDictionaryEntry,
  } = useVoiceDictionaryStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [wordDraft, setWordDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')

  useEffect(() => {
    void loadVoiceDictionary()
  }, [loadVoiceDictionary])

  const filtered = voiceDictionary.filter((entry) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      entry.word.toLowerCase().includes(q) ||
      (entry.note?.toLowerCase().includes(q) ?? false)
    )
  })

  const startAdd = () => {
    setEditingId('new')
    setWordDraft('')
    setNoteDraft('')
  }

  const startEdit = (entry: VoiceDictionaryEntry) => {
    setEditingId(entry.id)
    setWordDraft(entry.word)
    setNoteDraft(entry.note || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setWordDraft('')
    setNoteDraft('')
  }

  const saveEntry = async () => {
    const word = wordDraft.trim()
    if (!word) return

    if (editingId === 'new') {
      const entry: VoiceDictionaryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        word,
        note: noteDraft.trim() || undefined,
      }
      await addVoiceDictionaryEntry(entry)
    } else if (editingId) {
      await updateVoiceDictionaryEntry(editingId, {
        word,
        note: noteDraft.trim() || undefined,
      })
    }
    cancelEdit()
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteVoiceDictionaryEntry(id)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-stone-900">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h1 className="page-title">语音词典</h1>
          <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-500 dark:text-stone-400">{voiceDictionary.length}</span>
        </div>
        <button
          onClick={startAdd}
          className="btn-primary"
          title="添加词条"
        >
          <Plus size={16} />
          新增
        </button>
      </div>

      <div className="px-6 pb-3">
        <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
          录入你常说的人名、品牌、缩写、专业术语的正确写法。语音识别后会据此纠正读音相近但拼写错误的词（需开启「口语内容优化」）。
        </p>
      </div>

      <div className="px-6 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索词条..."
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
              <label className="block text-xs text-stone-500 dark:text-stone-400 mb-1">词条（正确写法）</label>
              <textarea
                value={wordDraft}
                onChange={(e) => setWordDraft(e.target.value)}
                placeholder="如 PyTorch、K8s、李铁柱"
                rows={2}
                className="input-field py-2 resize-none"
                autoFocus
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
                disabled={!wordDraft.trim()}
                className="btn-primary h-9 text-xs"
              >
                保存
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-400 dark:text-stone-500">
            <SpellCheck size={32} className="mb-2 opacity-40" />
            <span className="text-sm">{searchQuery ? '未找到匹配项' : '暂无词条'}</span>
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
                  <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{entry.word}</p>
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
