/**
 * Statistics Composable
 *
 * Provider/Consumer pattern for statistics data.
 * Handles report type switching (via route) and period navigation.
 * Date range is computed based on report type and current period; period
 * reports also load the previous period's sessions for comparison.
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
import { useRoute } from 'vue-router'
import { desc, gte, lte, and, inArray, eq, type SQL } from 'drizzle-orm'
import { storeToRefs } from 'pinia'
import { db } from '@renderer/core/db'
import { useAsyncData } from '@renderer/composables/use-async-data'
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
  // Report type (derived from route)
  reportType: ComputedRef<ReportType>

  // Period state (for weekly/monthly/yearly)
  currentPeriod: Ref<Period>
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
  isLoading: Ref<boolean>
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
// Provider Composable
// =============================================================================

/**
 * Provide statistics data context
 *
 * @example
 * ```ts
 * const { sessions, stats, reportType } = useStatisticsProvider()
 * ```
 */
export function useStatisticsProvider(): StatisticsContext {
  const route = useRoute()
  const preferencesStore = usePreferencesStore()
  const { showNsfw } = storeToRefs(preferencesStore)

  // Report type derived from route
  const reportType = computed<ReportType>(() => getReportTypeFromRoute(route.name))

  // Period state - initialized based on report type
  const currentPeriod = ref<Period>(getCurrentPeriod(reportType.value))

  // Reset period when report type changes
  watch(reportType, (newType) => {
    currentPeriod.value = getCurrentPeriod(newType)
  })

  // Computed date range
  const dateRange = computed(() => calculatePeriodDateRange(reportType.value, currentPeriod.value))

  // Previous period range for comparison; overview has no natural predecessor
  const previousDateRange = computed(() => {
    if (reportType.value === 'overview') return null
    return calculatePeriodDateRange(
      reportType.value,
      shiftPeriod(reportType.value, currentPeriod.value, -1)
    )
  })

  // Period display
  const periodDisplay = computed(() => formatPeriodDisplay(reportType.value, currentPeriod.value))

  // Fetch data based on computed date range
  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchStatisticsData(dateRange.value, showNsfw.value),
    { watch: [dateRange, showNsfw] }
  )

  // Previous period sessions (comparison only, so sessions suffice)
  const { data: previousData, refetch: refetchPrevious } = useAsyncData(
    () => fetchSessionsInRange(previousDateRange.value, showNsfw.value),
    { enabled: () => previousDateRange.value !== null, watch: [previousDateRange, showNsfw] }
  )

  // For overview: fetch all-time data separately
  const { data: allTimeData, refetch: refetchAllTime } = useAsyncData(
    () => fetchStatisticsData(null, showNsfw.value),
    { enabled: () => reportType.value === 'overview', watch: [showNsfw] }
  )

  // Computed data maps
  const sessions = computed(() => data.value?.sessions ?? [])

  const games = computed(() => {
    const map = new Map<string, Game>()
    // Merge games from both data sources for overview
    for (const game of data.value?.games ?? []) {
      map.set(game.id, game)
    }
    if (reportType.value === 'overview') {
      for (const game of allTimeData.value?.games ?? []) {
        map.set(game.id, game)
      }
    }
    return map
  })

  const collections = computed(() => {
    const map = new Map<string, Collection>()
    for (const collection of data.value?.collections ?? []) {
      map.set(collection.id, collection)
    }
    return map
  })

  // Expose link data for local computation in components
  const gameCollectionLinks = computed(() => {
    if (reportType.value === 'overview') {
      return allTimeData.value?.gameCollectionLinks ?? []
    }
    return data.value?.gameCollectionLinks ?? []
  })

  // Computed stats
  const stats = computed(() => computeStats(sessions.value, games.value))

  const previousSessions = computed(() => {
    if (previousDateRange.value === null) return null
    return previousData.value ?? []
  })

  // All-time data for overview
  const allTimeSessions = computed(() => allTimeData.value?.sessions ?? [])
  const allTimeStats = computed(() => computeStats(allTimeSessions.value, games.value))

  function refetchAll(): void {
    void refetch()
    if (previousDateRange.value !== null) void refetchPrevious()
    if (reportType.value === 'overview') void refetchAllTime()
  }

  // Event listeners for auto-refresh
  useEvent('db.inserted', ({ table }) => {
    if (table === 'game_sessions') refetchAll()
  })

  useEvent('db.updated', ({ table }) => {
    if (table === 'game_sessions' || table === 'games') refetchAll()
  })

  useEvent('db.deleted', ({ table }) => {
    if (table === 'game_sessions') refetchAll()
  })

  const context: StatisticsContext = {
    reportType,
    currentPeriod,
    setCurrentPeriod: (period) => {
      currentPeriod.value = period
    },
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
    isLoading,
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
