<!--
  AnimeDetailEpisodeItem
  One episode row: identity, watch state, file facts, and the watch action.
  While the episode is being watched it also shows live playback progress
  with pause/resume controls next to the stop action.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Progress } from '@renderer/components/ui/progress'
import { useI18n } from '@renderer/composables/use-i18n'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useAnimeActivityStore } from '@renderer/stores'
import { cn } from '@renderer/utils/cn'
import type { AnimeEpisodeEntry } from '@renderer/composables/use-anime'
import AnimeWatchButton from '../../../anime-watch-button.vue'

const log = createLogger('Anime')

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

const isPaused = computed(() => playbackStatus.value === 'paused')

const progressPercent = computed(() => {
  const progress = playbackProgress.value
  if (!progress?.durationMs) return 0
  return Math.min(100, (progress.positionMs / progress.durationMs) * 100)
})

const playbackLabel = computed(() => {
  if (playbackStatus.value === 'paused') return m.value.anime.player.paused
  if (playbackStatus.value === 'loading') return m.value.anime.starting
  return m.value.anime.playing
})

const playbackTimeText = computed(() => {
  const progress = playbackProgress.value
  if (!progress) return null
  const position = f.value.durationFine(progress.positionMs)
  return progress.durationMs === null
    ? position
    : `${position} / ${f.value.duration(progress.durationMs)}`
})

const isPlayerActionPending = ref(false)

async function handleTogglePause(): Promise<void> {
  const session = watchingSession.value
  if (!session || isPlayerActionPending.value) return

  const resume = isPaused.value
  isPlayerActionPending.value = true
  try {
    const result = resume
      ? await ipcManager.invoke('player:resume', session.sessionId)
      : await ipcManager.invoke('player:pause', session.sessionId)
    if (!result.success) {
      notifyPlayerFailure(resume, result.error)
    }
  } catch (error) {
    log.error('player control call threw:', error)
    notifyPlayerFailure(resume, error instanceof Error ? error.message : String(error))
  } finally {
    isPlayerActionPending.value = false
  }
}

function notifyPlayerFailure(resume: boolean, error: string): void {
  const messages = m.value.anime.player
  notify.error(resume ? messages.resumeFailed : messages.pauseFailed, error)
}
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
          <span v-if="!playableFile">{{ m.anime.episodes.missingFile }}</span>
          <template v-else>
            <span v-if="resolution">{{ resolution }}</span>
            <span v-if="resolution && playableFile.videoCodec">·</span>
            <span v-if="playableFile.videoCodec">{{ playableFile.videoCodec }}</span>
            <template v-if="props.episode.files.length > 1">
              <span>·</span>
              <span>{{ m.anime.episodes.fileCount({ count: props.episode.files.length }) }}</span>
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
        <div
          v-if="isWatchingNow"
          class="mt-1.5 flex items-center gap-2"
        >
          <span
            :class="
              cn(
                'text-xs font-medium shrink-0',
                isPaused ? 'text-muted-foreground' : 'text-primary'
              )
            "
          >
            {{ playbackLabel }}
          </span>
          <Progress
            :model-value="progressPercent"
            class="h-1 w-40 shrink-0"
          />
          <span
            v-if="playbackTimeText"
            class="text-xs text-muted-foreground truncate"
          >
            {{ playbackTimeText }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.anime.episodes.showDetail"
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
