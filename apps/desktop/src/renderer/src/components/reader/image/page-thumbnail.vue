<!--
One page preview in the page grid.
Boundary: it resolves its own preview when mounted, so a virtualized grid only
ever pays for the rows on screen.
-->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Spinner } from '@renderer/components/ui/spinner'
import { createLogger } from '@renderer/core/log'
import type { PageSource } from '@renderer/core/reader/image/source'
import { cn } from '@renderer/utils/cn'

const props = withDefaults(
  defineProps<{
    source: PageSource
    index: number
    active: boolean
    /** Show the page number under the preview; off where the row names it. */
    numbered?: boolean
  }>(),
  { numbered: true }
)

const emit = defineEmits<{
  select: [index: number]
}>()

const log = createLogger('Reader')

const url = ref('')
const failed = ref(false)

onMounted(async () => {
  try {
    url.value = await props.source.getThumbnailUrl(props.index)
  } catch (error) {
    failed.value = true
    log.warn('Failed to resolve a page preview.', error, { index: props.index })
  }
})
</script>

<template>
  <button
    type="button"
    :class="
      cn(
        'flex flex-col items-center gap-1 rounded-md border p-1 transition-colors',
        props.active ? 'border-primary bg-accent/50' : 'border-transparent hover:bg-accent/50'
      )
    "
    @click="emit('select', props.index)"
  >
    <span class="flex h-24 w-full items-center justify-center overflow-hidden rounded bg-muted">
      <img
        v-if="url"
        :src="url"
        class="max-h-full max-w-full select-none object-contain"
        decoding="async"
        draggable="false"
        :alt="String(props.index + 1)"
      />
      <Spinner
        v-else-if="!failed"
        class="size-3 text-muted-foreground"
      />
    </span>
    <span
      v-if="props.numbered"
      class="text-xs tabular-nums text-muted-foreground"
    >
      {{ props.index + 1 }}
    </span>
  </button>
</template>
