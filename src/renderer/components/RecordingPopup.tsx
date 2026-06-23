import { X, Check } from 'lucide-react'
import { useRecordingStore } from '../stores'

function SoundWave() {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] bg-blue-500 dark:bg-blue-400 rounded-full animate-sound-wave"
          style={{
            animationDelay: `${i * 0.07}s`,
            animationDuration: `${0.6 + (i % 3) * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}

export function RecordingPopup() {
  const { isRecording, isTranscribing, recordingDuration } = useRecordingStore()

  const handleStop = () => {
    window.electronAPI.stopGlobalRecording()
  }

  return (
    <div className="flex items-center justify-center w-full h-full bg-transparent select-none">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700">
        {isRecording ? (
          <>
            <button
              onClick={handleStop}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              title="取消录音"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center gap-1 min-w-[120px]">
              <SoundWave />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                录制中 {recordingDuration}s
              </span>
            </div>

            <button
              onClick={handleStop}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              title="完成录音"
            >
              <Check size={20} />
            </button>
          </>
        ) : isTranscribing ? (
          <div className="flex items-center gap-3 px-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">识别中...</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">准备就绪</span>
          </div>
        )}
      </div>
    </div>
  )
}
