/// <reference types="vite/client" />

import type { ElectronAPI } from '../preload'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }

  const __APP_VERSION__: string
}

export {}
