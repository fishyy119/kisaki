import type {
  IngestAddGameDirectOptions,
  IngestAddGameDirectResult,
  IngestAddGameDirectSeed,
  IngestAddGameFromScraperOptions,
  IngestAddGameFromScraperResult
} from '@shared/ingest'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { GameIngestPersistHandler } from '../persist'
import { buildDirectGameGraph, buildGameGraph } from '../transforms/game'
import {
  addGameToCollection,
  normalizeIngestLookupInput,
  normalizeLookup,
  requireScrapedBundle
} from './common'

export class GameIngestHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: GameIngestPersistHandler
  ) {}

  async addFromScraper(
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
      await this.scraperService.game.scrape(normalized.profileId, normalized.lookup, {
        skipValidation: options?.skipScraperValidation
      }),
      'game'
    )
    const graph = buildGameGraph(bundle, normalized.lookup)
    return this.persistHandler.persistGameGraph(graph, options)
  }

  async addDirect(
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
      const existingByPath = this.dbService.helper.findExistingGame({ path: options.gameDirPath })
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
      const existingByExternalId = this.dbService.helper.findExistingGame({ externalIds: knownIds })
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
