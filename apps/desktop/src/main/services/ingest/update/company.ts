import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import { flushPendingAssets } from '../assets'
import {
  COMPANY_UPDATE_CORE_SURFACES,
  COMPANY_UPDATE_MEDIA_SURFACES,
  COMPANY_UPDATE_SURFACE_KEYS,
  type CompanyUpdateRequest
} from '@shared/ingest/update'
import { applyCompanyPlan } from './apply'
import { loadCompanyCurrent } from './current'
import { buildCompanyIncoming } from './incoming'
import { buildCompanyPlan } from './plan'
import {
  normalizeLookup,
  normalizePolicy,
  normalizeSelection,
  resolveUpdateSelection
} from './utils'

const log = createLogger('Ingest')

export class CompanyUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService
  ) {}

  async fromScraper(request: CompanyUpdateRequest): Promise<void> {
    if (!request.rootId) {
      throw new Error('Update rootId is required')
    }
    if (!request.profileId) {
      throw new Error('Update profileId is required')
    }

    const lookup = normalizeLookup(request.lookup)
    const surfaces = normalizeSelection(request.selection.surfaces, COMPANY_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: COMPANY_UPDATE_CORE_SURFACES,
      mediaSurfaces: COMPANY_UPDATE_MEDIA_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    const bundle = await this.scraperService.company.scrape(request.profileId, lookup)
    const incoming = buildCompanyIncoming(bundle, lookup)
    const current = loadCompanyCurrent(this.dbService.client, request.rootId, selection)
    const plan = buildCompanyPlan({
      current,
      incoming,
      selection,
      policy
    })

    const applyResult = this.dbService.client.transaction((tx) =>
      applyCompanyPlan(tx, request.rootId, plan)
    )

    const warnings = await flushPendingAssets(this.dbService, applyResult.pendingAssets)
    if (warnings.length > 0) {
      log.warn('Company update completed with asset warnings.', {
        warningsItemsText: warnings.map((warning) => warning.message).join(' | ')
      })
    }
  }
}
