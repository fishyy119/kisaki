<!--
  Statistics Hero

  Report headline band. Right side anchors the height with the period's most
  played game as a large cover; the left column distributes three layers
  across that height: total play time with delta, a composition strip (top
  games' share, GitHub-language-bar idiom) with legend, and a fact row
  spread across the width. No internal rules - facts separate by spacing;
  all grid lines belong to the page. Every layer renders a placeholder
  without data so the band frame never collapses.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useStatistics } from '../composables'
import { getPreviousPeriodLabel } from '../period'
import {
  computeGameRanking,
  countActiveDays,
  getMostActiveMonth,
  getMostActiveWeek,
  getMostActiveWeekdayMondayFirst
} from '@renderer/utils/statistics'
import { formatDuration, parseLocalDateKey } from '@renderer/utils/datetime'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon } from '@renderer/utils/format'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'

const {
  reportType,
  currentPeriod,
  dateRange,
  sessions,
  stats,
  previousSessions,
  allTimeSessions,
  allTimeStats,
  games
} = useStatistics()

// Overview reports on all-time data; period reports on their range.
const effectiveStats = computed(() =>
  reportType.value === 'overview' ? allTimeStats.value : stats.value
)
const effectiveSessions = computed(() =>
  reportType.value === 'overview' ? allTimeSessions.value : sessions.value
)

// =============================================================================
// Delta vs previous period
// =============================================================================

const delta = computed(() => {
  const previous = previousSessions.value
  if (previous === null) return null

  const previousTotal = previous.reduce(
    (sum, session) => sum + Math.max(0, session.endedAt.getTime() - session.startedAt.getTime()),
    0
  )
  const diff = effectiveStats.value.totalDuration - previousTotal
  const label = getPreviousPeriodLabel(reportType.value)

  if (diff === 0) return { icon: 'icon-[mdi--minus]', text: `与${label}持平` }
  if (diff > 0) {
    return { icon: 'icon-[mdi--trending-up]', text: `较${label} +${formatDuration(diff)}` }
  }
  return { icon: 'icon-[mdi--trending-down]', text: `较${label} -${formatDuration(-diff)}` }
})

// =============================================================================
// Composition strip (top games' share of the period total)
// =============================================================================

// Chart ink: strip segments step down the chart ink density ladder by rank;
// the residual "other" segment stays neutral.
const SEGMENT_FILLS = [
  'var(--chart)',
  'color-mix(in oklch, var(--chart) 70%, transparent)',
  'color-mix(in oklch, var(--chart) 50%, transparent)',
  'color-mix(in oklch, var(--chart) 35%, transparent)',
  'color-mix(in oklch, var(--chart) 20%, transparent)'
] as const

interface CompositionSegment {
  id: string
  name: string
  fill: string
  width: string
  shareText: string
  durationText: string
}

const composition = computed<CompositionSegment[] | null>(() => {
  const total = effectiveStats.value.totalDuration
  if (total <= 0) return null

  const ranking = computeGameRanking(effectiveSessions.value, games.value, 'time')
  const top = ranking.slice(0, SEGMENT_FILLS.length)

  const segments: Array<{ id: string; name: string; fill: string; duration: number }> = top.map(
    (item, index) => ({
      id: item.id,
      name: item.name,
      fill: SEGMENT_FILLS[index],
      duration: item.totalDuration
    })
  )

  const otherDuration = total - segments.reduce((sum, segment) => sum + segment.duration, 0)
  if (otherDuration > 0) {
    segments.push({
      id: '__other',
      name: '其他',
      fill: 'var(--color-muted)',
      duration: otherDuration
    })
  }

  return segments.map((segment) => {
    const share = segment.duration / total
    return {
      id: segment.id,
      name: segment.name,
      fill: segment.fill,
      width: `${(share * 100).toFixed(2)}%`,
      shareText: `${(share * 100).toFixed(1)}%`,
      durationText: formatDuration(segment.duration)
    }
  })
})

// =============================================================================
// Most played game (featured, anchors the band height)
// =============================================================================

const mostPlayed = computed(() => {
  const item = effectiveStats.value.mostPlayedGame
  if (!item) return null

  const game = games.value.get(item.id)
  return {
    name: item.name,
    coverUrl: game?.coverFile
      ? getAttachmentUrl('games', game.id, game.coverFile, { width: 184, height: 256 })
      : null
  }
})

// =============================================================================
// Fact row
// =============================================================================

interface HeroFact {
  label: string
  value: string
}

function formatWeekdayMondayFirst(weekday: number): string {
  const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return names[weekday] ?? '-'
}

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}年${parseInt(month)}月`
}

function formatWeekRange(weekStartKey: string): string {
  const start = parseLocalDateKey(weekStartKey)
  if (!start) return weekStartKey
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`
}

function countWeeksInRange(start: Date, end: Date): number {
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const jsDay = cursor.getDay()
  cursor.setDate(cursor.getDate() - jsDay + (jsDay === 0 ? -6 : 1))

  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)

  let count = 0
  while (cursor.getTime() <= endDay.getTime()) {
    count++
    cursor.setDate(cursor.getDate() + 7)
  }
  return count
}

const facts = computed<HeroFact[]>(() => {
  const current = effectiveStats.value
  const activeDays = countActiveDays(effectiveSessions.value)

  const baseFacts: HeroFact[] = [
    { label: '游玩次数', value: `${current.totalSessions}次` },
    { label: '游玩数量', value: `${current.uniqueGamesPlayed}款` },
    { label: '平均单次', value: formatDuration(current.averageSessionDuration) }
  ]

  switch (reportType.value) {
    case 'weekly': {
      const mostActiveWeekday = getMostActiveWeekdayMondayFirst(effectiveSessions.value)
      return [
        ...baseFacts,
        { label: '活跃天数', value: `${activeDays}/7天` },
        { label: '日均时长', value: formatDuration(current.totalDuration / 7) },
        {
          label: '最活跃日',
          value: mostActiveWeekday ? formatWeekdayMondayFirst(mostActiveWeekday.weekday) : '-'
        }
      ]
    }

    case 'monthly': {
      const daysInMonth = new Date(
        currentPeriod.value.year,
        currentPeriod.value.month!,
        0
      ).getDate()
      const weeks = countWeeksInRange(dateRange.value.start, dateRange.value.end)
      const mostActiveWeek = getMostActiveWeek(effectiveSessions.value)
      return [
        ...baseFacts,
        { label: '活跃天数', value: `${activeDays}/${daysInMonth}天` },
        { label: '周均时长', value: formatDuration(weeks > 0 ? current.totalDuration / weeks : 0) },
        {
          label: '最活跃周',
          value: mostActiveWeek ? formatWeekRange(mostActiveWeek.weekStart) : '-'
        }
      ]
    }

    case 'yearly': {
      const daysInYear = currentPeriod.value.year % 4 === 0 ? 366 : 365
      const mostActiveMonth = getMostActiveMonth(effectiveSessions.value)
      return [
        ...baseFacts,
        { label: '活跃天数', value: `${activeDays}/${daysInYear}天` },
        { label: '月均时长', value: formatDuration(current.totalDuration / 12) },
        {
          label: '最活跃月份',
          value: mostActiveMonth ? formatMonth(mostActiveMonth.month) : '-'
        }
      ]
    }

    case 'overview':
    default:
      return [
        ...baseFacts,
        { label: '最长单次', value: formatDuration(current.longestSession) },
        { label: '当前连续', value: `${current.currentStreak}天` },
        { label: '最长连续', value: `${current.longestStreak}天` }
      ]
  }
})
</script>

<template>
  <div class="flex items-stretch gap-13">
    <!-- Left column: three layers distributed across the band height -->
    <div class="flex min-w-0 flex-1 flex-col justify-between gap-y-4">
      <div>
        <div class="text-xs text-muted-foreground">总游玩时长</div>
        <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="text-2xl font-semibold tracking-tight tabular-nums">
            {{ formatDuration(effectiveStats.totalDuration) }}
          </span>
          <span
            v-if="delta"
            class="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Icon
              :icon="delta.icon"
              class="size-3.5"
            />
            {{ delta.text }}
          </span>
        </div>
      </div>

      <!-- Composition strip: where the period's time went. The track and
           legend row always render so the band keeps its frame without data. -->
      <div>
        <!-- Translucent segments must sit on the page plane, not a filled
             track, so their rendered color matches the legend dots. -->
        <div
          class="flex h-2 gap-px overflow-hidden rounded-full"
          :class="composition ? '' : 'bg-muted'"
        >
          <template v-if="composition">
            <Tooltip
              v-for="segment in composition"
              :key="segment.id"
            >
              <TooltipTrigger as-child>
                <div :style="{ width: segment.width, backgroundColor: segment.fill }" />
              </TooltipTrigger>
              <TooltipContent>
                <div class="flex items-center gap-2">
                  <span
                    class="size-2.5 shrink-0 rounded-[2px]"
                    :style="{ backgroundColor: segment.fill }"
                  />
                  <span>{{ segment.name }}</span>
                  <span class="tabular-nums text-muted-foreground">
                    {{ segment.durationText }} · {{ segment.shareText }}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          </template>
        </div>
        <div
          class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
        >
          <template v-if="composition">
            <div
              v-for="segment in composition"
              :key="segment.id"
              class="flex min-w-0 items-center gap-1.5"
            >
              <span
                class="size-2 shrink-0 rounded-full"
                :style="{ backgroundColor: segment.fill }"
              />
              <span class="max-w-40 truncate text-foreground">{{ segment.name }}</span>
              <span class="tabular-nums">{{ segment.shareText }}</span>
            </div>
          </template>
          <span v-else>暂无游玩记录</span>
        </div>
      </div>

      <!-- Fact row: spread across the width, separated by spacing only -->
      <dl class="flex flex-wrap justify-between gap-x-8 gap-y-3">
        <div
          v-for="fact in facts"
          :key="fact.label"
        >
          <dt class="text-xs text-muted-foreground">{{ fact.label }}</dt>
          <dd class="mt-0.5 text-sm font-medium tabular-nums">{{ fact.value }}</dd>
        </div>
      </dl>
    </div>

    <!-- Right column: featured most played. Always rendered (placeholder
         without data) so the band height stays stable. Column width matches
         the cover, so the block hugs the page's right edge while cover and
         caption share one left edge; the caption sinks to the column bottom
         so its baseline aligns with the fact row. -->
    <div class="flex w-21.5 shrink-0 flex-col justify-between gap-y-2">
      <img
        v-if="mostPlayed?.coverUrl"
        :src="mostPlayed.coverUrl"
        alt=""
        class="h-30 w-21.5 rounded-md border border-border/40 object-cover shadow-raised"
      />
      <div
        v-else
        class="flex h-30 w-21.5 items-center justify-center rounded-md bg-muted"
      >
        <Icon
          :icon="getEntityIcon('game')"
          class="size-6 text-muted-foreground"
        />
      </div>
      <div class="text-right">
        <div class="text-xs text-muted-foreground">最常玩</div>
        <div class="mt-0.5 truncate text-sm font-medium">{{ mostPlayed?.name ?? '-' }}</div>
      </div>
    </div>
  </div>
</template>
