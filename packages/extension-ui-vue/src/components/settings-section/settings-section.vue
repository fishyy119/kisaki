<!--
Settings Section groups related settings under a heading with an optional
actions group, in the compact Kisaki settings rhythm. The `rows` surface is the
multi-section settings recipe: the section's fields sit in one bordered,
divider-separated column so several sections on one page stay distinct and
scannable. Plain sections carry content that frames itself, such as data lists,
action rows, or documentation.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils/cn'

type SettingsSectionSurface = 'plain' | 'rows'

const props = withDefaults(
  defineProps<{
    title?: string
    /** One line of context under the heading; omit when the title says it all. */
    description?: string
    surface?: SettingsSectionSurface
    class?: HTMLAttributes['class']
  }>(),
  {
    title: undefined,
    description: undefined,
    surface: 'plain',
    class: undefined
  }
)

const rowsSurfaceClass = [
  'overflow-hidden rounded-md border border-border',
  '[&>[data-slot=field-group]]:gap-0',
  '[&>[data-slot=field-group]]:divide-y',
  '[&>[data-slot=field-group]]:divide-border',
  '[&>[data-slot=field-group]>[data-slot=field]]:px-3',
  '[&>[data-slot=field-group]>[data-slot=field]]:py-2.5'
]
</script>

<template>
  <section
    data-slot="settings-section"
    :class="cn('space-y-2', props.class)"
  >
    <header class="flex min-w-0 items-start justify-between gap-3">
      <div class="min-w-0">
        <slot name="title">
          <h2
            v-if="props.title"
            class="text-sm font-medium"
          >
            {{ props.title }}
          </h2>
        </slot>
        <p
          v-if="props.description"
          class="mt-0.5 text-xs text-muted-foreground"
        >
          {{ props.description }}
        </p>
      </div>
      <div
        v-if="$slots.actions"
        class="flex shrink-0 items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </header>

    <div
      v-if="props.surface === 'rows'"
      :class="rowsSurfaceClass"
    >
      <slot />
    </div>
    <slot v-else />
  </section>
</template>
