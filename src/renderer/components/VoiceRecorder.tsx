import { Mic, Square } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useRecordingStore } from '../stores'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface VoiceRecorderProps {
  disabled?: boolean
}

export function VoiceRecorder({ disabled = false }: VoiceRecorderProps) {
  const { isRecording, isTranscribing, toggleRecording } = useRecordingStore()

  return (
    <div className="flex items-center gap-2">
      {isRecording && (
        <span className="text-xs text-red-500 dark:text-red-400 animate-pulse">
          录制中
        </span>
      )}
      {isTranscribing && (
        <span className="text-xs text-blue-500 dark:text-blue-400">识别中...</span>
      )}
      <button
        onClick={() => toggleRecording()}
        disabled={isTranscribing || disabled}
        className={cn(
          'p-1.5 rounded-md transition-colors disabled:opacity-50',
          isRecording
            ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
            : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
        )}
        title={isRecording ? '停止录音' : '语音输入'}
      >
        {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
      </button>
    </div>
  )
}
