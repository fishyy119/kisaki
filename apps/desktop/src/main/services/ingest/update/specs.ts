/**
 * Per-entity ingest update specs.
 *
 * One entry per content entity declares the facts the update engine consumes:
 * lookup resolution, scrape channel, planning projection (selection, incoming,
 * relation graph), and the in-transaction apply with its warning construction.
 * The flow itself lives once in `engine.ts`; adding an entity type is one
 * entry here plus its `update/<entity>/` pipeline segments.
 */

import type { DbContext, DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { ContentEntityType, MediaType } from '@shared/entity-types'
import type { IngestWarning } from '@shared/ingest'
import type { IngestUpdatePolicy } from '@shared/ingest/update'
import {
  ANIME_UPDATE_CORE_SURFACES,
  ANIME_UPDATE_MEDIA_SURFACES,
  ANIME_UPDATE_RELATION_SURFACES,
  ANIME_UPDATE_SURFACE_KEYS,
  CHARACTER_UPDATE_CORE_SURFACES,
  CHARACTER_UPDATE_MEDIA_SURFACES,
  CHARACTER_UPDATE_RELATION_SURFACES,
  CHARACTER_UPDATE_SURFACE_KEYS,
  COMIC_UPDATE_CORE_SURFACES,
  COMIC_UPDATE_MEDIA_SURFACES,
  COMIC_UPDATE_RELATION_SURFACES,
  COMIC_UPDATE_SURFACE_KEYS,
  COMPANY_UPDATE_CORE_SURFACES,
  COMPANY_UPDATE_MEDIA_SURFACES,
  COMPANY_UPDATE_SURFACE_KEYS,
  GAME_UPDATE_CORE_SURFACES,
  GAME_UPDATE_MEDIA_SURFACES,
  GAME_UPDATE_RELATION_SURFACES,
  GAME_UPDATE_SURFACE_KEYS,
  NOVEL_UPDATE_CORE_SURFACES,
  NOVEL_UPDATE_MEDIA_SURFACES,
  NOVEL_UPDATE_RELATION_SURFACES,
  NOVEL_UPDATE_SURFACE_KEYS,
  PERSON_UPDATE_CORE_SURFACES,
  PERSON_UPDATE_MEDIA_SURFACES,
  PERSON_UPDATE_SURFACE_KEYS,
  type AnimeUpdateRequest,
  type CharacterUpdateRequest,
  type ComicUpdateRequest,
  type CompanyUpdateRequest,
  type GameUpdateRequest,
  type IngestUpdateRequest,
  type NovelUpdateRequest,
  type PersonUpdateRequest
} from '@shared/ingest/update'
import type {
  AnimeScraperLookup,
  ComicScraperLookup,
  GameScraperLookup,
  NovelScraperLookup,
  ScrapedAnimeBundle,
  ScrapedCharacterBundle,
  ScrapedComicBundle,
  ScrapedCompanyBundle,
  ScrapedGameBundle,
  ScrapedNovelBundle,
  ScrapedPersonBundle,
  ScraperLookup
} from '@shared/scraper'
import type { PendingAssetTask } from '../assets'
import {
  buildAnimeGraph,
  buildCharacterGraph,
  buildComicGraph,
  buildDirectAnimeGraph,
  buildDirectComicGraph,
  buildDirectGameGraph,
  buildDirectNovelGraph,
  buildGameGraph,
  buildNovelGraph
} from '../graph'
import { normalizeLookup } from '../normalization'
import type { IngestPersisters } from '../persist'
import { createUnresolvedRelatedEntriesWarning } from '../persist/media-relations'
import { applyAnimePlan, buildAnimeIncoming, buildAnimePlan, loadAnimeCurrent } from './anime'
import { resolveAnimeUpdateLookup } from './anime/lookup'
import {
  applyCharacterPlan,
  buildCharacterIncoming,
  buildCharacterPlan,
  loadCharacterCurrent
} from './character'
import { applyComicPlan, buildComicIncoming, buildComicPlan, loadComicCurrent } from './comic'
import { resolveComicUpdateLookup } from './comic/lookup'
import {
  applyCompanyPlan,
  buildCompanyIncoming,
  buildCompanyPlan,
  loadCompanyCurrent
} from './company'
import { applyGamePlan, buildGameIncoming, buildGamePlan, loadGameCurrent } from './game'
import { resolveGameUpdateLookup } from './game/lookup'
import {
  ANIME_LINK_TOPOLOGY,
  CHARACTER_LINK_TOPOLOGY,
  COMIC_LINK_TOPOLOGY,
  createLinkDegradeWarnings,
  GAME_LINK_TOPOLOGY,
  NOVEL_LINK_TOPOLOGY,
  type LinkTopologySpec
} from './link-topology'
import { applyNovelPlan, buildNovelIncoming, buildNovelPlan, loadNovelCurrent } from './novel'
import { resolveNovelUpdateLookup } from './novel/lookup'
import { applyPersonPlan, buildPersonIncoming, buildPersonPlan, loadPersonCurrent } from './person'
import { normalizeSelection, resolveUpdateSelection } from './shared/selection'
import type {
  UpdateCurrentSelection,
  UpdateLinkApplyResult,
  UpdateResolvedSelection
} from './types'

/** Planning facts one entity carries from projection into its transaction. */
type PlanningOf<TBuildPlan extends (args: never) => unknown> = Omit<
  Parameters<TBuildPlan>[0],
  'current' | 'policy'
>

/**
 * Per-entity type correlation for the update flow.
 */
export interface IngestUpdateTypeMap {
  game: {
    request: GameUpdateRequest
    lookup: GameScraperLookup
    bundle: ScrapedGameBundle
    planning: PlanningOf<typeof buildGamePlan>
  }
  anime: {
    request: AnimeUpdateRequest
    lookup: AnimeScraperLookup
    bundle: ScrapedAnimeBundle
    planning: PlanningOf<typeof buildAnimePlan>
  }
  comic: {
    request: ComicUpdateRequest
    lookup: ComicScraperLookup
    bundle: ScrapedComicBundle
    planning: PlanningOf<typeof buildComicPlan>
  }
  novel: {
    request: NovelUpdateRequest
    lookup: NovelScraperLookup
    bundle: ScrapedNovelBundle
    planning: PlanningOf<typeof buildNovelPlan>
  }
  person: {
    request: PersonUpdateRequest
    lookup: ScraperLookup
    bundle: ScrapedPersonBundle
    planning: PlanningOf<typeof buildPersonPlan>
  }
  company: {
    request: CompanyUpdateRequest
    lookup: ScraperLookup
    bundle: ScrapedCompanyBundle
    planning: PlanningOf<typeof buildCompanyPlan>
  }
  character: {
    request: CharacterUpdateRequest
    lookup: ScraperLookup
    bundle: ScrapedCharacterBundle
    planning: PlanningOf<typeof buildCharacterPlan>
  }
}

// Correlated aliases carry the base shapes the engine reads.
export type IngestUpdateRequestOf<T extends ContentEntityType> = IngestUpdateTypeMap[T]['request'] &
  IngestUpdateRequest<string>
/** The surface key union an entity's update request selects from. */
export type IngestUpdateSurfaceOf<T extends ContentEntityType> =
  IngestUpdateTypeMap[T]['request'] extends IngestUpdateRequest<infer TSurface, infer _TLookup>
    ? TSurface
    : never
export type IngestUpdateLookup<T extends ContentEntityType> = IngestUpdateTypeMap[T]['lookup'] &
  ScraperLookup
export type IngestUpdateBundle<T extends ContentEntityType> = IngestUpdateTypeMap[T]['bundle']
export type IngestUpdatePlanning<T extends ContentEntityType> = IngestUpdateTypeMap[T]['planning']

/** Services a spec may reach; the engine provides one instance to all. */
export interface IngestUpdateDeps {
  dbService: DbService
  scraperService: ScraperService
  persist: IngestPersisters
}

/** What one in-transaction apply produced for the engine to finish with. */
export interface IngestUpdateApplied {
  pendingAssets: PendingAssetTask[]
  warnings: IngestWarning[]
}

export interface IngestUpdateSpec<T extends ContentEntityType> {
  /** Task-run output names the updated entity with this key. */
  outputIdKey: `${T}Id`
  resolveLookup(deps: IngestUpdateDeps, request: IngestUpdateRequestOf<T>): IngestUpdateLookup<T>
  scrape(
    deps: IngestUpdateDeps,
    profileId: string,
    lookup: IngestUpdateLookup<T>,
    signal: AbortSignal | undefined
  ): Promise<IngestUpdateBundle<T> | null>
  /** Selection resolution and incoming projection: pure pre-write planning. */
  plan(
    deps: IngestUpdateDeps,
    args: {
      request: IngestUpdateRequestOf<T>
      lookup: IngestUpdateLookup<T>
      bundle: IngestUpdateBundle<T> | null
    }
  ): { surfaces: readonly string[]; planning: IngestUpdatePlanning<T> }
  /** Read, plan, and apply inside the engine's transaction, with warnings. */
  apply(
    deps: IngestUpdateDeps,
    tx: DbContext,
    args: {
      rootId: string
      planning: IngestUpdatePlanning<T>
      policy: IngestUpdatePolicy
    }
  ): IngestUpdateApplied
}

/**
 * Media update entries share one plan/apply shape: resolve the selection over
 * the media's surface constants, project incoming facts, build the relation
 * graph when relation surfaces are selected, then load-plan-apply inside the
 * transaction and report link degrades plus unresolved related entries. This
 * factory states that shape once; each media entry passes only its facts, and
 * the registry-level `satisfies` validates every produced spec concretely.
 */
function createMediaUpdateSpec<
  T extends ContentEntityType & MediaType,
  TSurface extends string,
  TCoreSurface extends TSurface,
  TMediaSurface extends TSurface,
  TRelationSurface extends TSurface,
  TFactSource extends string,
  TLinkKind extends string,
  TGraph,
  TIncoming,
  TCurrent,
  TPlan extends { degradedLinks: TLinkKind[] }
>(facts: {
  type: T
  resolveLookup: (
    deps: IngestUpdateDeps,
    request: IngestUpdateRequestOf<T>
  ) => IngestUpdateLookup<T>
  scrape: (
    deps: IngestUpdateDeps,
    profileId: string,
    lookup: IngestUpdateLookup<T>,
    signal: AbortSignal | undefined
  ) => Promise<IngestUpdateBundle<T> | null>
  surfaceKeys: readonly TSurface[]
  coreSurfaces: readonly TCoreSurface[]
  mediaSurfaces: readonly TMediaSurface[]
  relationSurfaces: readonly TRelationSurface[]
  buildIncoming: (bundle: IngestUpdateBundle<T> | null, lookup: IngestUpdateLookup<T>) => TIncoming
  buildGraph: (bundle: IngestUpdateBundle<T>, lookup: IngestUpdateLookup<T>) => TGraph
  buildDirectGraph: (lookup: IngestUpdateLookup<T>) => TGraph
  loadCurrent: (
    tx: DbContext,
    rootId: string,
    selection: UpdateCurrentSelection<TCoreSurface>
  ) => TCurrent
  buildPlan: (context: {
    current: TCurrent
    policy: IngestUpdatePolicy
    selection: UpdateResolvedSelection<TSurface, TCoreSurface, TMediaSurface, TRelationSurface>
    incoming: TIncoming
    relationGraph: TGraph | undefined
  }) => TPlan
  applyPlan: (
    tx: DbContext,
    rootId: string,
    plan: TPlan,
    persist: IngestPersisters
  ) => UpdateLinkApplyResult<TLinkKind>
  linkTopology: Record<TLinkKind, LinkTopologySpec<TRelationSurface, TFactSource>>
}) {
  return {
    outputIdKey: `${facts.type}Id` as const,
    resolveLookup: facts.resolveLookup,
    scrape: facts.scrape,
    plan: (
      _deps: IngestUpdateDeps,
      args: {
        request: IngestUpdateRequestOf<T>
        lookup: IngestUpdateLookup<T>
        bundle: IngestUpdateBundle<T> | null
      }
    ) => {
      const surfaces = normalizeSelection(args.request.selection.surfaces, facts.surfaceKeys)
      const selection = resolveUpdateSelection({
        surfaces,
        coreSurfaces: facts.coreSurfaces,
        mediaSurfaces: facts.mediaSurfaces,
        relationSurfaces: facts.relationSurfaces
      })
      const incoming = facts.buildIncoming(args.bundle, args.lookup)
      const relationGraph =
        selection.relationSurfaces.length > 0
          ? args.bundle
            ? facts.buildGraph(args.bundle, args.lookup)
            : facts.buildDirectGraph(args.lookup)
          : undefined
      return { surfaces, planning: { selection, incoming, relationGraph } }
    },
    apply: (
      deps: IngestUpdateDeps,
      tx: DbContext,
      args: {
        rootId: string
        planning: {
          selection: UpdateResolvedSelection<
            TSurface,
            TCoreSurface,
            TMediaSurface,
            TRelationSurface
          >
          incoming: TIncoming
          relationGraph: TGraph | undefined
        }
        policy: IngestUpdatePolicy
      }
    ) => {
      const current = facts.loadCurrent(tx, args.rootId, args.planning.selection)
      const plan = facts.buildPlan({ current, policy: args.policy, ...args.planning })
      const applyResult = facts.applyPlan(tx, args.rootId, plan, deps.persist)
      return {
        pendingAssets: applyResult.pendingAssets,
        warnings: [
          ...createLinkDegradeWarnings({
            topology: facts.linkTopology,
            degraded: plan.degradedLinks,
            preservedRows: applyResult.preservedLinkRows
          }),
          ...(applyResult.unresolvedRelatedEntries
            ? [createUnresolvedRelatedEntriesWarning(applyResult.unresolvedRelatedEntries)]
            : [])
        ]
      }
    }
  }
}

export const INGEST_UPDATE_SPECS = {
  game: createMediaUpdateSpec({
    type: 'game',
    resolveLookup: (deps, request) => resolveGameUpdateLookup(deps.dbService, request),
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.game.scrape(profileId, lookup, { signal }),
    surfaceKeys: GAME_UPDATE_SURFACE_KEYS,
    coreSurfaces: GAME_UPDATE_CORE_SURFACES,
    mediaSurfaces: GAME_UPDATE_MEDIA_SURFACES,
    relationSurfaces: GAME_UPDATE_RELATION_SURFACES,
    buildIncoming: buildGameIncoming,
    buildGraph: buildGameGraph,
    buildDirectGraph: buildDirectGameGraph,
    loadCurrent: loadGameCurrent,
    buildPlan: buildGamePlan,
    applyPlan: applyGamePlan,
    linkTopology: GAME_LINK_TOPOLOGY
  }),
  anime: createMediaUpdateSpec({
    type: 'anime',
    resolveLookup: (deps, request) => resolveAnimeUpdateLookup(deps.dbService, request),
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.anime.scrape(profileId, lookup, { signal }),
    surfaceKeys: ANIME_UPDATE_SURFACE_KEYS,
    coreSurfaces: ANIME_UPDATE_CORE_SURFACES,
    mediaSurfaces: ANIME_UPDATE_MEDIA_SURFACES,
    relationSurfaces: ANIME_UPDATE_RELATION_SURFACES,
    buildIncoming: buildAnimeIncoming,
    buildGraph: buildAnimeGraph,
    buildDirectGraph: buildDirectAnimeGraph,
    loadCurrent: loadAnimeCurrent,
    buildPlan: buildAnimePlan,
    applyPlan: applyAnimePlan,
    linkTopology: ANIME_LINK_TOPOLOGY
  }),
  comic: createMediaUpdateSpec({
    type: 'comic',
    resolveLookup: (deps, request) => resolveComicUpdateLookup(deps.dbService, request),
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.comic.scrape(profileId, lookup, { signal }),
    surfaceKeys: COMIC_UPDATE_SURFACE_KEYS,
    coreSurfaces: COMIC_UPDATE_CORE_SURFACES,
    mediaSurfaces: COMIC_UPDATE_MEDIA_SURFACES,
    relationSurfaces: COMIC_UPDATE_RELATION_SURFACES,
    buildIncoming: buildComicIncoming,
    buildGraph: buildComicGraph,
    buildDirectGraph: buildDirectComicGraph,
    loadCurrent: loadComicCurrent,
    buildPlan: buildComicPlan,
    applyPlan: applyComicPlan,
    linkTopology: COMIC_LINK_TOPOLOGY
  }),
  novel: createMediaUpdateSpec({
    type: 'novel',
    resolveLookup: (deps, request) => resolveNovelUpdateLookup(deps.dbService, request),
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.novel.scrape(profileId, lookup, { signal }),
    surfaceKeys: NOVEL_UPDATE_SURFACE_KEYS,
    coreSurfaces: NOVEL_UPDATE_CORE_SURFACES,
    mediaSurfaces: NOVEL_UPDATE_MEDIA_SURFACES,
    relationSurfaces: NOVEL_UPDATE_RELATION_SURFACES,
    buildIncoming: buildNovelIncoming,
    buildGraph: buildNovelGraph,
    buildDirectGraph: buildDirectNovelGraph,
    loadCurrent: loadNovelCurrent,
    buildPlan: buildNovelPlan,
    applyPlan: applyNovelPlan,
    linkTopology: NOVEL_LINK_TOPOLOGY
  }),
  person: {
    outputIdKey: 'personId',
    resolveLookup: (_deps, request) => normalizeLookup(request.lookup),
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.person.scrape(profileId, lookup, { signal }),
    plan: (_deps, { request, lookup, bundle }) => {
      const surfaces = normalizeSelection(request.selection.surfaces, PERSON_UPDATE_SURFACE_KEYS)
      const selection = resolveUpdateSelection({
        surfaces,
        coreSurfaces: PERSON_UPDATE_CORE_SURFACES,
        mediaSurfaces: PERSON_UPDATE_MEDIA_SURFACES
      })
      const incoming = buildPersonIncoming(bundle, lookup)
      return { surfaces, planning: { selection, incoming } }
    },
    apply: (_deps, tx, { rootId, planning, policy }) => {
      const current = loadPersonCurrent(tx, rootId, planning.selection)
      const plan = buildPersonPlan({ current, policy, ...planning })
      const applyResult = applyPersonPlan(tx, rootId, plan)
      return { pendingAssets: applyResult.pendingAssets, warnings: [] }
    }
  },
  company: {
    outputIdKey: 'companyId',
    resolveLookup: (_deps, request) => normalizeLookup(request.lookup),
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.company.scrape(profileId, lookup, { signal }),
    plan: (_deps, { request, lookup, bundle }) => {
      const surfaces = normalizeSelection(request.selection.surfaces, COMPANY_UPDATE_SURFACE_KEYS)
      const selection = resolveUpdateSelection({
        surfaces,
        coreSurfaces: COMPANY_UPDATE_CORE_SURFACES,
        mediaSurfaces: COMPANY_UPDATE_MEDIA_SURFACES
      })
      const incoming = buildCompanyIncoming(bundle, lookup)
      return { surfaces, planning: { selection, incoming } }
    },
    apply: (_deps, tx, { rootId, planning, policy }) => {
      const current = loadCompanyCurrent(tx, rootId, planning.selection)
      const plan = buildCompanyPlan({ current, policy, ...planning })
      const applyResult = applyCompanyPlan(tx, rootId, plan)
      return { pendingAssets: applyResult.pendingAssets, warnings: [] }
    }
  },
  character: {
    outputIdKey: 'characterId',
    resolveLookup: (_deps, request) => normalizeLookup(request.lookup),
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.character.scrape(profileId, lookup, { signal }),
    plan: (_deps, { request, lookup, bundle }) => {
      const surfaces = normalizeSelection(request.selection.surfaces, CHARACTER_UPDATE_SURFACE_KEYS)
      const selection = resolveUpdateSelection({
        surfaces,
        coreSurfaces: CHARACTER_UPDATE_CORE_SURFACES,
        mediaSurfaces: CHARACTER_UPDATE_MEDIA_SURFACES,
        relationSurfaces: CHARACTER_UPDATE_RELATION_SURFACES
      })
      const incoming = buildCharacterIncoming(bundle, lookup)
      const relationGraph =
        selection.relationSurfaces.length > 0 && bundle
          ? buildCharacterGraph(bundle, lookup)
          : undefined
      return { surfaces, planning: { selection, incoming, relationGraph } }
    },
    apply: (deps, tx, { rootId, planning, policy }) => {
      const current = loadCharacterCurrent(tx, rootId, planning.selection)
      const plan = buildCharacterPlan({ current, policy, ...planning })
      const applyResult = applyCharacterPlan(tx, rootId, plan, deps.persist)
      return {
        pendingAssets: applyResult.pendingAssets,
        warnings: createLinkDegradeWarnings({
          topology: CHARACTER_LINK_TOPOLOGY,
          degraded: plan.degradedLinks,
          preservedRows: applyResult.preservedLinkRows
        })
      }
    }
  }
} as const satisfies { [T in ContentEntityType]: IngestUpdateSpec<T> }
