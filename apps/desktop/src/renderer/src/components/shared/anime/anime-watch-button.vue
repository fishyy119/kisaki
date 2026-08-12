<!--
  AnimeWatchButton
  Watch/stop button for an anime entry or a specific episode. The watch action
  reads "start" or "continue" depending on recorded watch progress, transitional
  phases keep the action label and show a spinner, and the button owns the
  notifications for every watch outcome it cannot show itself.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, ref, watch } from 'vue'
import { cva } from 'class-variance-authority'
import { and, eq, isNotNull, or } from 'drizzle-orm'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { useDbChanges } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useAnimeActivityStore } from '@renderer/stores'
import { cn } from '@renderer/utils/cn'
import type { AnimeStopResult, AnimeWatchResult } from '@shared/activity'
import { animeEpisodes } from '@shared/db'

const log = createLogger('Anime')

type WatchButtonState = 'idle' | 'starting' | 'playing' | 'stopping'

interface Props {
  animeId: string
  /** Watch this episode instead of the next unwatched one. */
  episodeId?: string
  display?: 'icon' | 'labeled'
  size?: 'sm' | 'md' | 'lg'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  display: 'labeled',
  size: 'md'
})

const { m } = useI18n()

const activityStore = useAnimeActivityStore()
const pendingAction = ref<'watch' | 'stop' | null>(null)

/**
 * An episode button only reflects its own playback; the entry button reflects
 * any episode of the entry.
 */
const isPlaying = computed(() =>
  props.episodeId
    ? activityStore.isEpisodeWatching(props.episodeId)
    : activityStore.isAnimeWatching(props.animeId)
)

// The activity broadcast lands before the IPC reply, so the in-flight phase
// ends on the tracked state instead of the reply.
const state = computed<WatchButtonState>(() => {
  if (pendingAction.value === 'watch' && !isPlaying.value) return 'starting'
  if (pendingAction.value === 'stop' && isPlaying.value) return 'stopping'
  return isPlaying.value ? 'playing' : 'idle'
})

const isBusy = computed(() => state.value === 'starting' || state.value === 'stopping')
const isStopAction = computed(() => state.value === 'playing' || state.value === 'stopping')

/**
 * Whether the watch action resumes existing progress: an episode button resumes
 * from the episode's own resume point, while an entry button resumes once any
 * episode carries watch progress.
 */
const hasProgress = ref(false)

async function refreshProgress(): Promise<void> {
  const { animeId, episodeId } = props

  if (episodeId) {
    const [row] = await db
      .select({ resumePositionMs: animeEpisodes.resumePositionMs })
      .from(animeEpisodes)
      .where(eq(animeEpisodes.id, episodeId))
      .limit(1)
    hasProgress.value = (row?.resumePositionMs ?? null) !== null
    return
  }

  const [row] = await db
    .select({ id: animeEpisodes.id })
    .from(animeEpisodes)
    .where(
      and(
        eq(animeEpisodes.animeId, animeId),
        or(isNotNull(animeEpisodes.watchedAt), isNotNull(animeEpisodes.resumePositionMs))
      )
    )
    .limit(1)
  hasProgress.value = row !== undefined
}

watch(() => [props.animeId, props.episodeId], () => void refreshProgress(), { immediate: true })

useDbChanges(({ table }) => {
  if (table === 'anime_episodes') void refreshProgress()
})

// Transitional phases keep the action label; the spinner alone signals progress.
const label = computed<string>(() =>
  isStopAction.value
    ? m.value.anime.stop
    : hasProgress.value
      ? m.value.anime.watchContinue
      : m.value.anime.watchStart
)

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

  if (pendingAction.value) {
    return
  }

  const action = isPlaying.value ? 'stop' : 'watch'
  pendingAction.value = action

  try {
    if (action === 'stop') {
      const result = await ipcManager.invoke('activity:stop-anime', props.animeId)
      if (result.success) {
        notifyStopOutcome(result.data)
      } else {
        notifyUnexpected(action, result.error)
      }
    } else {
      const result = await ipcManager.invoke('activity:watch-anime', props.animeId, props.episodeId)
      if (result.success) {
        notifyWatchOutcome(result.data)
      } else {
        notifyUnexpected(action, result.error)
      }
    }
  } catch (error) {
    log.error('activity call threw:', error)
    notifyUnexpected(action, error instanceof Error ? error.message : String(error))
  } finally {
    pendingAction.value = null
  }
}

function notifyWatchOutcome(result: AnimeWatchResult): void {
  // The button switching to the playing state already confirms a start.
  if (result.status === 'failed') {
    notify.error(m.value.activity.watchFailedTitle, m.value.activity.errors[result.reason])
  }
}

function notifyStopOutcome(result: AnimeStopResult): void {
  if (result.status === 'failed') {
    notify.error(m.value.activity.watchStopFailedTitle, m.value.activity.errors[result.reason])
  }
}

/** Only transport or programming errors reach here; expected ones are results. */
function notifyUnexpected(action: 'watch' | 'stop', error: string): void {
  log.warn(`activity ${action} failed:`, error)

  const messages = m.value.activity
  notify.error(action === 'stop' ? messages.watchStopFailedTitle : messages.watchFailedTitle, error)
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
