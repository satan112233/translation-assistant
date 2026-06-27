import { Mic, Square, Loader2 } from 'lucide-react'
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
    <button
      onClick={() => toggleRecording()}
      disabled={isTranscribing || disabled}
      className={cn(
        'p-1.5 rounded-full transition-colors disabled:opacity-50',
        isRecording
          ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
          : 'text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
      )}
      title={isRecording ? '停止录音' : isTranscribing ? '识别中...' : '语音输入'}
    >
      {isTranscribing ? (
        <Loader2 size={16} className="animate-spin text-stone-500 dark:text-stone-400" />
      ) : isRecording ? (
        <Square size={16} fill="currentColor" />
      ) : (
        <Mic size={16} />
      )}
    </button>
  )
}
