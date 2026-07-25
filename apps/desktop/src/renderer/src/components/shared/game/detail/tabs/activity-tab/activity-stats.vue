<!--
  Game Detail Activity Stats

  Statistics summary for a single game's play history.
-->

<script setup lang="ts">
import { computed } from 'vue'
import type { GameSession } from '@shared/db'
import { StatsGrid, type StatsGridItem } from '@renderer/components/ui/stats-grid'
import { computeStreaks } from '@renderer/utils/statistics'
import { useI18n } from '@renderer/composables/use-i18n'

interface Props {
  sessions: GameSession[]
}

const props = defineProps<Props>()

const { m, f } = useI18n()

const stats = computed(() => {
  const sessions = props.sessions
  if (sessions.length === 0) {
    return {
      totalDuration: 0,
      totalSessions: 0,
      averageSessionDuration: 0,
      longestSession: 0,
      currentStreak: 0,
      longestStreak: 0,
      firstSessionDate: null as Date | null,
      lastSessionDate: null as Date | null
    }
  }

  let totalDuration = 0
  let longestSession = 0
  let firstSessionDate: Date | null = null
  let lastSessionDate: Date | null = null

  for (const s of sessions) {
    const d = s.endedAt.getTime() - s.startedAt.getTime()
    totalDuration += d
    if (d > longestSession) longestSession = d

    if (!firstSessionDate || s.startedAt < firstSessionDate) firstSessionDate = s.startedAt
    if (!lastSessionDate || s.endedAt > lastSessionDate) lastSessionDate = s.endedAt
  }

  const totalSessions = sessions.length
  const averageSessionDuration = totalDuration / totalSessions
  const { currentStreak, longestStreak } = computeStreaks(sessions)

  return {
    totalDuration,
    totalSessions,
    averageSessionDuration,
    longestSession,
    currentStreak,
    longestStreak,
    firstSessionDate,
    lastSessionDate
  }
})

const items = computed<StatsGridItem[]>(() => [
  {
    icon: 'icon-[mdi--timer-outline]',
    label: m.value.game.activity.playDuration,
    value: f.value.duration(stats.value.totalDuration)
  },
  {
    icon: 'icon-[mdi--play-circle-outline]',
    label: m.value.game.activity.playCount,
    value: m.value.game.activity.playCountValue({ count: stats.value.totalSessions })
  },
  {
    icon: 'icon-[mdi--timer-sand-paused]',
    label: m.value.game.activity.avgDuration,
    value: f.value.duration(stats.value.averageSessionDuration)
  },
  {
    icon: 'icon-[mdi--trophy-variant-outline]',
    label: m.value.game.activity.longestSession,
    value: f.value.duration(stats.value.longestSession)
  },
  {
    icon: 'icon-[mdi--lightbulb-variant-outline]',
    label: m.value.game.activity.currentStreak,
    value: m.value.game.activity.streakValue({ days: stats.value.currentStreak })
  },
  {
    icon: 'icon-[mdi--medal-outline]',
    label: m.value.game.activity.longestStreak,
    value: m.value.game.activity.streakValue({ days: stats.value.longestStreak })
  },
  {
    icon: 'icon-[mdi--calendar-start-outline]',
    label: m.value.game.activity.firstPlayed,
    value: stats.value.firstSessionDate
      ? f.value.date(stats.value.firstSessionDate)
      : m.value.common.emptyValue
  },
  {
    icon: 'icon-[mdi--calendar-end-outline]',
    label: m.value.game.activity.lastPlayed,
    value: stats.value.lastSessionDate
      ? f.value.date(stats.value.lastSessionDate)
      : m.value.common.emptyValue
  }
])
</script>

<template>
  <StatsGrid :items="items" />
</template>
