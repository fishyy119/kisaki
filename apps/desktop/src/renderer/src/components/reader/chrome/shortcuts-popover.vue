<!--
Lists the reader's keyboard bindings.
Boundary: display only — the bindings themselves live in each engine's keydown
handler, and this is the surface that makes them discoverable.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useI18n } from '@renderer/composables/use-i18n'

const props = defineProps<{
  /** Page-grid bindings; reflowable text has no page to jump to. */
  paged: boolean
  /** Zoom bindings; only the comic engine scales its pages. */
  zoomable: boolean
  /** Search binding; only a text layer can be searched. */
  searchable: boolean
}>()

const { m } = useI18n()

const bindings = computed(() => [
  { label: m.value.reader.shortcuts.turnPage, keys: ['←', '→', 'Space'] },
  ...(props.paged
    ? [
        { label: m.value.reader.shortcuts.jumpEdges, keys: ['Home', 'End'] },
        { label: m.value.reader.shortcuts.jumpToPage, keys: ['G'] }
      ]
    : []),
  ...(props.zoomable
    ? [
        {
          label: m.value.reader.shortcuts.zoom,
          keys: ['+', '−', '0', m.value.reader.shortcuts.ctrlWheel]
        }
      ]
    : []),
  ...(props.searchable ? [{ label: m.value.reader.shortcuts.search, keys: ['Ctrl', 'F'] }] : []),
  { label: m.value.reader.shortcuts.switchUnit, keys: ['[', ']'] },
  { label: m.value.reader.shortcuts.bookmark, keys: ['B'] },
  { label: m.value.reader.shortcuts.navigation, keys: ['T'] },
  { label: m.value.reader.shortcuts.fullScreen, keys: ['F11', 'F'] },
  { label: m.value.reader.shortcuts.closeReader, keys: ['Esc'] }
])
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.reader.shortcuts.open"
      >
        <Icon
          icon="icon-[mdi--keyboard-outline]"
          class="size-4"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="w-72"
    >
      <p class="mb-2 text-sm font-medium">{{ m.reader.shortcuts.title }}</p>
      <ul class="space-y-1.5">
        <li
          v-for="binding in bindings"
          :key="binding.label"
          class="flex items-center justify-between gap-3"
        >
          <span class="text-xs text-muted-foreground">{{ binding.label }}</span>
          <span class="flex items-center gap-1">
            <kbd
              v-for="key in binding.keys"
              :key="key"
              class="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] leading-none"
            >
              {{ key }}
            </kbd>
          </span>
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
