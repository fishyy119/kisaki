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
import { storeToRefs } from 'pinia'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useDbChanges } from '@renderer/composables/use-db-changes'
import type { MediaType } from '@shared/common'
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

function rangeConditions(
  dateRange: { start: Date; end: Date } | null,
  startedAt: typeof schema.gameSessions.startedAt | typeof schema.animeSessions.startedAt,
  endedAt: typeof schema.gameSessions.endedAt | typeof schema.animeSessions.endedAt
): SQL[] {
  if (!dateRange) return []
  return [gte(startedAt, dateRange.start), lte(endedAt, dateRange.end)]
}

async function fetchGameSessionsInRange(
  dateRange: { start: Date; end: Date } | null,
  showNsfw: boolean
): Promise<StatisticsSessionEntry[]> {
  const conditions = rangeConditions(
    dateRange,
    schema.gameSessions.startedAt,
    schema.gameSessions.endedAt
  )
  const sessionWhere = conditions.length ? and(...conditions) : undefined

  const rows = showNsfw
    ? await db.select().from(schema.gameSessions).where(sessionWhere)
    : (
        await db
          .select()
          .from(schema.gameSessions)
          .innerJoin(schema.games, eq(schema.gameSessions.gameId, schema.games.id))
          .where(and(sessionWhere, eq(schema.games.isNsfw, false)))
      ).map((row) => row.game_sessions)

  return rows.map((row) => ({
    id: row.id,
    entityKey: buildEntityKey('game', row.gameId),
    startedAt: row.startedAt,
    endedAt: row.endedAt
  }))
}

async function fetchAnimeSessionsInRange(
  dateRange: { start: Date; end: Date } | null,
  showNsfw: boolean
): Promise<StatisticsSessionEntry[]> {
  const conditions = rangeConditions(
    dateRange,
    schema.animeSessions.startedAt,
    schema.animeSessions.endedAt
  )
  const sessionWhere = conditions.length ? and(...conditions) : undefined

  const rows = showNsfw
    ? await db.select().from(schema.animeSessions).where(sessionWhere)
    : (
        await db
          .select()
          .from(schema.animeSessions)
          .innerJoin(schema.animes, eq(schema.animeSessions.animeId, schema.animes.id))
          .where(and(sessionWhere, eq(schema.animes.isNsfw, false)))
      ).map((row) => row.anime_sessions)

  return rows.map((row) => ({
    id: row.id,
    entityKey: buildEntityKey('anime', row.animeId),
    startedAt: row.startedAt,
    endedAt: row.endedAt
  }))
}

async function fetchSessionsInRange(
  dateRange: { start: Date; end: Date } | null,
  showNsfw: boolean
): Promise<StatisticsSessionEntry[]> {
  const [gameSessions, animeSessions] = await Promise.all([
    fetchGameSessionsInRange(dateRange, showNsfw),
    fetchAnimeSessionsInRange(dateRange, showNsfw)
  ])

  return [...gameSessions, ...animeSessions].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
  )
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

  const gameIds = entityIdsOf(sessions, 'game')
  const animeIds = entityIdsOf(sessions, 'anime')

  // Parallel fetch all related data
  const [games, animes, collections, gameCollectionLinks, animeCollectionLinks] = await Promise.all(
    [
      gameIds.length
        ? db
            .select()
            .from(schema.games)
            .where(
              and(
                inArray(schema.games.id, gameIds),
                showNsfw ? undefined : eq(schema.games.isNsfw, false)
              )
            )
        : Promise.resolve([]),
      animeIds.length
        ? db
            .select()
            .from(schema.animes)
            .where(
              and(
                inArray(schema.animes.id, animeIds),
                showNsfw ? undefined : eq(schema.animes.isNsfw, false)
              )
            )
        : Promise.resolve([]),
      db
        .select()
        .from(schema.collections)
        .where(showNsfw ? undefined : eq(schema.collections.isNsfw, false)),
      gameIds.length
        ? db
            .select({
              gameId: schema.collectionGameLinks.gameId,
              collectionId: schema.collectionGameLinks.collectionId
            })
            .from(schema.collectionGameLinks)
            .innerJoin(
              schema.collections,
              eq(schema.collectionGameLinks.collectionId, schema.collections.id)
            )
            .where(
              and(
                inArray(schema.collectionGameLinks.gameId, gameIds),
                showNsfw ? undefined : eq(schema.collections.isNsfw, false)
              )
            )
        : Promise.resolve([]),
      animeIds.length
        ? db
            .select({
              animeId: schema.collectionAnimeLinks.animeId,
              collectionId: schema.collectionAnimeLinks.collectionId
            })
            .from(schema.collectionAnimeLinks)
            .innerJoin(
              schema.collections,
              eq(schema.collectionAnimeLinks.collectionId, schema.collections.id)
            )
            .where(
              and(
                inArray(schema.collectionAnimeLinks.animeId, animeIds),
                showNsfw ? undefined : eq(schema.collections.isNsfw, false)
              )
            )
        : Promise.resolve([])
    ]
  )

  const entities: StatisticsEntity[] = [
    ...games.map((game) => ({
      key: buildEntityKey('game', game.id),
      mediaType: 'game' as const,
      id: game.id,
      name: game.name,
      coverFile: game.coverFile
    })),
    ...animes.map((anime) => ({
      key: buildEntityKey('anime', anime.id),
      mediaType: 'anime' as const,
      id: anime.id,
      name: anime.name,
      coverFile: anime.coverFile
    }))
  ]

  const entityCollectionLinks = [
    ...gameCollectionLinks.map((link) => ({
      entityId: buildEntityKey('game', link.gameId),
      collectionId: link.collectionId
    })),
    ...animeCollectionLinks.map((link) => ({
      entityId: buildEntityKey('anime', link.animeId),
      collectionId: link.collectionId
    }))
  ]

  return {
    sessions,
    entities,
    collections,
    entityCollectionLinks
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
    const sessionTable = table === 'game_sessions' || table === 'anime_sessions'
    if (operation === 'inserted' && sessionTable) void refetch()
    if (operation === 'updated' && (sessionTable || table === 'games' || table === 'animes')) {
      void refetch()
    }
    if (operation === 'deleted' && sessionTable) void refetch()
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
