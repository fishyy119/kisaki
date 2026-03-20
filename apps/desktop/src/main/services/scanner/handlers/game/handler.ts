/**
 * Game Scanner Handler
 *
 * This module handles scanning directories for games and automatically adding them to the library.
 *
 * ## How it works:
 *
 * 1. **Layer-Based Entity Detection**
 *    - Uses `entityDepth` to determine which directory level contains game folders
 *    - `entityDepth: 0` means immediate children are games
 *    - `entityDepth: 1` means grandchildren are games, etc.
 *
 * 2. **Game Validation**
 *    - After detecting entities, validates each is a directory (games must be folders)
 *    - Scans for executables (.exe, .bat, .cmd) for phash matching
 *
 * 3. **Duplicate Detection**
 *    - Before processing, checks if a game already exists at that path
 *    - Skips folders that already have games in the library
 *
 * 4. **Game Identification** (Two-tier matching strategy)
 *    a. **Icon Phash Matching** (Primary - when enabled and phash.db exists)
 *       - Extracts icons from executables in the game folder
 *       - Calculates perceptual hash (phash) for each icon
 *       - Queries phash.db for matching games using Hamming distance (threshold: 5)
 *       - Uses matched record's `external_ids` (cross-provider IDs) as known IDs
 *
 *    b. **Folder Name** (Fallback when phash is disabled or no match)
 *       - Uses the folder name as game name
 *
 * 5. **Game Addition**
 *    - Delegates to IngestService for persisted add flows
 *    - Uses settings-controlled ingest mode for scraper/direct ingest behavior
 *    - Sets gameDirPath to the folder path
 *    - Associates with scanner's target collection if configured
 *
 * ## phash.db Structure:
 *
 * SQLite database located at `<resources>/phash.db`
 * ```sql
 * CREATE TABLE games (
 *   id TEXT PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   external_ids TEXT NOT NULL,  -- JSON array: [{source: string, id: string}, ...]
 *   phash TEXT NOT NULL           -- Hexadecimal phash string
 * )
 * ```
 */

import log from 'electron-log/main'
import { promises as fs } from 'fs'
import { eq } from 'drizzle-orm'
import type { DbService } from '@main/services/db'
import type { IngestService } from '@main/services/ingest'
import { scanners, scraperProfiles, type ScraperProfile } from '@shared/db'
import type { Scanner, ScannerIngestMode } from '@shared/db'
import type { EntityEntry, ScanProgressData, ScanCompletedData } from '@shared/scanner'
import type { IpcService } from '@main/services/ipc'
import type { IngestAddGameResult } from '@shared/ingest/add'
import type { ScannerPhash } from '../../phash'
import type { ScanOptions } from '../../utils'
import { matchGameEntity } from './match'
import type { GameEntity, ScanQueueItem } from './types'

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

// =============================================================================
// Game Scanner Handler
// =============================================================================

/**
 * Game Scanner Handler
 * Manages game scanning with layer-based entity detection
 */
export class GameScannerHandler {
  private scheduledScanners = new Map<string, NodeJS.Timeout>()
  private scannersInProgress = new Set<string>()
  private activeScanProgress = new Map<string, ScanProgressData>()
  private scanQueue: ScanQueueItem[] = []
  private isProcessingQueue = false

  constructor(
    private scanForEntities: (rootPath: string, options: ScanOptions) => Promise<EntityEntry[]>,
    private phash: ScannerPhash,
    private dbService: DbService,
    private ipcService: IpcService,
    private ingestService: IngestService
  ) {}

  /**
   * Get all active scan progress states
   */
  getActiveScans(): ScanProgressData[] {
    return [...this.activeScanProgress.values()]
  }

  /**
   * Scan and process games for a scanner
   */
  async scanScanner(scannerId: string): Promise<ScanCompletedData> {
    return new Promise((resolve, reject) => {
      this.scanQueue.push({ scannerId, resolve, reject })
      this.processQueue()
    })
  }

  /**
   * Process the scan queue (only one scanner at a time)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.scanQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    while (this.scanQueue.length > 0) {
      const item = this.scanQueue.shift()
      if (!item) break

      try {
        const result = await this.executeScan(item.scannerId)
        item.resolve(result)
      } catch (error) {
        item.reject(error)
      }
    }

    this.isProcessingQueue = false
  }

  /**
   * Execute the actual scan for a scanner
   */
  private async executeScan(scannerId: string): Promise<ScanCompletedData> {
    if (this.scannersInProgress.has(scannerId)) {
      throw new Error(`Scanner ${scannerId} is already scanning`)
    }

    this.scannersInProgress.add(scannerId)

    try {
      let scanner: Scanner | null = null
      try {
        const result = this.dbService.db
          .select()
          .from(scanners)
          .where(eq(scanners.id, scannerId))
          .limit(1)
          .all()
        scanner = result[0] || null
      } catch (error) {
        log.error(`[Scanner] Failed to get scanner ${scannerId}: ${error}`)
        scanner = null
      }

      if (!scanner) {
        throw new Error(`Scanner not found: ${scannerId}`)
      }

      if (scanner.type !== 'game') {
        throw new Error(`Scanner ${scanner.name} is not a game scanner`)
      }

      const settingsData = this.dbService.helper.getAppSettings()
      const {
        scannerIgnoredNames: ignoredNames,
        scannerUsePhash,
        scannerIngestMode: ingestMode
      } = settingsData

      // Get the profile for this scanner
      let profile: ScraperProfile | null = null
      try {
        const result = this.dbService.db
          .select()
          .from(scraperProfiles)
          .where(eq(scraperProfiles.id, scanner.scraperProfileId))
          .limit(1)
          .all()
        profile = result[0] || null
      } catch (error) {
        log.error(`[Scanner] Failed to get profile ${scanner.scraperProfileId}: ${error}`)
        profile = null
      }

      if (!profile && ingestMode === 'require-scraper') {
        throw new Error(`Profile not found for scanner: ${scanner.scraperProfileId}`)
      }

      if (!profile) {
        log.warn(
          `[Scanner] Scanner ${scanner.name} has no scraper profile, ${
            ingestMode === 'direct-only'
              ? 'using direct ingest mode'
              : 'using direct ingest fallback mode'
          }`
        )
      }

      log.info(
        `[Scanner] Starting game scan for: ${scanner.name} at ${scanner.path} (depth: ${scanner.entityDepth}, mode: ${ingestMode}, profile: ${profile?.name ?? 'none'})`
      )

      const result: ScanCompletedData = {
        scannerId: scanner.id,
        scannerName: scanner.name,
        mediaType: scanner.type,
        path: scanner.path,
        total: 0,
        processedCount: 0,
        newCount: 0,
        skippedCount: 0,
        failedCount: 0,
        skippedScans: [],
        failedScans: []
      }

      // Scan for entities using layer-based detection
      const entities = await this.scanForEntities(scanner.path, {
        entityDepth: scanner.entityDepth,
        ignoredNames,
        nameExtractionRules: scanner.nameExtractionRules
      })

      log.info(`[Scanner] Found ${entities.length} entities at depth ${scanner.entityDepth}`)

      // Progress state
      const progressState: ScanProgressData = {
        scannerId: scanner.id,
        total: entities.length,
        processedCount: 0,
        newCount: 0,
        skippedCount: 0,
        failedCount: 0,
        skippedScans: [],
        failedScans: [],
        status: 'scanning'
      }

      result.total = entities.length
      this.activeScanProgress.set(scannerId, { ...progressState })
      this.ipcService.send('scanner:scan-progress', { ...progressState })

      // Process entities sequentially.
      for (const entity of entities) {
        try {
          // Games must be directories (not files).
          let stat: Awaited<ReturnType<typeof fs.stat>>
          try {
            stat = await fs.stat(entity.path)
          } catch (error) {
            log.error(`[Scanner] Failed to stat entity ${entity.path}: ${error}`)
            result.processedCount++
            progressState.processedCount++
            this.ipcService.send('scanner:scan-progress', { ...progressState })
            continue
          }
          if (!stat.isDirectory()) {
            log.info(`[Scanner] Skipping non-directory entity: ${entity.path}`)
            result.processedCount++
            progressState.processedCount++
            this.ipcService.send('scanner:scan-progress', { ...progressState })
            continue
          }

          const existingByPath = this.dbService.helper.findExistingGame({
            path: entity.path
          })
          if (existingByPath) {
            log.info(`[Scanner] Game already exists at path ${entity.path}: ${existingByPath.name}`)

            result.processedCount++
            result.skippedCount++
            progressState.processedCount++
            progressState.skippedCount++

            const skippedScan = {
              name: entity.extractedName,
              path: entity.path,
              reason: 'path' as const,
              existingGameId: existingByPath.id
            }
            result.skippedScans.push(skippedScan)
            progressState.skippedScans.push(skippedScan)
            this.ipcService.send('scanner:scan-progress', { ...progressState })
            continue
          }

          // Match game and add to library
          const matchedGame = await matchGameEntity(entity, this.phash, {
            enablePhash: scannerUsePhash
          })
          const matchedEntity: GameEntity = { ...entity, matchedGame }
          const addResult = await this.processGameEntity(
            matchedEntity,
            profile,
            scanner,
            ingestMode
          )

          result.processedCount++
          progressState.processedCount++

          if (addResult.isNew) {
            result.newCount++
            progressState.newCount++
          } else {
            log.info(
              `[Scanner] Game already exists for ${entity.path} (reason: ${addResult.existingReason})`
            )
            result.skippedCount++
            progressState.skippedCount++

            const skippedScan = {
              name: entity.extractedName,
              path: entity.path,
              reason: (addResult.existingReason || 'externalId') as 'path' | 'externalId',
              existingGameId: addResult.gameId
            }
            result.skippedScans.push(skippedScan)
            progressState.skippedScans.push(skippedScan)
          }
          this.ipcService.send('scanner:scan-progress', { ...progressState })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          log.error(`[Scanner] Error processing entity ${entity.path}: ${errorMsg}`)

          result.failedCount++
          progressState.failedCount++

          const failedScan = {
            name: entity.extractedName,
            path: entity.path,
            reason: errorMsg
          }
          result.failedScans.push(failedScan)
          progressState.failedScans.push(failedScan)
          this.ipcService.send('scanner:scan-progress', { ...progressState })
        }
      }

      progressState.status = 'completed'
      this.activeScanProgress.delete(scannerId)
      this.ipcService.send('scanner:scan-progress', { ...progressState })

      log.info(
        `[Scanner] Scan completed: ${result.newCount} new, ${result.skippedCount} skipped, ${result.failedCount} failed`
      )

      return result
    } catch (error) {
      log.error(`[Scanner] Failed to scan games: ${error}`)
      throw error
    } finally {
      this.scannersInProgress.delete(scannerId)
    }
  }

  /**
   * Process a matched game entity and add it to the library
   *
   * Uses the configured ingest mode to decide between scraper and direct ingest.
   */
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
          log.warn(
            `[Scanner] Scraper ingest failed for ${gameEntity.path}, fallback to direct ingest: ${message}`
          )
          result = await addDirect()
        }
        break
      default:
        return assertNever(ingestMode)
    }

    if (result.isNew) {
      log.info(
        `[Scanner] Successfully added game ${gameName} (ID: ${result.gameId}) from ${gameEntity.path}`
      )

      if (result.warnings?.length) {
        log.warn(
          `[Scanner] Game ${result.gameId} completed with post-commit warnings: ${result.warnings
            .map((warning) => warning.message)
            .join(' | ')}`
        )
      }
    }

    return result
  }

  /**
   * Scan all game scanners
   */
  async scanAllScanners(): Promise<Map<string, ScanCompletedData>> {
    const results = new Map<string, ScanCompletedData>()

    let allScanners: Scanner[] = []
    try {
      allScanners = this.dbService.db.select().from(scanners).where(eq(scanners.type, 'game')).all()
    } catch (error) {
      log.error(`[Scanner] Failed to get all game scanners: ${error}`)
      allScanners = []
    }

    log.info(`[Scanner] Found ${allScanners.length} game scanners to scan`)

    for (const scanner of allScanners) {
      try {
        const result = await this.scanScanner(scanner.id)
        results.set(scanner.id, result)
      } catch (error) {
        log.error(`[Scanner] Failed to scan games for scanner ${scanner.name}: ${error}`)
        results.set(scanner.id, {
          scannerId: scanner.id,
          scannerName: scanner.name,
          mediaType: scanner.type,
          path: scanner.path,
          total: 0,
          processedCount: 0,
          newCount: 0,
          skippedCount: 0,
          failedCount: 1,
          skippedScans: [],
          failedScans: [{ name: scanner.name, path: scanner.path, reason: String(error) }]
        })
      }
    }

    return results
  }

  /**
   * Schedule a scanner for periodic scanning
   */
  async scheduleScanner(scannerId: string): Promise<void> {
    this.unscheduleScanner(scannerId)

    let scanner: Scanner | null = null
    try {
      const result = this.dbService.db
        .select()
        .from(scanners)
        .where(eq(scanners.id, scannerId))
        .limit(1)
        .all()
      scanner = result[0] || null
    } catch (error) {
      log.error(`[Scanner] Failed to get scanner ${scannerId}: ${error}`)
      scanner = null
    }

    if (!scanner) {
      log.error(`[Scanner] Cannot schedule scanner ${scannerId}: not found`)
      return
    }

    if (scanner.scanIntervalMinutes <= 0) {
      log.info(
        `[Scanner] Scanner ${scanner.name} has interval ${scanner.scanIntervalMinutes}, not scheduling`
      )
      return
    }

    if (scanner.type !== 'game') {
      log.warn(`[Scanner] Scanner ${scanner.name} is not a game scanner, cannot schedule`)
      return
    }

    const intervalMs = scanner.scanIntervalMinutes * 60 * 1000

    log.info(
      `[Scanner] Scheduling scanner ${scanner.name} to run every ${scanner.scanIntervalMinutes} minutes`
    )

    const intervalId = setInterval(async () => {
      log.info(`[Scanner] Running scheduled scan for scanner: ${scanner.name}`)
      try {
        await this.scanScanner(scannerId)
      } catch (error) {
        log.error(`[Scanner] Scheduled scan failed for scanner ${scanner.name}: ${error}`)
      }
    }, intervalMs)

    this.scheduledScanners.set(scannerId, intervalId)
  }

  /**
   * Unschedule a scanner from periodic scanning
   */
  unscheduleScanner(scannerId: string): void {
    const intervalId = this.scheduledScanners.get(scannerId)
    if (intervalId) {
      clearInterval(intervalId)
      this.scheduledScanners.delete(scannerId)
      log.info(`[Scanner] Unscheduled scanner: ${scannerId}`)
    }
  }

  /**
   * Schedule all scanners that have interval > 0
   */
  async scheduleAllScanners(): Promise<void> {
    log.info('[Scanner] Scheduling all game scanners with intervals')

    let allScanners: Scanner[] = []
    try {
      allScanners = this.dbService.db.select().from(scanners).where(eq(scanners.type, 'game')).all()
    } catch (error) {
      log.error(`[Scanner] Failed to get all game scanners: ${error}`)
      allScanners = []
    }

    for (const scanner of allScanners) {
      await this.scheduleScanner(scanner.id)
    }
  }

  /**
   * Unschedule all scanners
   */
  unscheduleAllScanners(): void {
    log.info('[Scanner] Unscheduling all game scanners')

    for (const scannerId of this.scheduledScanners.keys()) {
      this.unscheduleScanner(scannerId)
    }
  }

  /**
   * Get scheduled game scanner IDs
   */
  getScheduledScannerIds(): string[] {
    return Array.from(this.scheduledScanners.keys())
  }

  /**
   * Check if a game scanner is scheduled
   */
  isScannerScheduled(scannerId: string): boolean {
    return this.scheduledScanners.has(scannerId)
  }

  /**
   * Cleanup - unschedule all scanners
   */
  cleanup(): void {
    this.unscheduleAllScanners()
  }
}
