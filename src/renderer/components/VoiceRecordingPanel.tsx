import { useEffect } from 'react'
import { useRecordingStore, useSettingsStore } from '../stores'

export function VoiceRecordingPanel() {
  const { settings } = useSettingsStore()
  const { toggleRecording, startRecording, stopRecording, isRecording, isTranscribing, transcribedText, setTranscribedText } =
    useRecordingStore()

  // Listen for global recording commands from main process
  useEffect(() => {
    const unsubscribeStart = window.electronAPI.onStartGlobalRecording(() => {
      if (!isRecording && !isTranscribing) {
        void startRecording(settings.voiceInputLanguage)
      }
    })

    const unsubscribeStop = window.electronAPI.onStopGlobalRecording(() => {
      if (isRecording) {
        stopRecording()
      }
    })

    return () => {
      unsubscribeStart()
      unsubscribeStop()
    }
  }, [isRecording, isTranscribing, startRecording, stopRecording, settings.voiceInputLanguage])

  // Send transcription result back to main process when ready
  useEffect(() => {
    if (transcribedText !== null && !isRecording && !isTranscribing) {
      window.electronAPI.sendGlobalVoiceResult(transcribedText)
      setTranscribedText(null)
    }
  }, [transcribedText, isRecording, isTranscribing, setTranscribedText])

  return null
}
