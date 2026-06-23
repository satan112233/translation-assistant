import { Sidebar } from './Sidebar'
import { TranslationPanel } from './TranslationPanel'
import { SettingsPanel } from './SettingsModal'
import { HistoryPanel } from './HistoryPanel'
import { FavoritesPanel } from './FavoritesPanel'
import { GlossaryPanel } from './GlossaryPanel'
import { SpeechOptimizationPanel } from './SpeechOptimizationPanel'
import { RecordingPanel } from './RecordingPanel'
import { useEffect } from 'react'
import { useUIStore, useRecordingStore } from '../stores'

export function MainLayout() {
  const { activeView } = useUIStore()

  useEffect(() => {
    const unsubscribe = window.electronAPI.onToggleVoiceRecording(() => {
      useRecordingStore.getState().toggleRecording()
    })
    return () => unsubscribe()
  }, [])

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
        {activeView === 'translate' && <TranslationPanel />}
        {activeView === 'settings' && <SettingsPanel />}
        {activeView === 'history' && <HistoryPanel />}
        {activeView === 'favorites' && <FavoritesPanel />}
        {activeView === 'glossary' && <GlossaryPanel />}
        {activeView === 'speech-optimization' && <SpeechOptimizationPanel />}
      </div>
      <RecordingPanel />
    </div>
  )
}
