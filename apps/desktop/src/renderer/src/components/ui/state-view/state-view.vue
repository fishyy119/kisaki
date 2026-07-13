<!--
  StateView - Block-level placeholder for async render states.

  Maps `useRenderState` results (plus an explicit 'empty') to a unified
  centered placeholder: spinner for loading, icon + text for
  error/not-found/empty. Renders nothing for 'pending' and 'success'.
  Complements the Empty family, which stays a compositional layout kit.
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
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

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
    v-if="props.state === 'loading' || isMessage"
    data-slot="state-view"
    :class="cn('flex flex-col items-center justify-center text-center', props.class)"
  >
    <Spinner
      v-if="props.state === 'loading'"
      class="size-8 text-muted-foreground"
    />

    <template v-else>
      <Icon
        v-if="displayIcon"
        :icon="displayIcon"
        :class="
          cn(
            'mb-3 size-12',
            props.state === 'error' ? 'text-destructive/50' : 'text-muted-foreground/50'
          )
        "
      />
      <p
        v-if="displayTitle"
        class="text-lg font-medium"
      >
        {{ displayTitle }}
      </p>
      <p
        v-if="displayDescription"
        class="mt-1 text-sm text-muted-foreground"
      >
        {{ displayDescription }}
      </p>
      <div
        v-if="$slots.actions"
        class="mt-4 flex items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </template>
  </div>
</template>
