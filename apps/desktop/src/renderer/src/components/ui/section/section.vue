<!--
  Section - Content section with header row and inline empty placeholder.

  Header: muted title (overridable via #title), optional hover-revealed
  edit button, and #actions. Body: default slot, or the italic emptyText
  line when `empty` is set (inline placeholder; block-level states use
  StateView instead).
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/utils/cn'

interface Props {
  title?: string
  /** Show hover-revealed edit button emitting `edit` */
  editable?: boolean
  /** Render the emptyText placeholder instead of the default slot */
  empty?: boolean
  emptyText?: string
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: []
}>()
</script>

<template>
  <section
    data-slot="section"
    :class="cn(props.class)"
  >
    <div class="group mb-2 flex items-center justify-between gap-2">
      <slot name="title">
        <h3 class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {{ props.title }}
        </h3>
      </slot>
      <div class="flex items-center gap-1">
        <slot name="actions" />
        <Button
          v-if="props.editable"
          variant="ghost"
          size="icon-sm"
          class="p-0.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-primary"
          :aria-label="`Edit ${props.title}`"
          @click="emit('edit')"
        >
          <Icon
            icon="icon-[mdi--pencil-outline]"
            class="size-3.5"
          />
        </Button>
      </div>
    </div>

    <p
      v-if="props.empty"
      class="text-xs text-muted-foreground italic"
    >
      {{ props.emptyText }}
    </p>
    <slot v-else />
  </section>
</template>
