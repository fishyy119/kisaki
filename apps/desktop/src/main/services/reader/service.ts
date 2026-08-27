/**
 * Reader Service
 *
 * The reading vertical's engine host, mirroring the video service's seam: it
 * owns the reading engines' runtime surface — container parsing and page access
 * (`books`), the `book://` content transport, the reader windows, and the
 * position facts they report — and republishes those facts as hooks. What a
 * position means for read state belongs to the reading coordinator, never
 * here, and which rows own reading files belongs to holdings, which registers
 * the transport's file resolver.
 */

import { createLogger } from '@main/log'
import type { INonDomainService, ServiceInitContainer } from '@main/container'
import type {
  ReaderBootstrap,
  ReaderPageFlowReport,
  ReaderProgressReport,
  ReaderUnitOpenedReport
} from '@shared/reader'
import { BookContainerReader } from './books'
import { createReaderHooks } from './hooks'
import { registerReaderIpc } from './ipc'
import { registerBookProtocol, type BookUnitFileResolver, type BookUnitKind } from './protocol'
import { ReaderWindowManager } from './windows'

const log = createLogger('Reader')

export class ReaderService implements INonDomainService<'reader'> {
  readonly id = 'reader'
  readonly deps = ['ipc'] as const
  readonly hooks = createReaderHooks()
  readonly windows = new ReaderWindowManager(this.hooks)
  readonly books = new BookContainerReader()

  /** No rows are reachable until their owner registers; requests then 404. */
  private resolveUnitFile: BookUnitFileResolver = () => null

  async init(container: ServiceInitContainer<this>): Promise<void> {
    registerBookProtocol(this)
    registerReaderIpc(this, container.get('ipc'))
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.windows.dispose()
    log.info('Disposed')
  }

  /** Points the `book://` transport at the rows that own reading files. */
  setUnitFileResolver(resolve: BookUnitFileResolver): void {
    this.resolveUnitFile = resolve
  }

  findUnitFilePath(kind: BookUnitKind, fileId: string): string | null {
    return this.resolveUnitFile(kind, fileId)
  }

  requireBootstrap(windowId: number): ReaderBootstrap {
    const bootstrap = this.windows.getBootstrap(windowId)
    if (!bootstrap) {
      throw new Error(`Window ${windowId} is not a reader window.`)
    }

    return bootstrap
  }

  /**
   * Authoritative page count of one unit file, probed from the file as it is
   * on disk right now. The requesting window may only ask about unit files of
   * the bootstrap prepared for it.
   */
  async probeUnitPages(windowId: number, fileId: string): Promise<number> {
    const bootstrap = this.requireBootstrap(windowId)
    if (!bootstrap.units.some((unit) => unit.fileId === fileId)) {
      throw new Error(`Window ${windowId} does not own unit file ${fileId}.`)
    }

    const path = this.findUnitFilePath(bootstrap.media, fileId)
    if (!path) {
      throw new Error(`Unit file ${fileId} has no stored path.`)
    }

    const info = await this.books.probePagedContainer(path)
    if (info?.pageCount == null) {
      throw new Error(`Unit file ${fileId} did not reveal a page count.`)
    }
    return info.pageCount
  }

  reportProgress(windowId: number, report: ReaderProgressReport): void {
    if (!this.windows.isReaderWindow(windowId)) return
    this.hooks.progress.dispatch({ windowId, report })
  }

  reportUnitOpened(windowId: number, report: ReaderUnitOpenedReport): void {
    if (!this.windows.isReaderWindow(windowId)) return
    this.hooks.unitOpened.dispatch({ windowId, report })
  }

  reportPageFlow(windowId: number, report: ReaderPageFlowReport): void {
    if (!this.windows.isReaderWindow(windowId)) return
    this.hooks.pageFlowChanged.dispatch({ windowId, report })
  }
}
