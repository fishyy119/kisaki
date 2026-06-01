/**
 * Scanner Service
 *
 * Manages media scanning from disk.
 * Provides:
 * - Namespace-style access to media-specific handlers (game)
 * - Discovery utilities shared across all media types
 */

import { createLogger } from '@main/log'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { MediaType } from '@shared/common'
import { GameScannerHandler } from './handlers/game'
import { ScannerPhash } from './phash'
import { ScannerDiscovery } from './discovery'
import { registerScannerIpc } from './ipc'

const log = createLogger('Scanner')

// =============================================================================
// Scanner Service
// =============================================================================

export class ScannerService implements IMediaService {
  readonly id = 'scanner'
  readonly deps = [
    'db',
    'ipc',
    'ingest',
    'event',
    'task-run'
  ] as const satisfies readonly ServiceName[]

  game!: GameScannerHandler
  phash!: ScannerPhash
  discovery!: ScannerDiscovery

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const ingestService = container.get('ingest')
    const eventService = container.get('event')
    const taskRunService = container.get('task-run')

    this.phash = new ScannerPhash()
    this.discovery = new ScannerDiscovery(dbService)

    this.game = new GameScannerHandler(
      this.discovery,
      this.phash,
      dbService,
      ipcService,
      eventService,
      ingestService,
      taskRunService
    )
    registerScannerIpc(this, ipcService)
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.game.cleanup()
    log.info('Disposed')
  }

  getSupportedMedia(): MediaType[] {
    return ['game']
  }
}
