import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { PopupPanel } from './components/PopupPanel'

const isPopup = new URLSearchParams(window.location.search).get('mode') === 'popup'

console.log('[renderer] main.tsx loaded, version:', typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown', 'mode:', isPopup ? 'popup' : 'main')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPopup ? <PopupPanel /> : <App />}
  </StrictMode>,
)

console.log('[renderer] React app rendered')
