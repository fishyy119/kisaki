import type {
  IngestAddCompanyFromScraperOptions,
  IngestAddCompanyFromScraperResult
} from '@shared/ingest/add'
import type { ScraperLookup } from '@shared/scraper'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { CompanyIngestPersistHandler } from '../persist'
import { buildCompanyGraph } from '../graph'
import { addCompanyToCollection, normalizeIngestLookupInput, requireScrapedBundle } from './common'

export class CompanyAddHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandler: CompanyIngestPersistHandler
  ) {}

  async fromScraper(
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddCompanyFromScraperOptions
  ): Promise<IngestAddCompanyFromScraperResult> {
    const normalized = normalizeIngestLookupInput(profileId, lookup)

    if (normalized.lookup.knownIds?.length) {
      const existingByExternalId = this.dbService.helper.findExistingCompany({
        externalIds: normalized.lookup.knownIds
      })
      if (existingByExternalId) {
        addCompanyToCollection(this.dbService, existingByExternalId.id, options?.targetCollectionId)

        return {
          companyId: existingByExternalId.id,
          isNew: false,
          existingReason: 'externalId'
        }
      }
    }

    const bundle = requireScrapedBundle(
      await this.scraperService.company.scrape(normalized.profileId, normalized.lookup),
      'company'
    )
    const graph = buildCompanyGraph(bundle, normalized.lookup)
    return this.persistHandler.persistCompanyGraph(graph, options)
  }
}
