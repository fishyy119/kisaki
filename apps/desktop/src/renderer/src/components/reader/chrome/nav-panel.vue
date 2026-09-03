<!--
Reader navigation panel: docked beside the page rather than floating over it,
so the page stays readable while browsing units, pages, or marks. Below the
2xl step of the reader row (18rem of panel would leave the page less than
24rem) it floats over the page instead; the shell provides the scrim.
Boundary: it renders what the shell hands it and reports where the reader wants
to go; navigation itself belongs to the engine.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ReaderPanelTab } from '@renderer/composables/use-reader-chrome'
import type { ReaderOutlineEntry } from '@renderer/core/reader/outline'
import OutlineList from './outline-list.vue'
import type { ReaderNavUnit } from './types'

const props = defineProps<{
  /** Pages this engine can fill; a lone page shows no tab strip to choose from. */
  tabs: ReaderPanelTab[]
  units: ReaderNavUnit[]
  currentUnitId: string
  unitLabel: string
  outline: ReaderOutlineEntry[]
}>()

const emit = defineEmits<{
  openUnit: [unitId: string]
  goToOutline: [target: string | number]
}>()

const tab = defineModel<ReaderPanelTab>('tab', { required: true })

const { m } = useI18n()

const tabLabels = computed<Record<ReaderPanelTab, string>>(() => ({
  outline: m.value.reader.panel.outline,
  pages: m.value.reader.panel.pages,
  marks: m.value.reader.panel.marks,
  search: m.value.reader.panel.search
}))
</script>

<template>
  <Tabs
    v-model="tab"
    class="w-72 shrink-0 gap-0 overflow-hidden border-r border-border bg-surface @max-2xl:absolute @max-2xl:inset-y-0 @max-2xl:left-0 @max-2xl:z-20 @max-2xl:bg-popover @max-2xl:shadow-overlay"
  >
    <TabsList
      v-if="props.tabs.length > 1"
      class="m-2 shrink-0"
    >
      <TabsTrigger
        v-for="entry in props.tabs"
        :key="entry"
        :value="entry"
        class="flex-1"
      >
        {{ tabLabels[entry] }}
      </TabsTrigger>
    </TabsList>

    <TabsContent
      value="outline"
      class="min-h-0"
    >
      <OutlineList
        :units="props.units"
        :current-unit-id="props.currentUnitId"
        :unit-label="props.unitLabel"
        :outline="props.outline"
        @open-unit="(unitId) => emit('openUnit', unitId)"
        @go-to-outline="(target) => emit('goToOutline', target)"
      />
    </TabsContent>

    <TabsContent
      v-if="props.tabs.includes('pages')"
      value="pages"
      class="min-h-0"
    >
      <slot name="pages" />
    </TabsContent>

    <TabsContent
      v-if="props.tabs.includes('marks')"
      value="marks"
      class="min-h-0"
    >
      <slot name="marks" />
    </TabsContent>

    <TabsContent
      v-if="props.tabs.includes('search')"
      value="search"
      class="min-h-0"
    >
      <slot name="search" />
    </TabsContent>
  </Tabs>
</template>
