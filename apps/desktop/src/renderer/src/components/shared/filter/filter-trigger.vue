<!--
  FilterTrigger
  Filter button with an active-condition badge; opens the shared FilterPanel.
  The query-row control every entity list surface uses.
-->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import type { FilterState } from '@shared/filter'
import { countConditions } from '@shared/filter'
import { Icon } from '@renderer/components/ui/icon'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import FilterPanel from './filter-panel.vue'
import type { FilterUiSpec } from './specs/types'

interface Props {
  uiSpec: FilterUiSpec
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  side: 'bottom',
  align: 'end'
})

const model = defineModel<FilterState>({ required: true })

const { m } = useI18n()

const activeCount = computed(() => countConditions(model.value))
</script>

<template>
  <FilterPanel
    v-model="model"
    :ui-spec="props.uiSpec"
    :side="props.side"
    :align="props.align"
  >
    <Button
      variant="outline"
      size="icon-sm"
      :class="cn('relative text-muted-foreground', activeCount > 0 && 'text-primary', props.class)"
      :title="m.filter.title"
    >
      <Icon
        icon="icon-[mdi--filter-outline]"
        class="size-4"
      />
      <Badge
        v-if="activeCount > 0"
        variant="secondary"
        class="absolute -top-1 -right-1 flex size-4 items-center justify-center p-0"
      >
        {{ activeCount }}
      </Badge>
    </Button>
  </FilterPanel>
</template>
