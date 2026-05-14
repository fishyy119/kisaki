/**
 * Scanner Service
 *
 * Manages media scanning from disk.
 * Provides:
 * - Namespace-style access to media-specific handlers (game)
 * - Generic entity scanning utilities shared across all media types
 */

import log from 'electron-log/main'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { MediaType } from '@shared/common'
import type { ExtractionTestResult } from '@shared/scanner'
import type { DbService } from '@main/services/db'
import type { NameExtractionRule } from '@shared/db'
import { GameScannerHandler } from './handlers/game'
import { ScannerPhash } from './phash'
import { extractEntityName, scanForEntities } from './utils'
import { registerScannerIpc } from './ipc'

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
    log.info('[ScannerService] Initialized')
  }

  async testExtractionRules(
    scannerPath: string,
    entityDepth: number,
    rules: NameExtractionRule[]
  ): Promise<ExtractionTestResult[]> {
    const settingsData = this.dbService.helper.getAppSettings()
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
    log.info('[ScannerService] Disposed')
  }

  getSupportedMedia(): MediaType[] {
    return ['game']
  }
}
