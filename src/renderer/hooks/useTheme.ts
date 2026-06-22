import { useEffect } from 'react'
import type { AppSettings } from '../../shared/types'

/**
 * Applies the given theme by toggling the `dark` class on <html>.
 * In `system` mode it follows the OS color-scheme and updates live when it changes.
 * Used by both the main window (App) and the cross-selection popup (PopupPanel).
 */
export function useTheme(theme: AppSettings['theme'], enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    const applyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
      document.documentElement.classList.toggle('dark', isDark)
    }

    applyTheme()

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      media.addEventListener('change', applyTheme)
      return () => media.removeEventListener('change', applyTheme)
    }
  }, [theme, enabled])
}
