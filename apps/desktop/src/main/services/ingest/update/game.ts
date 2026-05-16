import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { IngestPersistHandlers } from '../persist'
import { flushPendingAssets } from '../assets'
import { buildDirectGameGraph, buildGameGraph } from '../graph'
import {
  GAME_UPDATE_CORE_SURFACES,
  GAME_UPDATE_MEDIA_SURFACES,
  GAME_UPDATE_RELATION_SURFACES,
  GAME_UPDATE_SURFACE_KEYS,
  type GameUpdateRequest
} from '@shared/ingest/update'
import { applyGamePlan } from './apply'
import { loadGameCurrent } from './current'
import { buildGameIncoming } from './incoming'
import { buildGamePlan } from './plan'
import {
  normalizeLookup,
  normalizePolicy,
  normalizeSelection,
  resolveUpdateSelection
} from './utils'

const log = createLogger('Ingest')

export class GameUpdateHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly scraperService: ScraperService,
    private readonly persistHandlers: IngestPersistHandlers
  ) {}

  async fromScraper(request: GameUpdateRequest): Promise<void> {
    if (!request.rootId) {
      throw new Error('Update rootId is required')
    }
    if (!request.profileId) {
      throw new Error('Update profileId is required')
    }

    const lookup = normalizeLookup(request.lookup)
    const surfaces = normalizeSelection(request.selection.surfaces, GAME_UPDATE_SURFACE_KEYS)
    const selection = resolveUpdateSelection({
      surfaces,
      coreSurfaces: GAME_UPDATE_CORE_SURFACES,
      mediaSurfaces: GAME_UPDATE_MEDIA_SURFACES,
      relationSurfaces: GAME_UPDATE_RELATION_SURFACES
    })
    const policy = normalizePolicy(request.policy)

    const bundle = await this.scraperService.game.scrape(request.profileId, lookup)
    const incoming = buildGameIncoming(bundle, lookup)
    const relationGraph =
      selection.relationSurfaces.length > 0
        ? bundle
          ? buildGameGraph(bundle, lookup)
          : buildDirectGameGraph(lookup)
        : undefined
    const current = loadGameCurrent(this.dbService.client, request.rootId, selection)
    const plan = buildGamePlan({
      current,
      incoming,
      relationGraph,
      selection,
      policy
    })

    const applyResult = this.dbService.client.transaction((tx) =>
      applyGamePlan(tx, request.rootId, plan, this.persistHandlers)
    )

    const warnings = await flushPendingAssets(this.dbService, applyResult.pendingAssets)
    if (warnings.length > 0) {
      log.warn('Game update completed with asset warnings.', {
        warningsItemsText: warnings.map((warning) => warning.message).join(' | ')
      })
    }
  }
}
