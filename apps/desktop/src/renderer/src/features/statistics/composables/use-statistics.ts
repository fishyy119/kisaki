/**
 * Statistics Composable
 *
 * Provider/Consumer pattern for statistics data.
 * Handles report type switching (via route) and period navigation.
 * Date range is computed based on report type and current period; period
 * reports also load the previous period's sessions for comparison.
 * Data loads during navigation (route loader); period switching triggers a
 * non-blocking SWR refetch.
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
import { desc, gte, lte, and, inArray, eq, type SQL } from 'drizzle-orm'
import { storeToRefs } from 'pinia'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useEvent } from '@renderer/composables/use-event'
import type { Game, GameSession, Collection } from '@shared/db/schema'
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
  sessions: ComputedRef<GameSession[]>
  games: ComputedRef<Map<string, Game>>
  collections: ComputedRef<Map<string, Collection>>
  stats: ComputedRef<GlobalStatisticsStats>

  // Previous period sessions for comparison; null for overview
  previousSessions: ComputedRef<GameSession[] | null>

  // For overview: all-time data for stats/distributions/rankings
  allTimeSessions: ComputedRef<GameSession[]>
  allTimeStats: ComputedRef<GlobalStatisticsStats>

  // Link data for local computation
  gameCollectionLinks: ComputedRef<{ gameId: string; collectionId: string }[]>

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
  sessions: GameSession[]
  games: Game[]
  collections: Collection[]
  gameCollectionLinks: { gameId: string; collectionId: string }[]
}

async function fetchSessionsInRange(
  dateRange: { start: Date; end: Date } | null,
  showNsfw: boolean
): Promise<GameSession[]> {
  const conditions: SQL[] = []
  if (dateRange) {
    conditions.push(
      gte(schema.gameSessions.startedAt, dateRange.start),
      lte(schema.gameSessions.endedAt, dateRange.end)
    )
  }

  const sessionWhere = conditions.length ? and(...conditions) : undefined

  if (showNsfw) {
    return await db
      .select()
      .from(schema.gameSessions)
      .where(sessionWhere)
      .orderBy(desc(schema.gameSessions.startedAt))
  }

  const rows = await db
    .select()
    .from(schema.gameSessions)
    .innerJoin(schema.games, eq(schema.gameSessions.gameId, schema.games.id))
    .where(and(sessionWhere, eq(schema.games.isNsfw, false)))
    .orderBy(desc(schema.gameSessions.startedAt))
  return rows.map((row) => row.game_sessions)
}

async function fetchStatisticsData(
  dateRange: { start: Date; end: Date } | null,
  showNsfw: boolean
): Promise<FetchedData> {
  const sessions = await fetchSessionsInRange(dateRange, showNsfw)

  if (sessions.length === 0) {
    return {
      sessions: [],
      games: [],
      collections: [],
      gameCollectionLinks: []
    }
  }

  // Get unique game IDs
  const gameIds = [...new Set(sessions.map((s) => s.gameId))]

  // Parallel fetch all related data
  const [games, collections, gameCollectionLinks] = await Promise.all([
    db
      .select()
      .from(schema.games)
      .where(
        and(
          inArray(schema.games.id, gameIds),
          showNsfw ? undefined : eq(schema.games.isNsfw, false)
        )
      ),
    db
      .select()
      .from(schema.collections)
      .where(showNsfw ? undefined : eq(schema.collections.isNsfw, false)),
    showNsfw
      ? db
          .select({
            gameId: schema.collectionGameLinks.gameId,
            collectionId: schema.collectionGameLinks.collectionId
          })
          .from(schema.collectionGameLinks)
          .where(inArray(schema.collectionGameLinks.gameId, gameIds))
      : db
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
              eq(schema.collections.isNsfw, false)
            )
          )
  ])

  return {
    sessions,
    games,
    collections,
    gameCollectionLinks
  }
}

// =============================================================================
// Route Loader
// =============================================================================

interface StatisticsData {
  reportType: ReportType
  period: Period
  current: FetchedData
  previousSessions: GameSession[] | null
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

  const games = computed(() => {
    const map = new Map<string, Game>()
    // Merge games from both data sources for overview
    for (const game of data.value?.current.games ?? []) {
      map.set(game.id, game)
    }
    for (const game of data.value?.allTime?.games ?? []) {
      map.set(game.id, game)
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
  const gameCollectionLinks = computed(() => {
    if (reportType.value === 'overview') {
      return data.value?.allTime?.gameCollectionLinks ?? []
    }
    return data.value?.current.gameCollectionLinks ?? []
  })

  // Computed stats
  const stats = computed(() => computeStats(sessions.value, games.value))

  const previousSessions = computed(() => data.value?.previousSessions ?? null)

  // All-time data for overview
  const allTimeSessions = computed(() => data.value?.allTime?.sessions ?? [])
  const allTimeStats = computed(() => computeStats(allTimeSessions.value, games.value))

  // Event listeners for auto-refresh
  useEvent('db.inserted', ({ table }) => {
    if (table === 'game_sessions') void refetch()
  })

  useEvent('db.updated', ({ table }) => {
    if (table === 'game_sessions' || table === 'games') void refetch()
  })

  useEvent('db.deleted', ({ table }) => {
    if (table === 'game_sessions') void refetch()
  })

  const context: StatisticsContext = {
    reportType,
    currentPeriod,
    setCurrentPeriod,
    periodDisplay,
    dateRange,
    sessions,
    games,
    collections,
    stats,
    previousSessions,
    allTimeSessions,
    allTimeStats,
    gameCollectionLinks,
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
