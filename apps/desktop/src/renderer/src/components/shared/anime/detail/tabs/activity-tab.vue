<!--
  Anime Activity Tab

  Watch totals plus the recent watch sessions of the entry.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { StateView } from '@renderer/components/ui/state-view'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'

/** Recent sessions only: the full history belongs to the statistics feature. */
const RECENT_SESSION_LIMIT = 20

const { anime, episodes, sessions } = useAnime()
const { m, f } = useI18n()

const episodeNames = computed(
  () => new Map(episodes.value.map((episode) => [episode.id, formatEpisodeName(episode)]))
)

const recentSessions = computed(() => sessions.value.slice(0, RECENT_SESSION_LIMIT))

const stats = computed(() => ({
  totalDuration: anime.value?.totalDuration ?? 0,
  sessionCount: sessions.value.length,
  lastWatchedAt: anime.value?.lastActiveAt ?? null
}))

function formatEpisodeName(episode: { episodeNumber: number | null; name: string | null }): string {
  if (episode.name) return episode.name
  if (episode.episodeNumber === null) return m.value.common.emptyValue
  return m.value.anime.episodes.unnamed({ number: String(episode.episodeNumber) })
}
</script>

<template>
  <template v-if="anime">
    <StateView
      v-if="sessions.length === 0"
      state="empty"
      icon="icon-[mdi--report-timeline-variant]"
      :title="m.anime.activity.emptyTitle"
      :description="m.anime.activity.emptyHint"
      class="py-12"
    />

    <div
      v-else
      class="space-y-6"
    >
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-lg border bg-muted/50 p-3">
          <p class="text-xs text-muted-foreground">{{ m.anime.activity.watchDuration }}</p>
          <p class="text-sm font-medium mt-1">{{ f.duration(stats.totalDuration) }}</p>
        </div>
        <div class="rounded-lg border bg-muted/50 p-3">
          <p class="text-xs text-muted-foreground">{{ m.anime.activity.sessionCount }}</p>
          <p class="text-sm font-medium mt-1">{{ f.number(stats.sessionCount) }}</p>
        </div>
        <div class="rounded-lg border bg-muted/50 p-3">
          <p class="text-xs text-muted-foreground">{{ m.anime.activity.lastWatched }}</p>
          <p class="text-sm font-medium mt-1">
            {{ stats.lastWatchedAt ? f.relativeTime(stats.lastWatchedAt) : m.common.emptyValue }}
          </p>
        </div>
      </div>

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
    </div>
  </template>
</template>
