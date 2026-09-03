<!--
  Statistics Hero

  Report headline band. Right side anchors the height with the period's most
  played entry as a large cover; the left column distributes three layers
  across that height: total activity time with delta, a composition strip
  (GitHub-language-bar idiom) with legend, and a fact row spread across the
  width. The strip follows the media scope: the all-media view splits by
  media type, a single-media scope shows its top entries. No internal rules -
  facts separate by spacing; all grid lines belong to the page. Every layer
  renders a placeholder without data so the band frame never collapses.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { mediaTypeOfEntityKey, useStatistics } from '../composables'
import { getPreviousPeriodLabel } from '../period'
import {
  computeEntityRanking,
  countActiveDays,
  getMostActiveMonth,
  getMostActiveWeek,
  getMostActiveWeekdayMondayFirst,
  sessionDurationMs
} from '@renderer/utils/statistics'
import { parseLocalDateKey } from '@renderer/utils/datetime'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityAttachmentUrl } from '@renderer/utils/entity-image'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import { UNIT_MEDIA_TYPES, type MediaType } from '@shared/entity-types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'

const {
  reportType,
  currentPeriod,
  dateRange,
  mediaFilter,
  sessions,
  stats,
  previousSessions,
  allTimeSessions,
  allTimeStats,
  unitCounts,
  allTimeUnitCounts,
  entities
} = useStatistics()

const { m, f } = useI18n()

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

  if (diff === 0) {
    return { icon: 'icon-[mdi--minus]', text: m.value.statistics.hero.flatVsPrevious({ label }) }
  }
  if (diff > 0) {
    return {
      icon: 'icon-[mdi--trending-up]',
      text: m.value.statistics.hero.upVsPrevious({ label, duration: f.value.duration(diff) })
    }
  }
  return {
    icon: 'icon-[mdi--trending-down]',
    text: m.value.statistics.hero.downVsPrevious({ label, duration: f.value.duration(-diff) })
  }
})

// =============================================================================
// Composition strip (where the period's time went, at the scope's level)
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

interface CompositionSlice {
  id: string
  name: string
  fill: string
  duration: number
}

interface CompositionSegment {
  id: string
  name: string
  fill: string
  width: string
  shareText: string
  durationText: string
}

function toSegments(slices: CompositionSlice[], total: number): CompositionSegment[] {
  return slices.map((slice) => {
    const share = slice.duration / total
    return {
      id: slice.id,
      name: slice.name,
      fill: slice.fill,
      width: `${(share * 100).toFixed(2)}%`,
      shareText: `${(share * 100).toFixed(1)}%`,
      durationText: f.value.duration(slice.duration)
    }
  })
}

/** Media types' share of the period total; segments cover it exactly. */
function buildMediaComposition(total: number): CompositionSegment[] {
  const durations = new Map<MediaType, number>()
  for (const session of effectiveSessions.value) {
    const mediaType = mediaTypeOfEntityKey(session.entityKey)
    if (!mediaType) continue
    durations.set(mediaType, (durations.get(mediaType) ?? 0) + sessionDurationMs(session))
  }

  const ranked = [...durations.entries()].sort(([, left], [, right]) => right - left)
  return toSegments(
    ranked.map(([mediaType, duration], index) => ({
      id: mediaType,
      name: m.value.library.entities[mediaType],
      fill: SEGMENT_FILLS[index]!,
      duration
    })),
    total
  )
}

/** Top entries' share of the period total; the rest folds into "other". */
function buildEntityComposition(total: number): CompositionSegment[] {
  const ranking = computeEntityRanking(
    effectiveSessions.value,
    (session) => session.entityKey,
    (entityKey) => entities.value.get(entityKey)?.name,
    'time'
  )
  const top = ranking.slice(0, SEGMENT_FILLS.length)

  const slices: CompositionSlice[] = top.map((item, index) => ({
    id: item.id,
    name: item.name,
    fill: SEGMENT_FILLS[index]!,
    duration: item.totalDuration
  }))

  const otherDuration = total - slices.reduce((sum, slice) => sum + slice.duration, 0)
  if (otherDuration > 0) {
    slices.push({
      id: '__other',
      name: m.value.statistics.hero.other,
      fill: 'var(--color-muted)',
      duration: otherDuration
    })
  }

  return toSegments(slices, total)
}

const composition = computed<CompositionSegment[] | null>(() => {
  const total = effectiveStats.value.totalDuration
  if (total <= 0) return null

  return mediaFilter.value === 'all' ? buildMediaComposition(total) : buildEntityComposition(total)
})

// =============================================================================
// Most played entry (featured, anchors the band height)
// =============================================================================

const mostPlayed = computed(() => {
  const item = effectiveStats.value.mostPlayedEntity
  if (!item) return null

  const entity = entities.value.get(item.id)
  return {
    name: item.name,
    coverUrl:
      entity?.coverFile != null
        ? getEntityAttachmentUrl(entity.mediaType, entity.id, entity.coverFile, {
            width: 184,
            height: 256
          })
        : null,
    // Orphan sessions (entity gone) render as a plain block
    to: entity ? getEntityDetailPath(entity.mediaType, entity.id) : null
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
  if (weekday < 0 || weekday > 6) return '-'
  return f.value.weekdayName(weekday + 1)
}

function formatMonth(monthKey: string): string {
  const [year = '', month = ''] = monthKey.split('-')
  return f.value.yearMonth(new Date(parseInt(year), parseInt(month) - 1, 1))
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

// Completed-unit facts for the unit-bearing media in scope. Zero counts stay
// silent so the row only states what happened; game has no unit fact — its
// consumption already reads as the session count.
const unitFacts = computed<HeroFact[]>(() => {
  const effectiveUnitCounts =
    reportType.value === 'overview' ? allTimeUnitCounts.value : unitCounts.value

  return UNIT_MEDIA_TYPES.flatMap((mediaType) => {
    if (mediaFilter.value !== 'all' && mediaFilter.value !== mediaType) return []
    const unitCount = effectiveUnitCounts[mediaType]
    if (unitCount === 0) return []
    const copy = m.value.statistics.hero.units[mediaType]
    return [{ label: copy.label, value: copy.value({ count: unitCount }) }]
  })
})

const reportFacts = computed<HeroFact[]>(() => {
  const current = effectiveStats.value
  const activeDays = countActiveDays(effectiveSessions.value)

  const hero = m.value.statistics.hero
  const baseFacts: HeroFact[] = [
    { label: hero.sessions, value: hero.timesValue({ count: current.totalSessions }) },
    {
      label: hero.entitiesPlayed,
      value: hero.entitiesValue({ count: current.uniqueEntitiesPlayed })
    },
    { label: hero.averageSession, value: f.value.duration(current.averageSessionDuration) }
  ]

  switch (reportType.value) {
    case 'weekly': {
      const mostActiveWeekday = getMostActiveWeekdayMondayFirst(effectiveSessions.value)
      return [
        ...baseFacts,
        { label: hero.activeDays, value: hero.activeDaysValue({ active: activeDays, total: 7 }) },
        { label: hero.dailyAverage, value: f.value.duration(current.totalDuration / 7) },
        {
          label: hero.mostActiveDay,
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
        {
          label: hero.activeDays,
          value: hero.activeDaysValue({ active: activeDays, total: daysInMonth })
        },
        {
          label: hero.weeklyAverage,
          value: f.value.duration(weeks > 0 ? current.totalDuration / weeks : 0)
        },
        {
          label: hero.mostActiveWeek,
          value: mostActiveWeek ? formatWeekRange(mostActiveWeek.weekStart) : '-'
        }
      ]
    }

    case 'yearly': {
      const year = currentPeriod.value.year
      const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
      const daysInYear = isLeapYear ? 366 : 365
      const mostActiveMonth = getMostActiveMonth(effectiveSessions.value)
      return [
        ...baseFacts,
        {
          label: hero.activeDays,
          value: hero.activeDaysValue({ active: activeDays, total: daysInYear })
        },
        { label: hero.monthlyAverage, value: f.value.duration(current.totalDuration / 12) },
        {
          label: hero.mostActiveMonth,
          value: mostActiveMonth ? formatMonth(mostActiveMonth.month) : '-'
        }
      ]
    }

    case 'overview':
    default:
      return [
        ...baseFacts,
        { label: hero.longestSession, value: f.value.duration(current.longestSession) },
        { label: hero.currentStreak, value: hero.daysValue({ count: current.currentStreak }) },
        { label: hero.longestStreak, value: hero.daysValue({ count: current.longestStreak }) }
      ]
  }
})

const facts = computed<HeroFact[]>(() => [...reportFacts.value, ...unitFacts.value])
</script>

<template>
  <div class="flex items-stretch gap-13">
    <!-- Left column: three layers distributed across the band height -->
    <div class="flex min-w-0 flex-1 flex-col justify-between gap-y-4">
      <div>
        <div class="text-xs text-muted-foreground">{{ m.statistics.hero.totalTime }}</div>
        <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="text-2xl font-semibold tracking-tight tabular-nums">
            {{ f.duration(effectiveStats.totalDuration) }}
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
                    class="size-2.5 shrink-0 rounded-xs"
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
          <span v-else>{{ m.statistics.hero.noActivityRecords }}</span>
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
         so its baseline aligns with the fact row. Links to the entry's
         detail page when the entity is still around. -->
    <component
      :is="mostPlayed?.to ? RouterLink : 'div'"
      v-bind="mostPlayed?.to ? { to: mostPlayed.to } : {}"
      class="flex w-21.5 shrink-0 flex-col justify-between gap-y-2"
    >
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
          icon="icon-[mdi--image-off-outline]"
          class="size-6 text-muted-foreground"
        />
      </div>
      <div class="text-right">
        <div class="text-xs text-muted-foreground">{{ m.statistics.hero.mostPlayed }}</div>
        <div class="mt-0.5 truncate text-sm font-medium">
          <span :class="mostPlayed?.to ? 'hover:underline' : undefined">
            {{ mostPlayed?.name ?? '-' }}
          </span>
        </div>
      </div>
    </component>
  </div>
</template>
