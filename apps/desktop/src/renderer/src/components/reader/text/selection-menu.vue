<!--
Actions for the passage the reader just selected.
Boundary: it sits at a fixed place over the page rather than following the
selection, because the text lives inside the engine's own iframes and its screen
geometry is not the reader's to compute.
-->
<script setup lang="ts">
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Separator } from '@renderer/components/ui/separator'
import { useI18n } from '@renderer/composables/use-i18n'
import { HIGHLIGHT_COLORS, HIGHLIGHT_TINTS } from '@renderer/core/reader/text/highlight'
import type { HighlightColor } from '@shared/db/contracts/enums'

const emit = defineEmits<{
  highlight: [color: HighlightColor]
  copy: []
  dismiss: []
}>()

const { m } = useI18n()
</script>

<template>
  <div
    class="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-md border border-border bg-popover px-2 py-1.5 shadow-overlay"
  >
    <button
      v-for="color in HIGHLIGHT_COLORS"
      :key="color"
      type="button"
      :aria-label="m.reader.marks.highlight"
      class="size-5 rounded-full transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-popover"
      :style="{ backgroundColor: HIGHLIGHT_TINTS[color] }"
      @click="emit('highlight', color)"
    />

    <Separator
      orientation="vertical"
      class="mx-1 h-5"
    />

    <Button
      variant="ghost"
      size="icon-sm"
      :tooltip="m.reader.marks.copy"
      @click="emit('copy')"
    >
      <Icon
        icon="icon-[mdi--content-copy]"
        class="size-4"
      />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      :tooltip="m.reader.marks.dismiss"
      @click="emit('dismiss')"
    >
      <Icon
        icon="icon-[mdi--close]"
        class="size-4"
      />
    </Button>
  </div>
</template>
