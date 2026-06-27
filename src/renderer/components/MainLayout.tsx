import { Sidebar } from './Sidebar'
import { TranslationPanel } from './TranslationPanel'
import { SettingsPanel } from './SettingsModal'
import { GlossaryPanel } from './GlossaryPanel'
import { VoiceDictionaryPanel } from './VoiceDictionaryPanel'
import { RecordingPanel } from './RecordingPanel'
import { Drawer } from './Drawer'
import { ErrorDialog } from './ErrorDialog'
import { useEffect } from 'react'
import { useUIStore, useRecordingStore } from '../stores'

export function MainLayout() {
  const { activeView } = useUIStore()
  const { transcriptionError, clearTranscriptionError } = useRecordingStore()

  useEffect(() => {
    const unsubscribe = window.electronAPI.onToggleVoiceRecording(() => {
      useRecordingStore.getState().toggleRecording()
    })
    return () => unsubscribe()
  }, [])

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-stone-900">
        {activeView === 'translate' && <TranslationPanel />}
        {activeView === 'settings' && <SettingsPanel />}
        {activeView === 'glossary' && <GlossaryPanel />}
        {activeView === 'voice-dictionary' && <VoiceDictionaryPanel />}
      </div>
      <RecordingPanel />
      <Drawer />
      <ErrorDialog
        isOpen={!!transcriptionError}
        message={transcriptionError || ''}
        onClose={clearTranscriptionError}
      />
    </div>
  )
}
