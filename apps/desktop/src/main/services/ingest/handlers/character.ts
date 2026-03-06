import type {
  IngestAddCharacterFromScraperOptions,
  IngestAddCharacterFromScraperResult
} from '@shared/ingest'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { CharacterIngestPersistHandler } from '../persist'
import { buildCharacterGraph } from '../transforms/character'
import {
  addCharacterToCollection,
  normalizeIngestLookupInput,
  requireScrapedBundle
} from './common'

export class CharacterIngestHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: CharacterIngestPersistHandler
  ) {}

  async addFromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddCharacterFromScraperOptions
  ): Promise<IngestAddCharacterFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)

    if (normalized.lookup.knownIds?.length) {
      const existingByExternalId = this.dbService.helper.findExistingCharacter({
        externalIds: normalized.lookup.knownIds
      })
      if (existingByExternalId) {
        addCharacterToCollection(
          this.dbService,
          existingByExternalId.id,
          options?.targetCollectionId
        )

        return {
          characterId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    const bundle = requireScrapedBundle(
      await this.scraperService.character.scrape(normalized.profileId, normalized.lookup, {
        skipValidation: options?.skipScraperValidation
      }),
      'character'
    )
    const graph = buildCharacterGraph(bundle, normalized.lookup)
    return this.persistHandler.persistCharacterGraph(graph, options)
  }
}
