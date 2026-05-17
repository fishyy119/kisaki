/**
 * Scanner Service
 *
 * Manages media scanning from disk.
 * Provides:
 * - Namespace-style access to media-specific handlers (game)
 * - Generic entity scanning utilities shared across all media types
 */

import { createLogger } from '@main/log'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { MediaType } from '@shared/common'
import type { ExtractionTestResult } from '@shared/scanner'
import type { DbService } from '@main/services/db'
import type { NameExtractionRule } from '@shared/db'
import { GameScannerHandler } from './handlers/game'
import { ScannerPhash } from './phash'
import { extractEntityName, scanForEntities } from './discovery'
import { registerScannerIpc } from './ipc'

const log = createLogger('Scanner')

// =============================================================================
// Scanner Service
// =============================================================================

export class ScannerService implements IMediaService {
  readonly id = 'scanner'
  readonly deps = ['db', 'ipc', 'ingest'] as const satisfies readonly ServiceName[]

  game!: GameScannerHandler
  phash!: ScannerPhash
  private dbService!: DbService

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.dbService = container.get('db')
    const ipcService = container.get('ipc')
    const ingestService = container.get('ingest')

    this.phash = new ScannerPhash()

    // Pass scanForEntities function to handler (not entire service)
    this.game = new GameScannerHandler(
      scanForEntities,
      this.phash,
      this.dbService,
      ipcService,
      ingestService
    )
    registerScannerIpc(this, ipcService)
    log.info('Initialized')
  }

  async testExtractionRules(
    scannerPath: string,
    entityDepth: number,
    rules: NameExtractionRule[]
  ): Promise<ExtractionTestResult[]> {
    const settingsData = this.dbService.entityFinder.getAppSettings()
    const entities = await scanForEntities(scannerPath, {
      entityDepth,
      ignoredNames: settingsData.scannerIgnoredNames,
      nameExtractionRules: []
    })

    return entities.map((entity) => {
      const { extractedName, matchedRuleId } = extractEntityName(entity.originalBaseName, rules)
      return {
        originalName: entity.originalName,
        extractedName,
        matchedRuleId
      }
    })
  }

  async dispose(): Promise<void> {
    this.game.cleanup()
    log.info('Disposed')
  }

  getSupportedMedia(): MediaType[] {
    return ['game']
  }
}
