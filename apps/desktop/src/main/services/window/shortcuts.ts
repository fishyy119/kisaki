import type { BrowserWindow } from 'electron'
import { isDev } from '@main/env'

/**
 * Applies default window keyboard policy: F12 toggles DevTools in development,
 * while production ignores page reload and DevTools shortcuts.
 */
export function watchWindowShortcuts(window: BrowserWindow): void {
  const { webContents } = window

  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') {
      return
    }

    if (!isDev) {
      if (input.code === 'KeyR' && (input.control || input.meta)) {
        event.preventDefault()
      }
      if (input.code === 'KeyI' && ((input.alt && input.meta) || (input.control && input.shift))) {
        event.preventDefault()
      }
      return
    }

    if (input.code === 'F12') {
      if (webContents.isDevToolsOpened()) {
        webContents.closeDevTools()
      } else {
        webContents.openDevTools({ mode: 'undocked' })
      }
    }
  })
}
