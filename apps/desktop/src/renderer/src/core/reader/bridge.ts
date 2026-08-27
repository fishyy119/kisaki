/**
 * Reader window bridge.
 *
 * The reader window's IPC surface: pull the prepared bootstrap once, then
 * report position facts. Reports are fire-and-forget; the reading coordinator
 * owns what they mean and the window must never block a page turn on them.
 * Only the page-count probe answers back — a page source cannot exist
 * without it.
 */

import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import type { ComicReadingDirection } from '@shared/db/contracts/enums'
import type { ReaderBootstrap, ReaderProgressReport } from '@shared/reader'

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

export function reportProgress(report: ReaderProgressReport): void {
  void ipcManager.invoke('reader:progress', report).catch((error) => {
    log.warn('Failed to report reading progress.', error)
  })
}

export function reportUnitOpened(unitId: string): void {
  void ipcManager.invoke('reader:unit-opened', { unitId }).catch((error) => {
    log.warn('Failed to report unit switch.', error)
  })
}

/** Authoritative page count of one unit file, probed from the disk file. */
export async function fetchUnitPageCount(fileId: string): Promise<number> {
  return unwrapIpcData(await ipcManager.invoke('reader:probe-pages', fileId))
}

/** Persists the reader's page-flow choice as the comic entry override. */
export function reportPageFlow(pageFlow: ComicReadingDirection): void {
  void ipcManager.invoke('reader:set-page-flow', { pageFlow }).catch((error) => {
    log.warn('Failed to persist the page flow choice.', error)
  })
}

export function closeReaderWindow(): void {
  void ipcManager.invoke('reader:close').catch((error) => {
    log.warn('Failed to close the reader window.', error)
  })
}
