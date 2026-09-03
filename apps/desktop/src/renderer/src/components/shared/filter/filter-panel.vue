<!--
  FilterPanel
  Popover-based filter panel with real-time feedback.
  Filter changes apply immediately for instant visual feedback.
  Header carries the title and match mode, the body is the pure condition
  list, and the footer groups the list-level actions (add/clear) with the
  condition count.
-->
<script setup lang="ts">
import type { FilterState } from '@shared/filter'
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { createEmptyFilter, countConditions } from '@shared/filter'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Button } from '@renderer/components/ui/button'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { useI18n } from '@renderer/composables'
import FilterBuilder from './filter-builder.vue'
import MatchModeSwitch from './match-mode-switch.vue'
import AddConditionMenu from './add-condition-menu.vue'
import type { FilterUiSpec } from './specs/types'

interface Props {
  uiSpec: FilterUiSpec
  /** Side of the popover */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Alignment of the popover */
  align?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  side: 'bottom',
  align: 'start'
})

const model = defineModel<FilterState>({ required: true })
const { m } = useI18n()

const open = ref(false)

function handleClear() {
  model.value = createEmptyFilter()
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>

    <!-- The popover is the column: header and footer hold, the builder scrolls
         within whatever height the viewport leaves the popover -->
    <PopoverContent
      :side="props.side"
      :align="props.align"
      :side-offset="4"
      class="flex w-100 flex-col p-0"
    >
      <!-- Header: what this is + query-scoped match mode -->
      <div class="flex shrink-0 items-center justify-between px-4 py-3 border-b">
        <div class="flex items-center gap-3">
          <div class="text-sm font-medium">{{ m.filter.title }}</div>
          <MatchModeSwitch v-model="model" />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          class="-mr-1"
          @click="open = false"
        >
          <Icon
            icon="icon-[mdi--close]"
            class="size-3.5"
          />
        </Button>
      </div>

      <!-- Body - Scrollable -->
      <ScrollRegion class="p-4">
        <FilterBuilder
          v-model="model"
          :ui-spec="props.uiSpec"
        />
      </ScrollRegion>

      <!-- Footer: list-level actions + count -->
      <div class="flex shrink-0 items-center justify-between px-4 py-3 border-t">
        <div class="flex items-center gap-2">
          <AddConditionMenu
            v-model="model"
            :ui-spec="props.uiSpec"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="text-muted-foreground"
            @click="handleClear"
          >
            <Icon
              icon="icon-[mdi--filter-off-outline]"
              class="size-4 mr-1"
            />
            {{ m.filter.clearFilters }}
          </Button>
        </div>
        <span
          v-if="countConditions(model) > 0"
          class="text-xs text-muted-foreground"
        >
          {{ m.filter.conditionCount({ count: countConditions(model) }) }}
        </span>
      </div>
    </PopoverContent>
  </Popover>
</template>
