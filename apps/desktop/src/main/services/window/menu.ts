import { Menu } from 'electron'
import { isMacOS } from '@main/env'

/**
 * The app draws its own window chrome and owns every shortcut it offers, so
 * Electron's default application menu is not installed: it would expose zoom,
 * reload, DevTools, and full-screen accelerators nobody owns, and Chromium
 * persists an accidental zoom level across launches. macOS keeps the app and
 * edit roles because quit and clipboard shortcuts route through the
 * application menu there.
 */
export function installApplicationMenu(): void {
  if (!isMacOS) {
    Menu.setApplicationMenu(null)
    return
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]))
}
