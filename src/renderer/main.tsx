import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { PopupPanel } from './components/PopupPanel'
import { VoiceRecordingPanel } from './components/VoiceRecordingPanel'
import { RecordingPopup } from './components/RecordingPopup'

const params = new URLSearchParams(window.location.search)
const mode = params.get('mode')
const isPopup = mode === 'popup'
const isVoice = mode === 'voice'
const isRecordingPopup = mode === 'recording-popup'

if (isRecordingPopup) {
  document.documentElement.classList.add('recording-popup')
}

console.log('[renderer] main.tsx loaded, version:', typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown', 'mode:', mode || 'main')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPopup ? (
      <PopupPanel />
    ) : isVoice ? (
      <VoiceRecordingPanel />
    ) : isRecordingPopup ? (
      <RecordingPopup />
    ) : (
      <App />
    )}
  </StrictMode>,
)

console.log('[renderer] React app rendered')
