/**
 * Reader window bridge.
 *
 * The reader window's IPC surface: pull the prepared bootstrap once, then
 * report position facts. Reports are fire-and-forget; the activity handlers
 * own what they mean and the window must never block a page turn on them.
 */

import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import type {
  ReaderBootstrap,
  ReaderComicProgressReport,
  ReaderNovelProgressReport
} from '@shared/reader'

const log = createLogger('Reader')

export async function fetchReaderBootstrap(): Promise<ReaderBootstrap> {
  return unwrapIpcData(await ipcManager.invoke('reader:bootstrap'))
}

/**
 * Subscribes to re-aim pushes: reading an entry that already has a window
 * refocuses it and sends the freshly resolved bootstrap here.
 * @returns Unsubscribe function.
 */
export function onReaderNavigate(handler: (bootstrap: ReaderBootstrap) => void): () => void {
  return ipcManager.on('reader:navigate', (_event, bootstrap) => {
    handler(bootstrap)
  })
}

/**
 * Subscribes to the window's real full-screen state. The platform may enter or
 * leave full screen on its own, so this push is the only truth the reader
 * follows.
 * @returns Unsubscribe function.
 */
export function onReaderFullScreenChanged(handler: (fullScreen: boolean) => void): () => void {
  return ipcManager.on('reader:fullscreen-changed', (_event, fullScreen) => {
    handler(fullScreen)
  })
}

export function setReaderFullScreen(fullScreen: boolean): void {
  void ipcManager.invoke('reader:set-fullscreen', fullScreen).catch((error) => {
    log.warn('Failed to change the reader window full-screen state.', error)
  })
}

export function reportComicProgress(report: ReaderComicProgressReport): void {
  void ipcManager.invoke('reader:comic-progress', report).catch((error) => {
    log.warn('Failed to report comic progress.', error)
  })
}

export function reportNovelProgress(report: ReaderNovelProgressReport): void {
  void ipcManager.invoke('reader:novel-progress', report).catch((error) => {
    log.warn('Failed to report novel progress.', error)
  })
}

export function reportUnitOpened(unitId: string): void {
  void ipcManager.invoke('reader:unit-opened', { unitId }).catch((error) => {
    log.warn('Failed to report unit switch.', error)
  })
}

export function closeReaderWindow(): void {
  void ipcManager.invoke('reader:close').catch((error) => {
    log.warn('Failed to close the reader window.', error)
  })
}
