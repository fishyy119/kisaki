<!--
  GamePlayButton
  Universal game play/stop button that syncs with game monitor state.
  Owns the four visible states (idle, launching, running, stopping) and the
  user notifications for every launch/stop outcome the button cannot show.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { useGameMonitorStore } from '@renderer/stores'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/utils/cn'
import { cva } from 'class-variance-authority'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import type { GameLaunchResult, GameStopResult } from '@shared/launcher'

const log = createLogger('Game')

type PlayButtonState = 'idle' | 'launching' | 'running' | 'stopping'

interface Props {
  gameId: string
  /** Display style */
  display?: 'icon' | 'labeled'
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  display: 'labeled',
  size: 'md'
})

const { m } = useI18n()

const gameMonitorStore = useGameMonitorStore()
const isRunning = computed(() => gameMonitorStore.isGameRunning(props.gameId))
const pendingAction = ref<'play' | 'stop' | null>(null)

/**
 * The monitor broadcast lands before the launcher IPC reply, so the in-flight
 * phase ends on the monitor state instead of the reply. Deriving both from one
 * value keeps a single visual transition per action.
 */
const state = computed<PlayButtonState>(() => {
  if (pendingAction.value === 'play' && !isRunning.value) return 'launching'
  if (pendingAction.value === 'stop' && isRunning.value) return 'stopping'
  return isRunning.value ? 'running' : 'idle'
})

const isBusy = computed(() => state.value === 'launching' || state.value === 'stopping')
const isStopAction = computed(() => state.value === 'running' || state.value === 'stopping')

const label = computed<string>(() => {
  const labels: Record<PlayButtonState, string> = {
    idle: m.value.game.play,
    launching: m.value.game.launching,
    running: m.value.game.stop,
    stopping: m.value.game.stopping
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

  const action = isRunning.value ? 'stop' : 'play'
  pendingAction.value = action

  try {
    if (action === 'stop') {
      const result = await ipcManager.invoke('launcher:kill-game', props.gameId)
      if (result.success) {
        notifyStopOutcome(result.data)
      } else {
        notifyUnexpected(action, result.error)
      }
    } else {
      const result = await ipcManager.invoke('launcher:launch-game', props.gameId)
      if (result.success) {
        notifyLaunchOutcome(result.data)
      } else {
        notifyUnexpected(action, result.error)
      }
    }
  } catch (error) {
    log.error('launcher call threw:', error)
    notifyUnexpected(action, error instanceof Error ? error.message : String(error))
  } finally {
    pendingAction.value = null
  }
}

function notifyLaunchOutcome(result: GameLaunchResult): void {
  const messages = m.value.launcher

  switch (result.status) {
    case 'detected':
      // The button switching to the running state already confirms the launch.
      return
    case 'cancelled':
      notify.warning(messages.launchCancelledTitle)
      return
    case 'unconfirmed':
      notify.warning(messages.launchRequestedTitle, messages[result.reason])
      return
    case 'failed':
      notify.error(messages.launchFailedTitle, messages.errors[result.reason])
  }
}

function notifyStopOutcome(result: GameStopResult): void {
  const messages = m.value.launcher

  switch (result.status) {
    case 'stopped':
      // The button switching back to the idle state already confirms the stop.
      return
    case 'unconfirmed':
      notify.warning(messages.stopRequestedTitle, messages.stopNotConfirmed)
      return
    case 'failed':
      notify.error(messages.stopFailedTitle, messages.errors[result.reason])
  }
}

/** Only transport or programming errors reach here; expected ones are results. */
function notifyUnexpected(action: 'play' | 'stop', error: string): void {
  log.warn(`launcher ${action} failed:`, error)

  const messages = m.value.launcher
  notify.error(action === 'stop' ? messages.stopFailedTitle : messages.launchFailedTitle, error)
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
