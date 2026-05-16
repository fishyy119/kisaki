import type {
  IngestAddPersonFromScraperOptions,
  IngestAddPersonFromScraperResult
} from '@shared/ingest/add'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { PersonIngestPersistHandler } from '../persist'
import { buildPersonGraph } from '../graph'
import { addPersonToCollection, normalizeIngestLookupInput, requireScrapedBundle } from './common'

export class PersonAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: PersonIngestPersistHandler
  ) {}

  async fromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddPersonFromScraperOptions
  ): Promise<IngestAddPersonFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)

    if (normalized.lookup.knownIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingPerson({
        externalIds: normalized.lookup.knownIds
      })
      if (existingByExternalId) {
        addPersonToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)

        return {
          personId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    const bundle = requireScrapedBundle(
      await this.scraperService.person.scrape(normalized.profileId, normalized.lookup),
      'person'
    )
    const graph = buildPersonGraph(bundle, normalized.lookup)
    return this.persistHandler.persistPersonGraph(graph, options)
  }
}
