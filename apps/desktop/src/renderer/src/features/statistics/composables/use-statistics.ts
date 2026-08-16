/**
 * Statistics Composable
 *
 * Provider/Consumer pattern for statistics data.
 * Handles report type switching (via route) and period navigation.
 * Date range is computed based on report type and current period; period
 * reports also load the previous period's sessions for comparison.
 * Data loads during navigation (route loader); period switching triggers a
 * non-blocking SWR refetch.
 *
 * Sessions from every media type merge into one entity-keyed stream: each
 * session carries an `entityKey` (`<mediaType>:<id>`) that resolves through
 * the `entities` map, so charts, rankings, and stats stay media-agnostic.
 */

import {
  provide,
  inject,
  ref,
  computed,
  watch,
  type InjectionKey,
  type ComputedRef,
  type Ref
} from 'vue'
import { gte, lte, and, inArray, eq, type SQL } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { storeToRefs } from 'pinia'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useDbChanges } from '@renderer/composables/use-db-changes'
import { MEDIA_TYPES, type MediaType } from '@shared/common'
import type { Collection } from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import { usePreferencesStore } from '@renderer/stores'
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

// =============================================================================
// Context Type
// =============================================================================

export interface StatisticsContext {
  // Report type (derived from the loaded route data)
  reportType: ComputedRef<ReportType>

  // Period state (for weekly/monthly/yearly)
  currentPeriod: ComputedRef<Period>
  setCurrentPeriod: (period: Period) => void
  periodDisplay: ComputedRef<PeriodDisplay>

  // Computed date range based on report type and period (overview: past year)
  dateRange: ComputedRef<{ start: Date; end: Date }>

  // Data - filtered by dateRange
  sessions: ComputedRef<StatisticsSessionEntry[]>
  entities: ComputedRef<Map<string, StatisticsEntity>>
  collections: ComputedRef<Map<string, Collection>>
  stats: ComputedRef<GlobalStatisticsStats>

  // Previous period sessions for comparison; null for overview
  previousSessions: ComputedRef<StatisticsSessionEntry[] | null>

  // For overview: all-time data for stats/distributions/rankings
  allTimeSessions: ComputedRef<StatisticsSessionEntry[]>
  allTimeStats: ComputedRef<GlobalStatisticsStats>

  // Link data for local computation, entity side keyed like sessions
  entityCollectionLinks: ComputedRef<{ entityId: string; collectionId: string }[]>

  // State
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

// =============================================================================
// Injection Key
// =============================================================================

export const StatisticsKey: InjectionKey<StatisticsContext> = Symbol('statistics')

// =============================================================================
// Route Helpers
// =============================================================================

/** Get report type from route name */
function getReportTypeFromRoute(routeName: string | symbol | null | undefined): ReportType {
  if (!routeName || typeof routeName !== 'string') return 'overview'

  if (routeName.includes('weekly')) return 'weekly'
  if (routeName.includes('monthly')) return 'monthly'
  if (routeName.includes('yearly')) return 'yearly'
  return 'overview'
}

// =============================================================================
// Data Fetchers
// =============================================================================

interface FetchedData {
  sessions: StatisticsSessionEntry[]
  entities: StatisticsEntity[]
  collections: Collection[]
  entityCollectionLinks: { entityId: string; collectionId: string }[]
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
  /** Session table name as reported by database change events */
  sessionTable: string
  /** Media table name as reported by database change events */
  entityTable: string
}

const MEDIA_STATISTICS_SOURCES = {
  game: {
    sessions: schema.gameSessions,
    sessionEntityId: schema.gameSessions.gameId,
    entities: schema.games,
    collectionLinks: schema.collectionGameLinks,
    collectionLinkEntityId: schema.collectionGameLinks.gameId,
    sessionTable: 'game_sessions',
    entityTable: 'games'
  },
  anime: {
    sessions: schema.animeSessions,
    sessionEntityId: schema.animeSessions.animeId,
    entities: schema.animes,
    collectionLinks: schema.collectionAnimeLinks,
    collectionLinkEntityId: schema.collectionAnimeLinks.animeId,
    sessionTable: 'anime_sessions',
    entityTable: 'animes'
  },
  tv: {
    sessions: schema.tvSessions,
    sessionEntityId: schema.tvSessions.tvId,
    entities: schema.tvs,
    collectionLinks: schema.collectionTvLinks,
    collectionLinkEntityId: schema.collectionTvLinks.tvId,
    sessionTable: 'tv_sessions',
    entityTable: 'tvs'
  },
  movie: {
    sessions: schema.movieSessions,
    sessionEntityId: schema.movieSessions.movieId,
    entities: schema.movies,
    collectionLinks: schema.collectionMovieLinks,
    collectionLinkEntityId: schema.collectionMovieLinks.movieId,
    sessionTable: 'movie_sessions',
    entityTable: 'movies'
  }
} as const satisfies Record<MediaType, MediaStatisticsSource>

const SESSION_TABLES = new Set<string>(
  MEDIA_TYPES.map((mediaType) => MEDIA_STATISTICS_SOURCES[mediaType].sessionTable)
)
const MEDIA_TABLES = new Set<string>(
  MEDIA_TYPES.map((mediaType) => MEDIA_STATISTICS_SOURCES[mediaType].entityTable)
)

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
  const sessions = await fetchSessionsInRange(dateRange, showNsfw)

  if (sessions.length === 0) {
    return {
      sessions: [],
      entities: [],
      collections: [],
      entityCollectionLinks: []
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
    entityCollectionLinks: linkGroups.flat()
  }
}

// =============================================================================
// Route Loader
// =============================================================================

interface StatisticsData {
  reportType: ReportType
  period: Period
  current: FetchedData
  previousSessions: StatisticsSessionEntry[] | null
  allTime: FetchedData | null
}

// In-page period selection lives beside the loader so the navigation-time
// fetch reads a consistent value; it resets whenever the report type changes.
let lastReportType: ReportType | null = null
const selectedPeriod = ref<Period>(getCurrentPeriod('overview'))

export const statisticsData = defineRouteData(async (route): Promise<StatisticsData> => {
  const reportType = getReportTypeFromRoute(route.name)
  if (reportType !== lastReportType) {
    lastReportType = reportType
    selectedPeriod.value = getCurrentPeriod(reportType)
  }

  const { showNsfw } = storeToRefs(usePreferencesStore())
  const period = selectedPeriod.value
  const dateRange = calculatePeriodDateRange(reportType, period)
  // Overview has no natural predecessor; period reports compare to the
  // previous period and overview additionally loads all-time data.
  const previousRange =
    reportType === 'overview'
      ? null
      : calculatePeriodDateRange(reportType, shiftPeriod(reportType, period, -1))

  const [current, previousSessions, allTime] = await Promise.all([
    fetchStatisticsData(dateRange, showNsfw.value),
    previousRange ? fetchSessionsInRange(previousRange, showNsfw.value) : Promise.resolve(null),
    reportType === 'overview' ? fetchStatisticsData(null, showNsfw.value) : Promise.resolve(null)
  ])

  return { reportType, period, current, previousSessions, allTime }
})

// =============================================================================
// Provider Composable
// =============================================================================

/**
 * Provide statistics data context.
 *
 * Data is loaded by `statisticsData` during navigation. Period switching and
 * NSFW preference changes trigger a non-blocking SWR refetch; derived state
 * (period, date range, display) follows the loaded snapshot so charts and
 * labels always match the sessions on screen.
 */
export function useStatisticsProvider(): StatisticsContext {
  const { data, error, isFetching, refetch } = statisticsData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  const reportType = computed<ReportType>(() => data.value?.reportType ?? 'overview')
  const currentPeriod = computed<Period>(() => data.value?.period ?? selectedPeriod.value)
  const dateRange = computed(() => calculatePeriodDateRange(reportType.value, currentPeriod.value))
  const periodDisplay = computed(() => formatPeriodDisplay(reportType.value, currentPeriod.value))

  const setCurrentPeriod = (period: Period): void => {
    selectedPeriod.value = period
    void refetch()
  }

  // Computed data maps
  const sessions = computed(() => data.value?.current.sessions ?? [])

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

  const previousSessions = computed(() => data.value?.previousSessions ?? null)

  // All-time data for overview
  const allTimeSessions = computed(() => data.value?.allTime?.sessions ?? [])
  const allTimeStats = computed(() =>
    computeStats(allTimeSessions.value, (session) => session.entityKey, getEntityName)
  )

  // Event listeners for auto-refresh
  useDbChanges(({ operation, table }) => {
    const isSessionTable = SESSION_TABLES.has(table)
    if (isSessionTable) {
      void refetch()
      return
    }
    if (operation === 'updated' && MEDIA_TABLES.has(table)) void refetch()
  })

  const context: StatisticsContext = {
    reportType,
    currentPeriod,
    setCurrentPeriod,
    periodDisplay,
    dateRange,
    sessions,
    entities,
    collections,
    stats,
    previousSessions,
    allTimeSessions,
    allTimeStats,
    entityCollectionLinks,
    isFetching,
    error,
    refetch
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
