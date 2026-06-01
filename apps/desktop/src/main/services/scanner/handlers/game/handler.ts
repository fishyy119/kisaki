/**
 * Game Scanner Handler
 *
 * Keeps game-specific scan behavior focused on:
 * - loading game scanner/profile context
 * - resolving entities into games
 * - handing add flows to ingest
 *
 * Queueing, run state publishing, controls, and concurrency control
 * are delegated to the shared scanner coordinator in `handlers/common`.
 */

import { createLogger } from '@main/log'
import { promises as fs } from 'fs'
import { eq } from 'drizzle-orm'
import type { DbService } from '@main/services/db'
import type { EventService } from '@main/services/event'
import type { IngestService } from '@main/services/ingest'
import type { IpcService } from '@main/services/ipc'
import type { TaskRunService } from '@main/services/task-run'
import type { TaskRunInitiator } from '@shared/task-run'
import { scanners, scraperProfiles, type ScraperProfile } from '@shared/db'
import type { Scanner, ScannerIngestMode } from '@shared/db'
import type {
  EntityEntry,
  ScanCompletedData,
  ScannerRunState,
  ScannerRunStartResult
} from '@shared/scanner'
import type { IngestAddGameResult } from '@shared/ingest/add'
import type { ScannerPhash } from '../../phash'
import type { ScannerDiscovery } from '../../discovery'
import {
  ScannerRunCoordinator,
  type ScannerEntityProcessResult,
  ScannerRunSession
} from '../common'
import { matchGameEntity } from './match'
import type { GameEntity } from './types'

const log = createLogger('Scanner')

function isRecoverableScraperFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  const recoverableMarkers = [
    'profile not found',
    'search provider',
    'provider',
    'scrape',
    'network',
    'timeout',
    'timed out',
    'econn',
    'enotfound',
    'eai_again'
  ]

  return recoverableMarkers.some((marker) => message.includes(marker))
}

function assertNever(value: never): never {
  throw new Error(`Unsupported scanner ingest mode: ${String(value)}`)
}

export class GameScannerHandler {
  private readonly scheduledScanners = new Map<string, NodeJS.Timeout>()
  private readonly runs: ScannerRunCoordinator<Scanner>

  constructor(
    private readonly discovery: ScannerDiscovery,
    private readonly phash: ScannerPhash,
    private readonly dbService: DbService,
    ipcService: IpcService,
    eventService: EventService,
    private readonly ingestService: IngestService,
    taskRunService: TaskRunService
  ) {
    this.runs = new ScannerRunCoordinator<Scanner>({
      ipc: ipcService,
      taskRun: taskRunService,
      eventService,
      loadScanner: async (scannerId) => this.loadGameScanner(scannerId),
      runScan: async (scanner, session) => this.runScannerScan(scanner, session)
    })
  }

  async runScanner(
    scannerId: string,
    initiator: TaskRunInitiator = { type: 'user' }
  ): Promise<ScanCompletedData> {
    return this.runs.runScanner(scannerId, initiator)
  }

  async startScanner(
    scannerId: string,
    initiator: TaskRunInitiator = { type: 'user' }
  ): Promise<ScannerRunStartResult> {
    const { start, completed } = await this.runs.startScanner(scannerId, initiator)
    void completed.catch((error) => {
      log.error('Scanner run failed after start.', { scannerId, error })
    })
    return start
  }

  listRunStates(): ScannerRunState[] {
    return this.runs.listRunStates()
  }

  pauseScanner(scannerId: string): boolean {
    return this.runs.pauseScanner(scannerId)
  }

  resumeScanner(scannerId: string): boolean {
    return this.runs.resumeScanner(scannerId)
  }

  cancelScanner(scannerId: string): boolean {
    return this.runs.cancelScanner(scannerId)
  }

  async startAllScanners(
    initiator: TaskRunInitiator = { type: 'user' }
  ): Promise<ScannerRunStartResult[]> {
    let allScanners: Scanner[] = []
    try {
      allScanners = this.dbService.client
        .select()
        .from(scanners)
        .where(eq(scanners.type, 'game'))
        .all()
    } catch (error) {
      log.error('Failed to get all game scanners.', { error: error })
    }

    const starts: ScannerRunStartResult[] = []
    for (const scanner of allScanners) {
      try {
        starts.push(await this.startScanner(scanner.id, initiator))
      } catch (error) {
        log.error('Failed to start scanner.', {
          scannerName: scanner.name,
          error: error
        })
      }
    }

    return starts
  }

  async scheduleScanner(scannerId: string): Promise<void> {
    this.unscheduleScanner(scannerId)

    const scanner = this.getScannerById(scannerId)
    if (!scanner) {
      log.error('Cannot schedule scanner: not found.', { scannerId: scannerId })
      return
    }

    if (scanner.scanIntervalMinutes <= 0) {
      log.info('Scanner scan interval disabled, not scheduling.', {
        scannerName: scanner.name,
        scannerScanIntervalMinutes: scanner.scanIntervalMinutes
      })
      return
    }

    if (scanner.type !== 'game') {
      log.warn('Scanner is not a game scanner, cannot schedule.', { scannerName: scanner.name })
      return
    }

    const intervalMs = scanner.scanIntervalMinutes * 60 * 1000

    log.info('Scheduling scanner.', {
      scannerName: scanner.name,
      scannerScanIntervalMinutes: scanner.scanIntervalMinutes
    })

    const intervalId = setInterval(async () => {
      log.info('Running scheduled scan for scanner.', { scannerName: scanner.name })
      try {
        await this.runScanner(scannerId, { type: 'system', reason: 'maintenance' })
      } catch (error) {
        log.error('Scheduled scan failed for scanner.', { scannerName: scanner.name, error: error })
      }
    }, intervalMs)

    this.scheduledScanners.set(scannerId, intervalId)
  }

  unscheduleScanner(scannerId: string): void {
    const intervalId = this.scheduledScanners.get(scannerId)
    if (intervalId) {
      clearInterval(intervalId)
      this.scheduledScanners.delete(scannerId)
      log.info('Unscheduled scanner.', { scannerId: scannerId })
    }
  }

  async scheduleAllScanners(): Promise<void> {
    log.info('Scheduling all game scanners with intervals')

    let allScanners: Scanner[] = []
    try {
      allScanners = this.dbService.client
        .select()
        .from(scanners)
        .where(eq(scanners.type, 'game'))
        .all()
    } catch (error) {
      log.error('Failed to get all game scanners.', { error: error })
    }

    for (const scanner of allScanners) {
      await this.scheduleScanner(scanner.id)
    }
  }

  unscheduleAllScanners(): void {
    log.info('Unscheduling all game scanners')

    for (const scannerId of this.scheduledScanners.keys()) {
      this.unscheduleScanner(scannerId)
    }
  }

  getScheduledScannerIds(): string[] {
    return Array.from(this.scheduledScanners.keys())
  }

  isScannerScheduled(scannerId: string): boolean {
    return this.scheduledScanners.has(scannerId)
  }

  cleanup(): void {
    this.unscheduleAllScanners()
    this.runs.cleanup()
  }

  private async runScannerScan(
    scanner: Scanner,
    session: ScannerRunSession<Scanner>
  ): Promise<void> {
    const settingsData = this.dbService.entityFinder.getAppSettings()
    const {
      scannerIgnoredNames: ignoredNames,
      scannerUsePhash,
      scannerParallelCount,
      scannerIngestMode: ingestMode
    } = settingsData

    const profile = this.getScraperProfile(scanner.scraperProfileId)
    if (!profile && ingestMode === 'require-scraper') {
      throw new Error(`Profile not found for scanner: ${scanner.scraperProfileId}`)
    }

    if (!profile) {
      log.warn('Scanner has no scraper profile.', {
        scannerName: scanner.name,
        value1:
          ingestMode === 'direct-only'
            ? 'using direct ingest mode'
            : 'using direct ingest fallback mode'
      })
    }

    log.info('Starting game scan.', {
      scannerName: scanner.name,
      scannerPath: scanner.path,
      scannerEntityDepth: scanner.entityDepth,
      ingestMode: ingestMode,
      scannerParallelCount: scannerParallelCount,
      value5: profile?.name ?? 'none'
    })

    session.reportPhase('discovering', '正在扫描目录', true)
    await session.checkpoint()

    const entities = await this.discovery.scanForEntities(scanner.path, {
      entityDepth: scanner.entityDepth,
      ignoredNames,
      nameExtractionRules: scanner.nameExtractionRules
    })
    await session.checkpoint()

    log.info('Found entities at depth.', {
      entitiesLength: entities.length,
      scannerEntityDepth: scanner.entityDepth
    })

    session.reportPhase('processing', '正在处理扫描结果')
    session.setTotal(entities.length)
    await session.processItemsWithConcurrency(entities, scannerParallelCount, async (entity) => {
      const entityResult = await this.processEntity(entity, {
        scanner,
        profile,
        ingestMode,
        scannerUsePhash
      })
      session.recordEntityResult(entityResult)
    })

    log.info('Scan completed.', {
      sessionStateNewCount: session.state.newCount,
      sessionStateSkippedCount: session.state.skippedCount,
      sessionStateFailedCount: session.state.failedCount
    })
  }

  private async processGameEntity(
    gameEntity: GameEntity,
    profile: ScraperProfile | null,
    scanner: Scanner,
    ingestMode: ScannerIngestMode
  ): Promise<IngestAddGameResult> {
    const { gameName, externalIds } = gameEntity.matchedGame

    const seed = {
      name: gameName,
      knownIds: externalIds.length > 0 ? externalIds : undefined
    }
    const options = {
      gameDirPath: gameEntity.path,
      targetCollectionId: scanner.targetCollectionId || undefined
    }

    const addDirect = async (): Promise<IngestAddGameResult> => {
      return this.ingestService.add.game.direct(seed, options)
    }

    let result: IngestAddGameResult

    switch (ingestMode) {
      case 'direct-only':
        result = await addDirect()
        break
      case 'require-scraper':
        if (!profile) {
          throw new Error(`Profile not found for scanner: ${scanner.scraperProfileId}`)
        }
        result = await this.ingestService.add.game.fromScraper(profile.id, seed, options)
        break
      case 'prefer-scraper':
        if (!profile) {
          result = await addDirect()
          break
        }

        try {
          result = await this.ingestService.add.game.fromScraper(profile.id, seed, options)
        } catch (error) {
          if (!isRecoverableScraperFailure(error)) {
            throw error
          }

          const message = error instanceof Error ? error.message : String(error)
          log.warn('Scraper ingest failed, falling back to direct ingest.', {
            gameEntityPath: gameEntity.path,
            message: message
          })
          result = await addDirect()
        }
        break
      default:
        return assertNever(ingestMode)
    }

    if (result.isNew) {
      log.info('Successfully added game.', {
        gameName: gameName,
        resultGameId: result.gameId,
        gameEntityPath: gameEntity.path
      })

      if (result.warnings?.length) {
        log.warn('Game completed with post-commit warnings.', {
          resultGameId: result.gameId,
          resultWarningsItemsText: result.warnings.map((warning) => warning.message).join(' | ')
        })
      }
    }

    return result
  }

  private async processEntity(
    entity: EntityEntry,
    options: {
      scanner: Scanner
      profile: ScraperProfile | null
      ingestMode: ScannerIngestMode
      scannerUsePhash: boolean
    }
  ): Promise<ScannerEntityProcessResult> {
    try {
      let stat: Awaited<ReturnType<typeof fs.stat>>
      try {
        stat = await fs.stat(entity.path)
      } catch (error) {
        log.error('Failed to stat entity.', { entityPath: entity.path, error: error })
        return { kind: 'processed-only' }
      }

      if (!stat.isDirectory()) {
        log.info('Skipping non-directory entity.', { entityPath: entity.path })
        return { kind: 'processed-only' }
      }

      const existingByPath = this.dbService.entityFinder.findExistingGame({
        path: entity.path
      })
      if (existingByPath) {
        log.info('Game already exists at path.', {
          entityPath: entity.path,
          existingByPathName: existingByPath.name
        })

        return {
          kind: 'skipped',
          skippedScan: {
            name: entity.extractedName,
            path: entity.path,
            reason: 'path',
            existingGameId: existingByPath.id
          }
        }
      }

      const matchedGame = await matchGameEntity(entity, this.phash, {
        enablePhash: options.scannerUsePhash
      })
      const matchedEntity: GameEntity = { ...entity, matchedGame }
      const addResult = await this.processGameEntity(
        matchedEntity,
        options.profile,
        options.scanner,
        options.ingestMode
      )

      if (addResult.isNew) {
        return { kind: 'new' }
      }

      log.info('Game already exists.', {
        entityPath: entity.path,
        addResultExistingReason: addResult.existingReason
      })
      return {
        kind: 'skipped',
        skippedScan: {
          name: entity.extractedName,
          path: entity.path,
          reason: (addResult.existingReason || 'externalId') as 'path' | 'externalId',
          existingGameId: addResult.gameId
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      log.error('Error processing entity.', { entityPath: entity.path, errorMsg: errorMsg })

      return {
        kind: 'failed',
        failedScan: {
          name: entity.extractedName,
          path: entity.path,
          reason: errorMsg
        }
      }
    }
  }

  private loadGameScanner(scannerId: string): Scanner {
    const scanner = this.getScannerById(scannerId)
    if (!scanner) {
      throw new Error(`Scanner not found: ${scannerId}`)
    }

    if (scanner.type !== 'game') {
      throw new Error(`Scanner ${scanner.name} is not a game scanner`)
    }

    return scanner
  }

  private getScannerById(scannerId: string): Scanner | null {
    try {
      const result = this.dbService.client
        .select()
        .from(scanners)
        .where(eq(scanners.id, scannerId))
        .limit(1)
        .all()
      return result[0] || null
    } catch (error) {
      log.error('Failed to get scanner.', { scannerId: scannerId, error: error })
      return null
    }
  }

  private getScraperProfile(profileId: string): ScraperProfile | null {
    try {
      const result = this.dbService.client
        .select()
        .from(scraperProfiles)
        .where(eq(scraperProfiles.id, profileId))
        .limit(1)
        .all()
      return result[0] || null
    } catch (error) {
      log.error('Failed to get profile.', { profileId: profileId, error: error })
      return null
    }
  }
}
