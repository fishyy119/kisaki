import log from 'electron-log/main'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import { flushPendingAssets } from '../assets'
import {
  PERSON_UPDATE_CORE_SURFACES,
  PERSON_UPDATE_MEDIA_SURFACES,
  PERSON_UPDATE_SURFACE_KEYS,
  type PersonUpdateRequest
} from '@shared/ingest/update'
import { applyPersonPlan } from './apply'
import { loadPersonCurrent } from './current'
import { buildPersonIncoming } from './incoming'
import { buildPersonPlan } from './plan'
import {
  normalizeLookup,
  normalizePolicy,
  normalizeSelection,
  resolveUpdateSelection
} from './utils'

export class PersonUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService
  ) {}

  async fromScraper(request: PersonUpdateRequest): Promise<void> {
    if (!request.rootId) {
      throw new Error('Update rootId is required')
    }
    if (!request.profileId) {
      throw new Error('Update profileId is required')
    }

    const lookup = normalizeLookup(request.lookup)
    const surfaces = normalizeSelection(request.selection.surfaces, PERSON_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: PERSON_UPDATE_CORE_SURFACES,
      mediaSurfaces: PERSON_UPDATE_MEDIA_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    const bundle = await this.scraperService.person.scrape(request.profileId, lookup)
    const incoming = buildPersonIncoming(bundle, lookup)
    const current = loadPersonCurrent(this.dbService.db, request.rootId, selection)
    const plan = buildPersonPlan({
      current,
      incoming,
      selection,
      policy
    })

    const applyResult = this.dbService.db.transaction((tx) =>
      applyPersonPlan(tx, request.rootId, plan)
    )

    const warnings = await flushPendingAssets(this.dbService, applyResult.pendingAssets)
    if (warnings.length > 0) {
      log.warn(
        `[IngestService] Person update completed with asset warnings: ${warnings
          .map((warning) => warning.message)
          .join(' | ')}`
      )
    }
  }
}
