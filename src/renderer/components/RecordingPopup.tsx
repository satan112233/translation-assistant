import { useEffect, useState } from 'react'
import { X, Check, Mic } from 'lucide-react'
import type { RecordingPopupState } from '../../shared/types'

// Per-bar height profile; multiplied by the live mic level so bars stay flat
// on silence and rise with the user's voice.
const WAVE_WEIGHTS = [0.35, 0.5, 0.65, 0.8, 0.7, 0.9, 1, 0.85, 0.85, 1, 0.9, 0.7, 0.8, 0.65, 0.5, 0.35]

function SoundWave({ level }: { level: number }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {WAVE_WEIGHTS.map((weight, i) => {
        const height = 3 + 25 * Math.min(1, Math.max(0, level)) * weight
        return (
          <div
            key={i}
            className="w-[3px] bg-blue-500 dark:bg-blue-400 rounded-full transition-[height] duration-75 ease-out"
            style={{ height: `${height}px` }}
          />
        )
      })}
    </div>
  )
}

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
    state.mode === 'edit' ? '语音编辑' : state.mode === 'translate' ? '语音直译' : '语音输入'

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 app-drag-region">
        <div className="flex items-center gap-2">
          <Mic size={14} className="text-blue-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{modeLabel}</span>
        </div>
        <button
          onClick={handleCancel}
          className="p-1 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="取消录音"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {state.mode === 'edit' && state.editPreview && (
          <div className="w-full mb-3 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded truncate" title={state.editPreview}>
            编辑：{state.editPreview}
          </div>
        )}
        {!hasState ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">正在启动...</span>
          </div>
        ) : state.isRecording ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <SoundWave level={state.audioLevel ?? 0} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              录制中 {state.recordingDuration}s
            </span>
            <div className="flex items-center gap-3 w-full mt-1">
              <button
                onClick={handleCancel}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              >
                <X size={12} />
                取消
              </button>
              <button
                onClick={handleStop}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
              >
                <Check size={12} />
                完成
              </button>
            </div>
          </div>
        ) : state.isTranscribing ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">识别中...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">处理中...</span>
          </div>
        )}
      </div>
    </div>
  )
}
