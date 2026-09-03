/**
 * Statistics Composable
 *
 * Provider/Consumer pattern for statistics data.
 * Handles report type switching (via route) and period navigation.
 * Date range is computed based on report type and current period; period
 * reports also load the previous period's sessions for comparison.
 * Data loads during navigation (route query); period switching triggers a
 * non-blocking SWR reload.
 *
 * Sessions from every media type merge into one entity-keyed stream: each
 * session carries an `entityKey` (`<mediaType>:<id>`) that resolves through
 * the `entities` map, so charts, rankings, and stats stay media-agnostic.
 * A media filter scopes every derived stream in memory; the loaded snapshot
 * always holds all media, so switching scope never reloads.
 */

import { provide, inject, ref, computed, type InjectionKey, type ComputedRef, type Ref } from 'vue'
import { gte, lte, and, count, inArray, eq, getTableName, type SQL } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { db } from '@renderer/core/db'
import { defineRouteQuery } from '@renderer/core/query'
import type { TableName } from '@shared/db/table-names'
import {
  MEDIA_TYPES,
  UNIT_MEDIA_TYPES,
  parseMediaType,
  type MediaType,
  type UnitMediaType
} from '@shared/entity-types'
import type { Collection } from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import { visibilityView } from '@renderer/stores'
import { computeStats, type GlobalStatisticsStats } from '@renderer/utils/statistics'
import {
  calculatePeriodDateRange,
  formatPeriodDisplay,
  getCurrentPeriod,
  shiftPeriod
} from '../period'
import type { ReportType, Period, PeriodDisplay } from '../types'

// =============================================================================
// Data Types
// =============================================================================

/** One session span, keyed to its media entity. */
export interface StatisticsSessionEntry {
  id: string
  entityKey: string
  startedAt: Date
  endedAt: Date
}

/** Display facts of one media entity the sessions reference. */
export interface StatisticsEntity {
  key: string
  mediaType: MediaType
  id: string
  name: string
  coverFile: string | null
}

function buildEntityKey(mediaType: MediaType, id: string): string {
  return `${mediaType}:${id}`
}

/** Media type segment of an entity key; this module owns the key format. */
export function mediaTypeOfEntityKey(entityKey: string): MediaType | null {
  return parseMediaType(entityKey.slice(0, entityKey.indexOf(':')))
}

/** Media scope of a report; `all` merges every media type. */
export type StatisticsMediaFilter = MediaType | 'all'

function filterSessionsByMedia(
  sessions: StatisticsSessionEntry[],
  filter: StatisticsMediaFilter
): StatisticsSessionEntry[] {
  if (filter === 'all') return sessions
  const prefix = `${filter}:`
  return sessions.filter((session) => session.entityKey.startsWith(prefix))
}

// =============================================================================
// Context Type
// =============================================================================

export interface StatisticsContext {
  // Report type (derived from the loaded route query)
  reportType: ComputedRef<ReportType>

  // Period state (for weekly/monthly/yearly)
  currentPeriod: ComputedRef<Period>
  setCurrentPeriod: (period: Period) => void
  periodDisplay: ComputedRef<PeriodDisplay>

  // Media scope; writable, applied in memory over the loaded snapshot
  mediaFilter: Ref<StatisticsMediaFilter>

  // Computed date range based on report type and period (overview: past year)
  dateRange: ComputedRef<{ start: Date; end: Date }>

  // Data - filtered by dateRange and media scope
  sessions: ComputedRef<StatisticsSessionEntry[]>
  entities: ComputedRef<Map<string, StatisticsEntity>>
  collections: ComputedRef<Map<string, Collection>>
  stats: ComputedRef<GlobalStatisticsStats>

  // Previous period sessions for comparison; null for overview
  previousSessions: ComputedRef<StatisticsSessionEntry[] | null>

  // For overview: all-time data for stats/distributions/rankings
  allTimeSessions: ComputedRef<StatisticsSessionEntry[]>
  allTimeStats: ComputedRef<GlobalStatisticsStats>

  // Completed units per unit-bearing media (period-dated / all-time state)
  unitCounts: ComputedRef<Record<UnitMediaType, number>>
  allTimeUnitCounts: ComputedRef<Record<UnitMediaType, number>>

  // Link data for local computation, entity side keyed like sessions
  entityCollectionLinks: ComputedRef<{ entityId: string; collectionId: string }[]>

  /** Set by a failed navigation load; the report pages render it. */
  error: Ref<string | null>
}

// =============================================================================
// Injection Key
// =============================================================================

export const StatisticsKey: InjectionKey<StatisticsContext> = Symbol('statistics')

// =============================================================================
// Data Fetchers
// =============================================================================

interface FetchedData {
  sessions: StatisticsSessionEntry[]
  entities: StatisticsEntity[]
  collections: Collection[]
  entityCollectionLinks: { entityId: string; collectionId: string }[]
  unitCounts: Record<UnitMediaType, number>
}

/**
 * Per-media-type wiring for the session stream: which session table carries the
 * spans, which media table names them, and which collection link table joins
 * them to collections.
 */
interface MediaStatisticsSource {
  sessions: SQLiteTable & {
    id: SQLiteColumn
    startedAt: SQLiteColumn
    endedAt: SQLiteColumn
  }
  sessionEntityId: SQLiteColumn
  entities: SQLiteTable & {
    id: SQLiteColumn
    name: SQLiteColumn
    coverFile: SQLiteColumn
    isNsfw: SQLiteColumn
  }
  collectionLinks: SQLiteTable & { collectionId: SQLiteColumn }
  collectionLinkEntityId: SQLiteColumn
}

const MEDIA_STATISTICS_SOURCES = {
  game: {
    sessions: schema.gameSessions,
    sessionEntityId: schema.gameSessions.gameId,
    entities: schema.games,
    collectionLinks: schema.collectionGameLinks,
    collectionLinkEntityId: schema.collectionGameLinks.gameId
  },
  anime: {
    sessions: schema.animeSessions,
    sessionEntityId: schema.animeSessions.animeId,
    entities: schema.animes,
    collectionLinks: schema.collectionAnimeLinks,
    collectionLinkEntityId: schema.collectionAnimeLinks.animeId
  },
  comic: {
    sessions: schema.comicSessions,
    sessionEntityId: schema.comicSessions.comicId,
    entities: schema.comics,
    collectionLinks: schema.collectionComicLinks,
    collectionLinkEntityId: schema.collectionComicLinks.comicId
  },
  novel: {
    sessions: schema.novelSessions,
    sessionEntityId: schema.novelSessions.novelId,
    entities: schema.novels,
    collectionLinks: schema.collectionNovelLinks,
    collectionLinkEntityId: schema.collectionNovelLinks.novelId
  }
} as const satisfies Record<MediaType, MediaStatisticsSource>

/**
 * Per-media wiring for unit-consumption facts: which unit table carries the
 * completion columns and which media table gates NSFW. Game has no entry —
 * its consumption unit is the session itself, already counted above.
 */
interface UnitStatisticsSource {
  units: SQLiteTable
  unitEntityId: SQLiteColumn
  completed: SQLiteColumn
  completedAt: SQLiteColumn
  entities: SQLiteTable & { id: SQLiteColumn; isNsfw: SQLiteColumn }
}

const UNIT_STATISTICS_SOURCES = {
  anime: {
    units: schema.animeEpisodes,
    unitEntityId: schema.animeEpisodes.animeId,
    completed: schema.animeEpisodes.watched,
    completedAt: schema.animeEpisodes.watchedAt,
    entities: schema.animes
  },
  comic: {
    units: schema.comicChapters,
    unitEntityId: schema.comicChapters.comicId,
    completed: schema.comicChapters.read,
    completedAt: schema.comicChapters.readAt,
    entities: schema.comics
  },
  novel: {
    units: schema.novelVolumes,
    unitEntityId: schema.novelVolumes.novelId,
    completed: schema.novelVolumes.read,
    completedAt: schema.novelVolumes.readAt,
    entities: schema.novels
  }
} as const satisfies Record<UnitMediaType, UnitStatisticsSource>

function emptyUnitCounts(): Record<UnitMediaType, number> {
  return Object.fromEntries(UNIT_MEDIA_TYPES.map((mediaType) => [mediaType, 0])) as Record<
    UnitMediaType,
    number
  >
}

/**
 * Count completed units per unit-bearing media type.
 *
 * Period ranges count completions whose timestamp falls inside the range;
 * catch-up and imported marks carry no timestamp, so they belong to no
 * period. The all-time query (null range) counts the completion state alone,
 * so undated marks still count in the overview.
 */
async function fetchUnitCounts(
  dateRange: { start: Date; end: Date } | null,
  showNsfw: boolean
): Promise<Record<UnitMediaType, number>> {
  const perType = await Promise.all(
    UNIT_MEDIA_TYPES.map(async (mediaType) => {
      const source: UnitStatisticsSource = UNIT_STATISTICS_SOURCES[mediaType]
      const conditions: (SQL | undefined)[] = [eq(source.completed, true)]
      if (dateRange) {
        conditions.push(
          gte(source.completedAt, dateRange.start),
          lte(source.completedAt, dateRange.end)
        )
      }
      if (!showNsfw) conditions.push(eq(source.entities.isNsfw, false))

      const rows = await db
        .select({ value: count() })
        .from(source.units)
        .innerJoin(source.entities, eq(source.unitEntityId, source.entities.id))
        .where(and(...conditions))

      return [mediaType, rows[0]?.value ?? 0] as const
    })
  )

  return Object.fromEntries(perType) as Record<UnitMediaType, number>
}

async function fetchMediaSessionsInRange(
  mediaType: MediaType,
  dateRange: { start: Date; end: Date } | null,
  showNsfw: boolean
): Promise<StatisticsSessionEntry[]> {
  const source: MediaStatisticsSource = MEDIA_STATISTICS_SOURCES[mediaType]
  const conditions: (SQL | undefined)[] = dateRange
    ? [gte(source.sessions.startedAt, dateRange.start), lte(source.sessions.endedAt, dateRange.end)]
    : []
  if (!showNsfw) conditions.push(eq(source.entities.isNsfw, false))

  const rows = await db
    .select({
      id: source.sessions.id,
      entityId: source.sessionEntityId,
      startedAt: source.sessions.startedAt,
      endedAt: source.sessions.endedAt
    })
    .from(source.sessions)
    .innerJoin(source.entities, eq(source.sessionEntityId, source.entities.id))
    .where(conditions.length ? and(...conditions) : undefined)

  return rows.map((row) => ({
    id: row.id as string,
    entityKey: buildEntityKey(mediaType, row.entityId as string),
    startedAt: row.startedAt as Date,
    endedAt: row.endedAt as Date
  }))
}

async function fetchSessionsInRange(
  dateRange: { start: Date; end: Date } | null,
  showNsfw: boolean
): Promise<StatisticsSessionEntry[]> {
  const perType = await Promise.all(
    MEDIA_TYPES.map((mediaType) => fetchMediaSessionsInRange(mediaType, dateRange, showNsfw))
  )

  return perType.flat().sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
}

function entityIdsOf(sessions: StatisticsSessionEntry[], mediaType: MediaType): string[] {
  const prefix = `${mediaType}:`
  return [
    ...new Set(
      sessions
        .filter((session) => session.entityKey.startsWith(prefix))
        .map((session) => session.entityKey.slice(prefix.length))
    )
  ]
}

async function fetchMediaEntities(
  mediaType: MediaType,
  entityIds: string[],
  showNsfw: boolean
): Promise<StatisticsEntity[]> {
  if (entityIds.length === 0) return []
  const source: MediaStatisticsSource = MEDIA_STATISTICS_SOURCES[mediaType]

  const rows = await db
    .select({
      id: source.entities.id,
      name: source.entities.name,
      coverFile: source.entities.coverFile
    })
    .from(source.entities)
    .where(
      and(
        inArray(source.entities.id, entityIds),
        showNsfw ? undefined : eq(source.entities.isNsfw, false)
      )
    )

  return rows.map((row) => ({
    key: buildEntityKey(mediaType, row.id as string),
    mediaType,
    id: row.id as string,
    name: row.name as string,
    coverFile: row.coverFile as string | null
  }))
}

async function fetchMediaCollectionLinks(
  mediaType: MediaType,
  entityIds: string[],
  showNsfw: boolean
): Promise<{ entityId: string; collectionId: string }[]> {
  if (entityIds.length === 0) return []
  const source: MediaStatisticsSource = MEDIA_STATISTICS_SOURCES[mediaType]

  const rows = await db
    .select({
      entityId: source.collectionLinkEntityId,
      collectionId: source.collectionLinks.collectionId
    })
    .from(source.collectionLinks)
    .innerJoin(schema.collections, eq(source.collectionLinks.collectionId, schema.collections.id))
    .where(
      and(
        inArray(source.collectionLinkEntityId, entityIds),
        showNsfw ? undefined : eq(schema.collections.isNsfw, false)
      )
    )

  return rows.map((row) => ({
    entityId: buildEntityKey(mediaType, row.entityId as string),
    collectionId: row.collectionId as string
  }))
}

async function fetchStatisticsData(
  dateRange: { start: Date; end: Date } | null,
  showNsfw: boolean
): Promise<FetchedData> {
  // Unit completions are facts of their own: marking paths date units without
  // creating sessions, so the counts never derive from the session stream.
  const [sessions, unitCounts] = await Promise.all([
    fetchSessionsInRange(dateRange, showNsfw),
    fetchUnitCounts(dateRange, showNsfw)
  ])

  if (sessions.length === 0) {
    return {
      sessions: [],
      entities: [],
      collections: [],
      entityCollectionLinks: [],
      unitCounts
    }
  }

  const entityIdsByType = new Map(
    MEDIA_TYPES.map((mediaType) => [mediaType, entityIdsOf(sessions, mediaType)] as const)
  )

  // Parallel fetch all related data
  const [entityGroups, linkGroups, collections] = await Promise.all([
    Promise.all(
      MEDIA_TYPES.map((mediaType) =>
        fetchMediaEntities(mediaType, entityIdsByType.get(mediaType) ?? [], showNsfw)
      )
    ),
    Promise.all(
      MEDIA_TYPES.map((mediaType) =>
        fetchMediaCollectionLinks(mediaType, entityIdsByType.get(mediaType) ?? [], showNsfw)
      )
    ),
    db
      .select()
      .from(schema.collections)
      .where(showNsfw ? undefined : eq(schema.collections.isNsfw, false))
  ])

  return {
    sessions,
    entities: entityGroups.flat(),
    collections,
    entityCollectionLinks: linkGroups.flat(),
    unitCounts
  }
}

// =============================================================================
// Route Query
// =============================================================================

interface StatisticsData {
  reportType: ReportType
  period: Period
  current: FetchedData
  previousSessions: StatisticsSessionEntry[] | null
  allTime: FetchedData | null
}

/** In-page inputs of a report; the period resets whenever the report type changes. */
interface StatisticsParams {
  period: Period
}

// Media scope persists across report types and navigations; it filters the
// loaded snapshot in memory, so changing it never reloads.
const selectedMediaFilter = ref<StatisticsMediaFilter>('all')

/** Everything a report reads: session spans, unit completions, the media rows that name them, and their collections. */
const STATISTICS_TABLES: readonly TableName[] = [
  ...MEDIA_TYPES.flatMap((mediaType) => {
    const source: MediaStatisticsSource = MEDIA_STATISTICS_SOURCES[mediaType]
    return [source.sessions, source.entities, source.collectionLinks]
  }),
  ...UNIT_MEDIA_TYPES.map((mediaType) => UNIT_STATISTICS_SOURCES[mediaType].units),
  schema.collections
].map((table) => getTableName(table) as TableName)

export const statisticsQuery = defineRouteQuery({
  name: 'statistics',
  // Declared by the statistics route manifest on each report page's meta.
  key: (route): ReportType => route.meta.reportType ?? 'overview',
  params: (reportType): StatisticsParams => ({ period: getCurrentPeriod(reportType) }),
  view: visibilityView,
  fetch: async ({ key: reportType, params, view }): Promise<StatisticsData> => {
    const { period } = params
    const dateRange = calculatePeriodDateRange(reportType, period)
    // Overview has no natural predecessor; period reports compare to the
    // previous period and overview additionally loads all-time data.
    const previousRange =
      reportType === 'overview'
        ? null
        : calculatePeriodDateRange(reportType, shiftPeriod(reportType, period, -1))

    const [current, previousSessions, allTime] = await Promise.all([
      fetchStatisticsData(dateRange, view.showNsfw),
      previousRange ? fetchSessionsInRange(previousRange, view.showNsfw) : Promise.resolve(null),
      reportType === 'overview' ? fetchStatisticsData(null, view.showNsfw) : Promise.resolve(null)
    ])

    return { reportType, period, current, previousSessions, allTime }
  },
  invalidate: { tables: STATISTICS_TABLES }
})

// =============================================================================
// Provider Composable
// =============================================================================

/**
 * Provide statistics data context.
 *
 * Data is committed by the route query when the navigation confirms. Period
 * switching (a param), the NSFW preference (the view), and db changes in the
 * read tables trigger a non-blocking SWR reload; derived state (period, date
 * range, display) follows the loaded snapshot so charts and labels always
 * match the sessions on screen.
 */
export function useStatisticsProvider(): StatisticsContext {
  const { data, error, params } = statisticsQuery()

  const reportType = computed<ReportType>(() => data.value?.reportType ?? 'overview')
  const currentPeriod = computed<Period>(() => data.value?.period ?? params.period.value)
  const dateRange = computed(() => calculatePeriodDateRange(reportType.value, currentPeriod.value))
  const periodDisplay = computed(() => formatPeriodDisplay(reportType.value, currentPeriod.value))

  const setCurrentPeriod = (period: Period): void => {
    params.period.value = period
  }

  // Computed data maps, scoped by the media filter
  const sessions = computed(() =>
    filterSessionsByMedia(data.value?.current.sessions ?? [], selectedMediaFilter.value)
  )

  const entities = computed(() => {
    const map = new Map<string, StatisticsEntity>()
    // Merge entities from both data sources for overview
    for (const entity of data.value?.current.entities ?? []) {
      map.set(entity.key, entity)
    }
    for (const entity of data.value?.allTime?.entities ?? []) {
      map.set(entity.key, entity)
    }
    return map
  })

  const collections = computed(() => {
    const map = new Map<string, Collection>()
    for (const collection of data.value?.current.collections ?? []) {
      map.set(collection.id, collection)
    }
    return map
  })

  // Expose link data for local computation in components
  const entityCollectionLinks = computed(() => {
    if (reportType.value === 'overview') {
      return data.value?.allTime?.entityCollectionLinks ?? []
    }
    return data.value?.current.entityCollectionLinks ?? []
  })

  const getEntityName = (entityKey: string): string | undefined =>
    entities.value.get(entityKey)?.name

  // Computed stats
  const stats = computed(() =>
    computeStats(sessions.value, (session) => session.entityKey, getEntityName)
  )

  const previousSessions = computed(() => {
    const previous = data.value?.previousSessions ?? null
    return previous === null ? null : filterSessionsByMedia(previous, selectedMediaFilter.value)
  })

  // All-time data for overview
  const allTimeSessions = computed(() =>
    filterSessionsByMedia(data.value?.allTime?.sessions ?? [], selectedMediaFilter.value)
  )
  const allTimeStats = computed(() =>
    computeStats(allTimeSessions.value, (session) => session.entityKey, getEntityName)
  )

  // Unit counts stay per-media; consumers pick the entries the scope shows
  const unitCounts = computed(() => data.value?.current.unitCounts ?? emptyUnitCounts())
  const allTimeUnitCounts = computed(() => data.value?.allTime?.unitCounts ?? emptyUnitCounts())

  const context: StatisticsContext = {
    reportType,
    currentPeriod,
    setCurrentPeriod,
    periodDisplay,
    mediaFilter: selectedMediaFilter,
    dateRange,
    sessions,
    entities,
    collections,
    stats,
    previousSessions,
    allTimeSessions,
    allTimeStats,
    unitCounts,
    allTimeUnitCounts,
    entityCollectionLinks,
    error
  }

  provide(StatisticsKey, context)
  return context
}

// =============================================================================
// Consumer Composable
// =============================================================================

/**
 * Consume statistics data context
 *
 * @example
 * ```ts
 * const { sessions, stats, reportType } = useStatistics()
 * ```
 */
export function useStatistics(): StatisticsContext {
  const context = inject(StatisticsKey)
  if (!context) {
    throw new Error(
      'useStatistics() must be used within a component that called useStatisticsProvider()'
    )
  }
  return context
}
