<!--
  MovieDetailExtraItem
  One extra row: identity, primary-file facts, and playback. Extras carry no
  watch state, so playback runs through the untracked extra channel; while
  playing it shows live progress with pause/resume next to the stop action.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'
import { useMovieExtraPlayback } from '@renderer/composables/use-movie-extra-playback'
import { cn } from '@renderer/utils/cn'
import type { MovieExtraEntry } from '@renderer/composables/use-movie'
import type { MovieExtraType } from '@shared/db'
import { MediaPlaybackProgress } from '@renderer/components/shared/media'

/** Icon per extra type, so rows stay tellable apart inside one type group. */
const EXTRA_TYPE_ICONS: Record<MovieExtraType, string> = {
  trailer: 'icon-[mdi--movie-roll]',
  teaser: 'icon-[mdi--play-box-outline]',
  behindTheScenes: 'icon-[mdi--camera-outline]',
  featurette: 'icon-[mdi--filmstrip]',
  deletedScene: 'icon-[mdi--scissors-cutting]',
  interview: 'icon-[mdi--microphone-outline]',
  other: 'icon-[mdi--movie-open-outline]'
}

interface Props {
  extra: MovieExtraEntry
}

const props = defineProps<Props>()

const emit = defineEmits<{
  openFolder: [path: string]
  openDetail: []
}>()

const { m, f } = useI18n()

/** Files arrive primary-first from the provider, so the head is the playable one. */
const primaryFile = computed(() => props.extra.files[0])

const resolution = computed(() => {
  const file = primaryFile.value
  return file?.width && file.height ? `${file.width}×${file.height}` : null
})

const {
  isPlaying,
  playbackStatus,
  playbackProgress,
  isPaused,
  isPauseActionPending,
  togglePause,
  isActionPending,
  play,
  stop
} = useMovieExtraPlayback(() => props.extra.id)
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/50',
        !primaryFile && 'opacity-70'
      )
    "
  >
    <div class="flex items-center gap-3 min-w-0">
      <Icon
        :icon="EXTRA_TYPE_ICONS[props.extra.type]"
        class="size-4 text-muted-foreground shrink-0"
      />

      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-xs font-mono text-muted-foreground shrink-0">
            {{ m.library.movieExtraType[props.extra.type] }}
          </span>
          <p class="text-sm font-medium truncate">{{ props.extra.name }}</p>
        </div>

        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span v-if="!primaryFile">{{ m.movie.files.missingFile }}</span>
          <template v-else>
            <span v-if="resolution">{{ resolution }}</span>
            <span v-if="resolution && primaryFile.videoCodec">·</span>
            <span v-if="primaryFile.videoCodec">{{ primaryFile.videoCodec }}</span>
            <template v-if="primaryFile.durationMs">
              <span>·</span>
              <span>{{ f.duration(primaryFile.durationMs) }}</span>
            </template>
            <template v-if="props.extra.files.length > 1">
              <span>·</span>
              <span>{{ m.movie.files.fileCount({ count: props.extra.files.length }) }}</span>
            </template>
          </template>
        </div>

        <!-- Live playback progress for the currently-playing extra -->
        <MediaPlaybackProgress
          v-if="isPlaying"
          :status="playbackStatus"
          :progress="playbackProgress"
        />
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.movie.showDetail"
        @click="emit('openDetail')"
      >
        <Icon
          icon="icon-[mdi--information-outline]"
          class="size-4"
        />
      </Button>

      <Button
        v-if="primaryFile"
        variant="ghost"
        size="icon-sm"
        :tooltip="m.movie.files.openFolder"
        @click="emit('openFolder', primaryFile.path)"
      >
        <Icon
          icon="icon-[mdi--folder-open-outline]"
          class="size-4"
        />
      </Button>

      <Button
        v-if="isPlaying"
        variant="ghost"
        size="icon-sm"
        :disabled="isPauseActionPending"
        :tooltip="isPaused ? m.movie.player.resume : m.movie.player.pause"
        @click="togglePause"
      >
        <Icon
          :icon="isPaused ? 'icon-[mdi--play]' : 'icon-[mdi--pause]'"
          class="size-4"
        />
      </Button>

      <Button
        v-if="isPlaying"
        variant="ghost"
        size="icon-sm"
        :disabled="isActionPending"
        :tooltip="m.movie.stop"
        @click="stop"
      >
        <Icon
          icon="icon-[mdi--stop]"
          class="size-4"
        />
      </Button>
      <Button
        v-else
        variant="ghost"
        size="icon-sm"
        :disabled="isActionPending || !primaryFile"
        :tooltip="m.movie.extras.play"
        @click="play()"
      >
        <Icon
          icon="icon-[mdi--play]"
          class="size-4"
        />
      </Button>
    </div>
  </div>
</template>
