import type {
  IngestAddGameDirectOptions,
  IngestAddGameDirectResult,
  IngestAddGameDirectSeed,
  IngestAddGameFromScraperOptions,
  IngestAddGameFromScraperResult
} from '@shared/ingest/add'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { GameIngestPersistHandler } from '../persist'
import { buildDirectGameGraph, buildGameGraph } from '../graph'
import {
  addGameToCollection,
  normalizeIngestLookupInput,
  normalizeLookup,
  requireScrapedBundle
} from './common'

export class GameAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: GameIngestPersistHandler
  ) {}

  async fromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddGameFromScraperOptions
  ): Promise<IngestAddGameFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)

    const existing = this.tryResolveExistingGame(normalized.lookup.knownIds, options)
    if (existing) {
      return existing
    }

    const bundle = requireScrapedBundle(
      await this.scraperService.game.scrape(normalized.profileId, normalized.lookup),
      'game'
    )
    const graph = buildGameGraph(bundle, normalized.lookup)
    return this.persistHandler.persistGameGraph(graph, options)
  }

  async direct(
    seed: IngestAddGameDirectSeed,
    options?: IngestAddGameDirectOptions
  ): Promise<IngestAddGameDirectResult> {
    const normalizedLookup = normalizeLookup({
      name: seed.name,
      knownIds: seed.knownIds
    })

    const existing = this.tryResolveExistingGame(normalizedLookup.knownIds, options)
    if (existing) {
      return existing
    }

    const graph = buildDirectGameGraph(normalizedLookup)
    return this.persistHandler.persistGameGraph(graph, options)
  }

  private tryResolveExistingGame(
    knownIds: ScraperLookup['knownIds'],
    options?: IngestAddGameDirectOptions | IngestAddGameFromScraperOptions
  ): IngestAddGameDirectResult | undefined {
    if (options?.gameDirPath) {
      const existingByPath = this.dbService.entityFinder.findExistingGame({
        path: options.gameDirPath
      })
      if (existingByPath) {
        addGameToCollection(this.dbService, existingByPath.id, options.targetCollectionId)
        return {
          gameId: existingByPath.id,
          isNew: false,
          existingReason: 'path'
        }
      }
    }

    if (knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingGame({
        externalIds: knownIds
      })
      if (existingByExternalId) {
        addGameToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)
        return {
          gameId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    return undefined
  }
}
