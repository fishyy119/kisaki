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
import { ScannerDiscovery } from './discovery'
import { createScannerHooks } from './hooks'
import { registerScannerIpc } from './ipc'

const log = createLogger('Scanner')

// =============================================================================
// Scanner Service
// =============================================================================

export class ScannerService implements IMediaService {
  readonly id = 'scanner'
  readonly deps = [
    'db',
    'i18n',
    'ipc',
    'ingest',
    'task-run'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createScannerHooks()

  game!: GameScannerHandler
  discovery!: ScannerDiscovery

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const ingestService = container.get('ingest')
    const taskRunService = container.get('task-run')

    this.discovery = new ScannerDiscovery(dbService)

    this.game = new GameScannerHandler(
      this.discovery,
      dbService,
      ipcService,
      this.hooks,
      ingestService,
      taskRunService,
      container.get('i18n')
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
