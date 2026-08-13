<!--
  AnimeDetailEpisodeItem
  One episode row: identity, watch state, file facts, and the watch action.
  While the episode is being watched it also shows live playback progress
  with pause/resume controls next to the stop action.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'
import { usePlayerControls } from '@renderer/composables/use-player-controls'
import { useAnimeActivityStore } from '@renderer/stores'
import { cn } from '@renderer/utils/cn'
import type { AnimeEpisodeEntry } from '@renderer/composables/use-anime'
import AnimeWatchButton from '../../../anime-watch-button.vue'
import AnimePlaybackProgress from './playback-progress.vue'

interface Props {
  animeId: string
  episode: AnimeEpisodeEntry
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggleWatched: []
  /** Carries the playable file path so the parent never re-derives it. */
  openFolder: [path: string]
  openDetail: []
}>()

const { m, f } = useI18n()

const activityStore = useAnimeActivityStore()

const isWatched = computed(() => props.episode.watchedAt !== null)
const playableFile = computed(() => props.episode.files[0] ?? null)

const title = computed(() => {
  const number = props.episode.episodeNumber
  const numbered =
    number === null ? null : m.value.anime.episodes.unnamed({ number: formatNumber(number) })
  return props.episode.name ?? numbered ?? m.value.common.emptyValue
})

const resolution = computed(() => {
  const file = playableFile.value
  return file?.width && file.height ? `${file.width}×${file.height}` : null
})

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

// =============================================================================
// Live playback (only for the currently-watching episode)
// =============================================================================

const isWatchingNow = computed(() => activityStore.isEpisodeWatching(props.episode.id))
const watchingSession = computed(() =>
  isWatchingNow.value ? activityStore.getWatchingStatus(props.animeId) : undefined
)
const playbackStatus = computed(() =>
  isWatchingNow.value ? activityStore.getPlaybackStatus(props.animeId) : undefined
)
const playbackProgress = computed(() =>
  isWatchingNow.value ? activityStore.getProgress(props.animeId) : undefined
)

const {
  isPaused,
  isPending: isPlayerActionPending,
  togglePause: handleTogglePause
} = usePlayerControls({
  sessionId: () => watchingSession.value?.sessionId,
  status: () => playbackStatus.value
})
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/50',
        !playableFile && 'opacity-70'
      )
    "
  >
    <div class="flex items-center gap-3 min-w-0">
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="isWatched ? m.anime.episodes.markUnwatched : m.anime.episodes.markWatched"
        @click="emit('toggleWatched')"
      >
        <Icon
          :icon="isWatched ? 'icon-[mdi--check-circle]' : 'icon-[mdi--circle-outline]'"
          :class="cn('size-4', isWatched && 'text-success')"
        />
      </Button>

      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span
            v-if="props.episode.episodeNumber !== null"
            class="text-xs font-mono text-muted-foreground shrink-0"
          >
            {{ formatNumber(props.episode.episodeNumber) }}
          </span>
          <p class="text-sm font-medium truncate">{{ title }}</p>
          <Badge
            v-if="props.episode.type !== 'regular'"
            variant="secondary"
            class="shrink-0"
          >
            {{ m.library.animeEpisodeType[props.episode.type] }}
          </Badge>
        </div>

        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span v-if="!playableFile">{{ m.anime.files.missingFile }}</span>
          <template v-else>
            <span v-if="resolution">{{ resolution }}</span>
            <span v-if="resolution && playableFile.videoCodec">·</span>
            <span v-if="playableFile.videoCodec">{{ playableFile.videoCodec }}</span>
            <template v-if="props.episode.files.length > 1">
              <span>·</span>
              <span>{{ m.anime.files.fileCount({ count: props.episode.files.length }) }}</span>
            </template>
          </template>
          <template v-if="props.episode.durationMs">
            <span>·</span>
            <span>{{ f.duration(props.episode.durationMs) }}</span>
          </template>
          <template v-if="props.episode.resumePositionMs">
            <span>·</span>
            <span>
              {{
                m.anime.episodes.resumeAt({
                  position: f.durationFine(props.episode.resumePositionMs)
                })
              }}
            </span>
          </template>
        </div>

        <!-- Live playback progress for the currently-watching episode -->
        <AnimePlaybackProgress
          v-if="isWatchingNow"
          :status="playbackStatus"
          :progress="playbackProgress"
        />
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.anime.showDetail"
        @click="emit('openDetail')"
      >
        <Icon
          icon="icon-[mdi--information-outline]"
          class="size-4"
        />
      </Button>

      <Button
        v-if="playableFile"
        variant="ghost"
        size="icon-sm"
        :tooltip="m.anime.files.openFolder"
        @click="emit('openFolder', playableFile.path)"
      >
        <Icon
          icon="icon-[mdi--folder-open-outline]"
          class="size-4"
        />
      </Button>

      <Button
        v-if="watchingSession"
        variant="ghost"
        size="icon-sm"
        :disabled="isPlayerActionPending"
        :tooltip="isPaused ? m.anime.player.resume : m.anime.player.pause"
        @click="handleTogglePause"
      >
        <Icon
          :icon="isPaused ? 'icon-[mdi--play]' : 'icon-[mdi--pause]'"
          class="size-4"
        />
      </Button>

      <AnimeWatchButton
        v-if="playableFile"
        :anime-id="props.animeId"
        :episode-id="props.episode.id"
        display="icon"
        size="sm"
      />
    </div>
  </div>
</template>
