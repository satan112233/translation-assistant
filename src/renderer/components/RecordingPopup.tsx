import { useRecordingStore } from '../stores'

function SoundWave() {
  return (
    <div className="flex items-center justify-center gap-[2px] h-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="w-[2px] bg-blue-500 dark:bg-blue-400 rounded-full animate-sound-wave"
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

  return (
    <div className="flex items-center justify-center w-full h-full bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 select-none">
      {isRecording ? (
        <div className="flex items-center gap-3 px-4">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <SoundWave />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 tabular-nums">
            {recordingDuration}s
          </span>
        </div>
      ) : isTranscribing ? (
        <div className="flex items-center gap-2 px-4">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600 dark:text-gray-300">识别中...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-600 dark:text-gray-300">准备就绪</span>
        </div>
      )}
    </div>
  )
}
