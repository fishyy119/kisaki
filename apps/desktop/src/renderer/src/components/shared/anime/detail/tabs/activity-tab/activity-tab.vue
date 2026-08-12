<!--
  Anime Detail Activity Tab

  Activity tab showing anime watch history, statistics, and charts,
  followed by the recent watch sessions with their episodes.
  Uses sessions data from useAnime() context.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { StateView } from '@renderer/components/ui/state-view'
import { useRenderState } from '@renderer/composables'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import AnimeDetailActivityEmpty from './activity-empty.vue'
import AnimeDetailActivityStats from './activity-stats.vue'
import AnimeDetailActivityHeatmap from './activity-heatmap.vue'
import AnimeDetailActivityTrend from './activity-trend.vue'
import AnimeDetailActivityDistribution from './activity-distribution.vue'

/** Recent sessions only: the full history belongs to the statistics feature. */
const RECENT_SESSION_LIMIT = 20

const { episodes, sessions, isLoading, error } = useAnime()
const { m, f } = useI18n()

const state = useRenderState(isLoading, error, sessions)

const episodeNames = computed(
  () => new Map(episodes.value.map((episode) => [episode.id, formatEpisodeName(episode)]))
)

const recentSessions = computed(() => sessions.value.slice(0, RECENT_SESSION_LIMIT))

function formatEpisodeName(episode: { episodeNumber: number | null; name: string | null }): string {
  if (episode.name) return episode.name
  if (episode.episodeNumber === null) return m.value.common.emptyValue
  return m.value.anime.episodes.unnamed({ number: String(episode.episodeNumber) })
}
</script>

<template>
  <!-- Loading -->
  <StateView
    v-if="state === 'loading'"
    state="loading"
    class="py-12"
  />

  <!-- Empty -->
  <AnimeDetailActivityEmpty v-else-if="sessions.length === 0" />

  <!-- Content -->
  <div
    v-else
    class="space-y-6"
  >
    <!-- Stats Summary -->
    <Section :title="m.anime.activity.statsOverview">
      <AnimeDetailActivityStats :sessions="sessions" />
    </Section>

    <!-- Activity Heatmap -->
    <Section :title="m.anime.activity.heatmap">
      <div class="rounded-lg border p-4">
        <AnimeDetailActivityHeatmap :sessions="sessions" />
      </div>
    </Section>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
      <!-- Time Trend -->
      <Section
        :title="m.anime.activity.trend"
        class="flex h-full flex-col"
      >
        <div class="flex-1 rounded-lg border p-4">
          <AnimeDetailActivityTrend :sessions="sessions" />
        </div>
      </Section>

      <!-- Daily Distribution -->
      <Section
        :title="m.anime.activity.distribution"
        class="flex h-full flex-col"
      >
        <div class="flex-1 rounded-lg border p-4">
          <AnimeDetailActivityDistribution :sessions="sessions" />
        </div>
      </Section>
    </div>

    <!-- Recent Sessions -->
    <Section :title="m.anime.activity.recentSessions">
      <div class="space-y-2">
        <div
          v-for="session in recentSessions"
          :key="session.id"
          class="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 p-3"
        >
          <div class="flex items-center gap-3 min-w-0">
            <Icon
              icon="icon-[mdi--play-circle-outline]"
              class="size-4 text-muted-foreground shrink-0"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium truncate">
                {{
                  session.episodeId
                    ? (episodeNames.get(session.episodeId) ?? m.common.emptyValue)
                    : m.common.emptyValue
                }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ f.dateTimeRange(session.startedAt, session.endedAt) }}
              </p>
            </div>
          </div>

          <span class="text-xs text-muted-foreground shrink-0">
            {{ f.duration(session.endedAt.getTime() - session.startedAt.getTime()) }}
          </span>
        </div>
      </div>
    </Section>
  </div>
</template>
