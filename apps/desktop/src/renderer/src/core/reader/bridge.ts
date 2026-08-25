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
