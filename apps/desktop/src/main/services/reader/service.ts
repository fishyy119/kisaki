/**
 * Reader Service
 *
 * The reading vertical's engine host, mirroring the player's seam: it owns the
 * reading engines' runtime surface — the `book://` content transport, the
 * reader windows, and the position facts they report — and republishes those
 * facts as hooks. What a position means for read state belongs to the
 * activity handlers, never here.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type {
  ReaderBootstrap,
  ReaderComicProgressReport,
  ReaderNovelProgressReport,
  ReaderUnitOpenedReport
} from '@shared/reader'
import { createReaderHooks } from './hooks'
import { registerReaderIpc } from './ipc'
import { registerBookProtocol } from './protocol'
import { ReaderWindowManager } from './windows'

const log = createLogger('Reader')

export class ReaderService implements IService<'reader'> {
  readonly id = 'reader'
  readonly deps = ['db', 'media-info', 'ipc'] as const satisfies readonly ServiceName[]
  readonly hooks = createReaderHooks()
  readonly windows = new ReaderWindowManager(this.hooks)

  async init(container: ServiceInitContainer<this>): Promise<void> {
    registerBookProtocol(container.get('db'), container.get('media-info'))
    registerReaderIpc(this, container.get('ipc'))
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.windows.dispose()
    log.info('Disposed')
  }

  requireBootstrap(windowId: number): ReaderBootstrap {
    const bootstrap = this.windows.getBootstrap(windowId)
    if (!bootstrap) {
      throw new Error(`Window ${windowId} is not a reader window.`)
    }

    return bootstrap
  }

  reportComicProgress(windowId: number, report: ReaderComicProgressReport): void {
    if (!this.windows.isReaderWindow(windowId)) return
    this.hooks.comicProgress.dispatch({ windowId, report })
  }

  reportNovelProgress(windowId: number, report: ReaderNovelProgressReport): void {
    if (!this.windows.isReaderWindow(windowId)) return
    this.hooks.novelProgress.dispatch({ windowId, report })
  }

  reportUnitOpened(windowId: number, report: ReaderUnitOpenedReport): void {
    if (!this.windows.isReaderWindow(windowId)) return
    this.hooks.unitOpened.dispatch({ windowId, report })
  }
}
