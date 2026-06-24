import { X, Check } from 'lucide-react'
import { useRecordingStore } from '../stores'
import { SoundWave } from './SoundWave'

export function RecordingPanel() {
  const { isRecording, isTranscribing, recordingDuration, audioLevel, stopRecording, cancelRecording } = useRecordingStore()

  if (!isRecording && !isTranscribing) return null

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700">
        {isRecording ? (
          <>
            <button
              onClick={() => cancelRecording()}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              title="取消录音"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center gap-1 min-w-[120px]">
              <SoundWave level={audioLevel} />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                录制中 {recordingDuration}s
              </span>
            </div>

            <button
              onClick={() => stopRecording()}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              title="完成录音"
            >
              <Check size={20} />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3 px-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">识别中...</span>
          </div>
        )}
      </div>
    </div>
  )
}
