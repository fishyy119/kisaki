<!--
Reader toolbar: the entry title, the navigation toggle, engine controls, and
unit stepping.
Boundary: it sits in the document flow above the page and is dropped entirely
in full screen, so an open popup's trigger can never move under the pointer.
-->
<script setup lang="ts">
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'
import ShortcutsPopover from './shortcuts-popover.vue'

const props = defineProps<{
  title: string
  panelOpen: boolean
  hasPreviousUnit: boolean
  hasNextUnit: boolean
  paged: boolean
  zoomable: boolean
  searchable: boolean
}>()

const emit = defineEmits<{
  togglePanel: []
  previousUnit: []
  nextUnit: []
  toggleFullScreen: []
  search: []
}>()

const { m } = useI18n()
</script>

<template>
  <div class="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-2">
    <Button
      :variant="props.panelOpen ? 'secondary' : 'ghost'"
      size="icon-sm"
      :tooltip="m.reader.chrome.navigation"
      @click="emit('togglePanel')"
    >
      <Icon
        icon="icon-[mdi--table-of-contents]"
        class="size-4"
      />
    </Button>

    <span
      class="min-w-0 flex-1 truncate text-sm font-medium"
      :title="props.title"
    >
      {{ props.title }}
    </span>

    <div class="flex shrink-0 items-center gap-1">
      <slot name="controls" />

      <Button
        v-if="props.searchable"
        variant="ghost"
        size="icon-sm"
        :tooltip="m.reader.search.open"
        @click="emit('search')"
      >
        <Icon
          icon="icon-[mdi--magnify]"
          class="size-4"
        />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.reader.units.previous"
        :disabled="!props.hasPreviousUnit"
        @click="emit('previousUnit')"
      >
        <Icon
          icon="icon-[mdi--skip-previous]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.reader.units.next"
        :disabled="!props.hasNextUnit"
        @click="emit('nextUnit')"
      >
        <Icon
          icon="icon-[mdi--skip-next]"
          class="size-4"
        />
      </Button>

      <ShortcutsPopover
        :paged="props.paged"
        :zoomable="props.zoomable"
        :searchable="props.searchable"
      />

      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.reader.chrome.enterFullScreen"
        @click="emit('toggleFullScreen')"
      >
        <Icon
          icon="icon-[mdi--fullscreen]"
          class="size-4"
        />
      </Button>
    </div>
  </div>
</template>
