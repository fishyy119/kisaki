import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { IngestPersistHandlers } from '../persist'
import { flushPendingAssets } from '../assets'
import { buildCharacterGraph } from '../graph'
import {
  CHARACTER_UPDATE_CORE_SURFACES,
  CHARACTER_UPDATE_MEDIA_SURFACES,
  CHARACTER_UPDATE_RELATION_SURFACES,
  CHARACTER_UPDATE_SURFACE_KEYS,
  type CharacterUpdateRequest
} from '@shared/ingest/update'
import { applyCharacterPlan } from './apply'
import { loadCharacterCurrent } from './current'
import { buildCharacterIncoming } from './incoming'
import { buildCharacterPlan } from './plan'
import { normalizeLookup } from './shared/normalization'
import { normalizePolicy } from './shared/policy'
import { normalizeSelection, resolveUpdateSelection } from './shared/selection'

const log = createLogger('Ingest')

export class CharacterUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandlers: IngestPersistHandlers
  ) {}

  async fromScraper(request: CharacterUpdateRequest): Promise<void> {
    if (!request.rootId) {
      throw new Error('Update rootId is required')
    }
    if (!request.profileId) {
      throw new Error('Update profileId is required')
    }

    const lookup = normalizeLookup(request.lookup)
    const surfaces = normalizeSelection(request.selection.surfaces, CHARACTER_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: CHARACTER_UPDATE_CORE_SURFACES,
      mediaSurfaces: CHARACTER_UPDATE_MEDIA_SURFACES,
      relationSurfaces: CHARACTER_UPDATE_RELATION_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    const bundle = await this.scraperService.character.scrape(request.profileId, lookup)
    const incoming = buildCharacterIncoming(bundle, lookup)
    const relationGraph =
      selection.relationSurfaces.length > 0 && bundle
        ? buildCharacterGraph(bundle, lookup)
        : undefined
    const current = loadCharacterCurrent(this.dbService.client, request.rootId, selection)
    const plan = buildCharacterPlan({
      current,
      incoming,
      relationGraph,
      selection,
      policy
    })

    const applyResult = this.dbService.client.transaction((tx) =>
      applyCharacterPlan(tx, request.rootId, plan, this.persistHandlers)
    )

    const warnings = await flushPendingAssets(this.dbService, applyResult.pendingAssets)
    if (warnings.length > 0) {
      log.warn('Character update completed with asset warnings.', {
        warningsItemsText: warnings.map((warning) => warning.message).join(' | ')
      })
    }
  }
}
