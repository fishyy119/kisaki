<!--
  AnimeWatchButton
  Watch/stop button for an anime entry or a specific episode. Owns the four
  visible states (idle, starting, playing, stopping) and the notifications for
  every watch outcome the button itself cannot show.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, ref } from 'vue'
import { cva } from 'class-variance-authority'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { useI18n } from '@renderer/composables/use-i18n'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useAnimeActivityStore } from '@renderer/stores'
import { cn } from '@renderer/utils/cn'
import type { AnimeStopResult, AnimeWatchResult } from '@shared/activity'

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

const label = computed<string>(() => {
  const labels: Record<WatchButtonState, string> = {
    idle: m.value.anime.watch,
    starting: m.value.anime.starting,
    playing: m.value.anime.stop,
    stopping: m.value.anime.stopping
  }
  return labels[state.value]
})

// Hover transform lives on the wrapper: the button drops pointer events while
// busy, which would otherwise snap the scale back mid-action.
const iconButtonVariants = cva(
  'relative transition-transform duration-200 ease-in-out hover:scale-120',
  {
    variants: {
      size: {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-14 h-14'
      }
    },
    defaultVariants: { size: 'md' }
  }
)

const iconVariants = cva('', {
  variants: {
    size: {
      sm: 'w-5 h-5',
      md: 'w-6 h-6',
      lg: 'w-8 h-8'
    }
  },
  defaultVariants: { size: 'md' }
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
  <div
    v-if="props.display === 'icon'"
    :class="cn(iconButtonVariants({ size: props.size }), props.class)"
  >
    <Button
      :variant="isStopAction ? 'secondary' : 'default'"
      :disabled="isBusy"
      :aria-busy="isBusy"
      :aria-label="label"
      :class="
        cn(
          'rounded-full w-full h-full p-0 disabled:opacity-100',
          isStopAction ? 'bg-secondary hover:bg-secondary/80' : 'bg-primary hover:bg-primary/80'
        )
      "
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
  </div>

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
