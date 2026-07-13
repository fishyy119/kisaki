<!--
  StateView - Block-level placeholder for async render states.

  Maps `useRenderState` results (plus an explicit 'empty') to a unified
  centered placeholder: spinner for loading, icon + text (+ actions slot)
  for error/not-found/empty. Renders nothing for 'success'; for 'pending'
  it renders an empty container so the caller's region paint (e.g.
  bg-background) stays in place and the ambient light layer never flashes
  through during the pre-spinner window.
  This is the single block-level placeholder for the app; inline busy
  indicators keep using Spinner directly.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import type { RenderState } from '@renderer/composables'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { cn } from '@renderer/utils/cn'

interface Props {
  state: RenderState | 'empty'
  /** Icon for not-found/empty states; the error state uses a fixed alert presentation */
  icon?: string
  title?: string
  description?: string
  /** Error detail shown as description in the error state */
  error?: string | Error | null
  /** md for page/panel regions (default), sm for compact areas such as dialog result panes */
  size?: 'md' | 'sm'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

const SIZE_CLASSES = {
  md: {
    spinner: 'size-8',
    icon: 'mb-3 size-12',
    title: 'text-lg',
    description: 'text-sm',
    actions: 'mt-4'
  },
  sm: {
    spinner: 'size-5',
    icon: 'mb-2 size-6',
    title: 'text-sm',
    description: 'text-xs',
    actions: 'mt-3'
  }
} as const

const sizeClasses = computed(() => SIZE_CLASSES[props.size])

const isMessage = computed(
  () => props.state === 'error' || props.state === 'not-found' || props.state === 'empty'
)

const displayIcon = computed(() =>
  props.state === 'error' ? 'icon-[mdi--alert-circle-outline]' : props.icon
)

const displayTitle = computed(() => (props.state === 'error' ? '加载失败' : props.title))

const displayDescription = computed(() => {
  if (props.state === 'error')
    return props.error instanceof Error ? props.error.message : (props.error ?? undefined)
  return props.description
})
</script>

<template>
  <div
    v-if="props.state !== 'success'"
    data-slot="state-view"
    :class="cn('flex flex-col items-center justify-center text-center', props.class)"
  >
    <Spinner
      v-if="props.state === 'loading'"
      :class="cn('text-muted-foreground', sizeClasses.spinner)"
    />

    <template v-else-if="isMessage">
      <Icon
        v-if="displayIcon"
        :icon="displayIcon"
        :class="
          cn(
            sizeClasses.icon,
            props.state === 'error' ? 'text-destructive/50' : 'text-muted-foreground/50'
          )
        "
      />
      <p
        v-if="displayTitle"
        :class="cn('font-medium', sizeClasses.title)"
      >
        {{ displayTitle }}
      </p>
      <p
        v-if="displayDescription"
        :class="cn('mt-1 text-muted-foreground', sizeClasses.description)"
      >
        {{ displayDescription }}
      </p>
      <div
        v-if="$slots.actions"
        :class="cn('flex items-center gap-2', sizeClasses.actions)"
      >
        <slot name="actions" />
      </div>
    </template>
  </div>
</template>
