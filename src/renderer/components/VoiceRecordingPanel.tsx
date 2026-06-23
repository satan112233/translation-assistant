import { useEffect, useRef } from 'react'
import { useRecordingStore, useSettingsStore } from '../stores'

export function VoiceRecordingPanel() {
  const { settings } = useSettingsStore()
  const { toggleRecording, startRecording, stopRecording, cancelRecording, isRecording, isTranscribing, recordingDuration, transcribedText, setTranscribedText } =
    useRecordingStore()

  const isRecordingRef = useRef(isRecording)
  const isTranscribingRef = useRef(isTranscribing)
  const settingsRef = useRef(settings)

  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  useEffect(() => {
    isTranscribingRef.current = isTranscribing
  }, [isTranscribing])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // Listen for global recording commands from main process
  useEffect(() => {
    console.log('[voice] registering global recording listeners')
    const unsubscribeStart = window.electronAPI.onStartGlobalRecording(() => {
      console.log('[voice] received start-global-recording, isRecording:', isRecordingRef.current)
      if (!isRecordingRef.current && !isTranscribingRef.current) {
        void startRecording(settingsRef.current.voiceInputLanguage)
      }
    })

    const unsubscribeStop = window.electronAPI.onStopGlobalRecording(() => {
      console.log('[voice] received stop-global-recording, isRecording:', isRecordingRef.current)
      if (isRecordingRef.current) {
        stopRecording()
      }
    })

    const unsubscribeCancel = window.electronAPI.onCancelGlobalRecording(() => {
      console.log('[voice] received cancel-global-recording, isRecording:', isRecordingRef.current)
      if (isRecordingRef.current) {
        cancelRecording()
      }
    })

    return () => {
      console.log('[voice] unregistering global recording listeners')
      unsubscribeStart()
      unsubscribeStop()
      unsubscribeCancel()
    }
  }, [startRecording, stopRecording, cancelRecording])

  // Send recording state updates to the recording popup window
  useEffect(() => {
    const state = { isRecording, isTranscribing, recordingDuration }
    console.log('[voice] sending recording state:', state)
    window.electronAPI.sendRecordingState(state)
  }, [isRecording, isTranscribing, recordingDuration])

  // Send transcription result back to main process when ready
  useEffect(() => {
    if (transcribedText !== null && !isRecording && !isTranscribing) {
      console.log('[voice] sending global voice result:', transcribedText.slice(0, 50))
      window.electronAPI.sendGlobalVoiceResult(transcribedText)
      setTranscribedText(null)
    }
  }, [transcribedText, isRecording, isTranscribing, setTranscribedText])

  return null
}
