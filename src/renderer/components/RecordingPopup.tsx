import { useEffect, useState } from 'react'
import { X, Check } from 'lucide-react'
import type { RecordingPopupState } from '../../shared/types'
import { SoundWave } from './SoundWave'

const PILL_CLASS =
  'flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700'

export function RecordingPopup() {
  const [state, setState] = useState<RecordingPopupState>({
    isRecording: false,
    isTranscribing: false,
    recordingDuration: 0,
  })
  const [hasState, setHasState] = useState(false)

  useEffect(() => {
    console.log('[recording-popup] registering state listener')
    const unsubscribe = window.electronAPI.onRecordingPopupState((newState) => {
      console.log('[recording-popup] received state:', newState)
      setState(newState)
      setHasState(true)
    })
    window.electronAPI.recordingPopupReady()
    return unsubscribe
  }, [])

  const handleStop = () => {
    window.electronAPI.stopGlobalRecording()
  }

  const handleCancel = () => {
    window.electronAPI.cancelGlobalVoice()
  }

  const modeLabel =
    state.mode === 'edit' ? '语音编辑' : state.mode === 'translate' ? '语音直译' : null

  return (
    <div className="flex items-center justify-center w-full h-full bg-transparent">
      {!hasState ? (
        <div className={PILL_CLASS}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">正在启动...</span>
          </div>
        </div>
      ) : state.isRecording ? (
        <div className={PILL_CLASS}>
          <button
            onClick={handleCancel}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            title="取消录音"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center gap-1 min-w-[120px] max-w-[180px]">
            {modeLabel && (
              <span className="text-xs font-medium text-blue-500 dark:text-blue-400">{modeLabel}</span>
            )}
            <SoundWave level={state.audioLevel ?? 0} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              录制中 {state.recordingDuration}s
            </span>
            {state.mode === 'edit' && state.editPreview && (
              <span
                className="max-w-full truncate text-[11px] text-gray-400 dark:text-gray-500"
                title={state.editPreview}
              >
                编辑：{state.editPreview}
              </span>
            )}
          </div>

          <button
            onClick={handleStop}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            title="完成录音"
          >
            <Check size={20} />
          </button>
        </div>
      ) : (
        <div className={PILL_CLASS}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {state.processingLabel ?? (state.isTranscribing ? '识别中...' : '处理中...')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
