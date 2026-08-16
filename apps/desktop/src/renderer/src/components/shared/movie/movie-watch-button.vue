<!--
  MovieWatchButton
  Watch/stop button for a movie entry. The watch action reads "watch",
  "continue", or "again" depending on the entry's own watch state, and
  transitional phases keep the action label and show a spinner. Transport and
  failure notices live in the shared watch facade.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, ref, watch } from 'vue'
import { cva } from 'class-variance-authority'
import { eq } from 'drizzle-orm'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { useDbChanges } from '@renderer/composables'
import { useMovieWatch } from '@renderer/composables/use-movie-watch'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { cn } from '@renderer/utils/cn'
import { movies } from '@shared/db'

type WatchButtonState = 'idle' | 'starting' | 'playing' | 'stopping'

/** Which watch phase the entry is in, before any transport starts. */
type WatchProgress = 'none' | 'resumable' | 'rewatch'

interface Props {
  movieId: string
  display?: 'icon' | 'labeled'
  size?: 'sm' | 'md' | 'lg'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  display: 'labeled',
  size: 'md'
})

const { m } = useI18n()

const {
  isWatching,
  pendingAction,
  watch: watchMovie,
  stop: stopMovie
} = useMovieWatch(() => props.movieId)

// The activity broadcast lands before the IPC reply, so the in-flight phase
// ends on the tracked state instead of the reply.
const state = computed<WatchButtonState>(() => {
  if (pendingAction.value === 'start' && !isWatching.value) return 'starting'
  if (pendingAction.value === 'stop' && isWatching.value) return 'stopping'
  return isWatching.value ? 'playing' : 'idle'
})

const isBusy = computed(() => state.value === 'starting' || state.value === 'stopping')
const isStopAction = computed(() => state.value === 'playing' || state.value === 'stopping')

/**
 * A stored resume point outranks the watched mark: a rewatch that was paused
 * midway is still resumable.
 */
const progress = ref<WatchProgress>('none')

async function refreshProgress(): Promise<void> {
  const [row] = await db
    .select({ watched: movies.watched, resumePositionMs: movies.resumePositionMs })
    .from(movies)
    .where(eq(movies.id, props.movieId))
    .limit(1)

  progress.value =
    (row?.resumePositionMs ?? null) !== null ? 'resumable' : row?.watched ? 'rewatch' : 'none'
}

watch(
  () => props.movieId,
  () => void refreshProgress(),
  { immediate: true }
)

useDbChanges(({ table, id }) => {
  if (table === 'movies' && id === props.movieId) void refreshProgress()
})

// Transitional phases keep the action label; the spinner alone signals progress.
const label = computed<string>(() => {
  if (isStopAction.value) return m.value.movie.stop
  if (progress.value === 'resumable') return m.value.movie.watchContinue
  return progress.value === 'rewatch' ? m.value.movie.watchAgain : m.value.movie.watchStart
})

const iconVariants = cva('', {
  variants: {
    size: {
      sm: 'size-4',
      md: 'size-4',
      lg: 'size-5'
    }
  },
  defaultVariants: { size: 'md' }
})

const iconButtonSize = computed(() => {
  if (props.size === 'lg') return 'icon-lg'
  if (props.size === 'sm') return 'icon-sm'
  return 'icon'
})

// Reserve the widest label so switching states never shifts the surrounding row.
const labeledVariants = cva('gap-1.5 disabled:opacity-100', {
  variants: {
    size: {
      sm: 'min-w-24',
      md: 'min-w-28',
      lg: 'min-w-28'
    }
  },
  defaultVariants: { size: 'md' }
})

const labeledButtonSize = computed(() => {
  if (props.size === 'lg') return 'lg'
  if (props.size === 'sm') return 'sm'
  return 'default'
})

async function handleClick(e: Event) {
  e.stopPropagation()
  e.preventDefault()
  await (isWatching.value ? stopMovie() : watchMovie())
}
</script>

<template>
  <!-- Icon variant -->
  <Button
    v-if="props.display === 'icon'"
    variant="ghost"
    :size="iconButtonSize"
    :disabled="isBusy"
    :aria-busy="isBusy"
    :aria-label="label"
    :tooltip="label"
    :class="cn('disabled:opacity-100', props.class)"
    @click="handleClick"
  >
    <Spinner
      v-if="isBusy"
      :class="iconVariants({ size: props.size })"
    />
    <Icon
      v-else
      :icon="isStopAction ? 'icon-[mdi--stop]' : 'icon-[mdi--play]'"
      :class="iconVariants({ size: props.size })"
    />
  </Button>

  <!-- Labeled variant -->
  <Button
    v-else
    :variant="isStopAction ? 'secondary' : 'default'"
    :size="labeledButtonSize"
    :disabled="isBusy"
    :aria-busy="isBusy"
    :class="cn(labeledVariants({ size: props.size }), props.class)"
    @click="handleClick"
  >
    <Spinner
      v-if="isBusy"
      class="size-4"
    />
    <Icon
      v-else
      :icon="isStopAction ? 'icon-[mdi--stop]' : 'icon-[mdi--play]'"
      class="size-4"
    />
    {{ label }}
  </Button>
</template>
