import { useEffect, useState } from 'react'
import { useUIStore, type DrawerView } from '../stores'
import { HistoryPanel } from './HistoryPanel'
import { FavoritesPanel } from './FavoritesPanel'
import { SpeechOptimizationPanel } from './SpeechOptimizationPanel'

const ANIM_MS = 300

/**
 * Right-side slide-over that hosts the "records" panels (history, favorites,
 * speech optimization) opened from the title-bar toolbar. These are review-only
 * views, so they overlay the workspace instead of replacing it — closing the
 * drawer returns the user to exactly where they were.
 */
export function Drawer() {
  const { openDrawer, setOpenDrawer } = useUIStore()
  const close = () => setOpenDrawer(null)

  // mounted: kept in the DOM through the exit transition.
  // visible: drives the slide-in / slide-out.
  // view: retained during exit so the panel doesn't blank before sliding away.
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [view, setView] = useState<DrawerView | null>(null)

  useEffect(() => {
    if (openDrawer) {
      setView(openDrawer)
      setMounted(true)
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), ANIM_MS)
    return () => clearTimeout(t)
  }, [openDrawer])

  useEffect(() => {
    if (!openDrawer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openDrawer])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={close}
      />
      <div
        className={`absolute top-0 right-0 h-full w-[420px] max-w-[85vw] bg-white dark:bg-gray-800 shadow-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {view === 'history' && <HistoryPanel onClose={close} />}
        {view === 'favorites' && <FavoritesPanel onClose={close} />}
        {view === 'speech-optimization' && <SpeechOptimizationPanel onClose={close} />}
      </div>
    </div>
  )
}
