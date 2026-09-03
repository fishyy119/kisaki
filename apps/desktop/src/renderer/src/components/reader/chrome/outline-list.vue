<!--
Navigation panel contents: the entry's readable units, then the outline of the
unit currently open (an EPUB table of contents or a PDF outline).
Both lists virtualize: a long serialization carries 1000+ units and a deep
PDF outline can match.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { VirtualList } from '@renderer/components/ui/virtual'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ReaderOutlineEntry } from '@renderer/core/reader/outline'
import { cn } from '@renderer/utils/cn'
import type { ReaderNavUnit } from './types'

const props = defineProps<{
  units: ReaderNavUnit[]
  currentUnitId: string
  /** Section heading for the unit list: chapters for comics, volumes for novels. */
  unitLabel: string
  outline: ReaderOutlineEntry[]
}>()

const emit = defineEmits<{
  openUnit: [unitId: string]
  goToOutline: [target: string | number]
}>()

const { m } = useI18n()

const ROW_CLASS =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors'
</script>

<template>
  <ScrollRegion class="p-2">
    <p class="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {{ props.unitLabel }}
    </p>

    <VirtualList
      :items="props.units"
      :get-key="(unit) => unit.id"
      scroll="region"
      class="flex flex-col"
    >
      <template #item="{ item: unit }">
        <button
          type="button"
          :disabled="!unit.readable"
          :class="
            cn(
              ROW_CLASS,
              unit.id === props.currentUnitId
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50',
              !unit.readable && 'cursor-not-allowed opacity-50'
            )
          "
          @click="emit('openUnit', unit.id)"
        >
          <span class="min-w-0 flex-1 truncate">{{ unit.label }}</span>
          <Icon
            v-if="unit.read"
            icon="icon-[mdi--check]"
            class="size-3.5 shrink-0 text-muted-foreground"
          />
        </button>
      </template>
    </VirtualList>

    <template v-if="props.outline.length > 0">
      <p class="mt-3 px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {{ m.reader.panel.outlineHeading }}
      </p>
      <VirtualList
        :items="props.outline"
        :get-key="(entry) => `${entry.depth}:${entry.target}:${entry.label}`"
        scroll="region"
        class="flex flex-col"
      >
        <template #item="{ item: entry }">
          <button
            type="button"
            :class="cn(ROW_CLASS, 'hover:bg-accent/50')"
            :style="{ paddingLeft: `${8 + entry.depth * 12}px` }"
            @click="emit('goToOutline', entry.target)"
          >
            <span class="min-w-0 flex-1 truncate">{{ entry.label }}</span>
          </button>
        </template>
      </VirtualList>
    </template>
  </ScrollRegion>
</template>
