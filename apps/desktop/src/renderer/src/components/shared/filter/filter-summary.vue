<!--
  FilterSummary
  Display summary of active filter values as badges.
  Supports compact and full modes.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables'
import { countActiveFilters } from '@shared/filter'
import type { DateRangeValue, FilterState, NumberRangeValue, RelationValue } from '@shared/filter'
import type { FilterUiFieldDef, FilterUiSpec } from './specs/types'

interface Props {
  uiSpec: FilterUiSpec
  filter: FilterState
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
})

const emit = defineEmits<{
  clear: []
}>()

const { m } = useI18n()

const activeCount = computed(() => countActiveFilters(props.filter))
const fieldByKey = computed(() => new Map(props.uiSpec.fields.map((f) => [f.key, f])))

function formatValue(
  field: FilterUiFieldDef,
  value: unknown
): { value: string; mode?: string } | null {
  if (value === null || value === undefined) return null

  if (field.control === 'boolean') {
    return { value: value === true ? m.value.common.yes : m.value.common.no }
  }

  if (field.control === 'select') {
    const v = String(value)
    const opt = field.options.find((o) => o.value === v)
    return { value: opt?.label ?? v }
  }

  if (field.control === 'multiSelect') {
    const arr = Array.isArray(value) ? (value as string[]) : []
    const labels = arr.map((v) => field.options.find((o) => o.value === v)?.label ?? v)
    if (labels.length <= 2) return { value: labels.join(', ') }
    return { value: m.value.filter.summaryAndMore({ first: labels[0], count: labels.length }) }
  }

  if (field.control === 'numberRange') {
    const range = value as NumberRangeValue
    if (range.min !== undefined && range.max !== undefined)
      return { value: `${range.min}-${range.max}` }
    if (range.min !== undefined) return { value: `≥ ${range.min}` }
    if (range.max !== undefined) return { value: `≤ ${range.max}` }
    return null
  }

  if (field.control === 'dateRange') {
    const range = value as DateRangeValue
    if (range.from && range.to) return { value: `${range.from} ~ ${range.to}` }
    if (range.from) return { value: m.value.filter.summaryFrom({ value: range.from }) }
    if (range.to) return { value: m.value.filter.summaryTo({ value: range.to }) }
    return null
  }

  if (field.control === 'relation') {
    const rel = value as RelationValue
    const count = Array.isArray(rel.ids) ? rel.ids.length : 0
    if (count === 0) return null
    return {
      value: m.value.common.itemCount({ count }),
      mode: rel.match === 'all' ? m.value.filter.matchAll : undefined
    }
  }

  return { value: String(value) }
}

const activeEntries = computed(() => {
  return Object.entries(props.filter)
    .map(([key, value]) => {
      const field = fieldByKey.value.get(key)
      if (!field) return null

      const formatted = formatValue(field, value)
      if (!formatted) return null

      return { label: field.label, value: formatted.value, mode: formatted.mode }
    })
    .filter(Boolean) as { label: string; value: string; mode?: string }[]
})
</script>

<template>
  <template v-if="activeCount === 0">
    <span
      v-if="!props.compact"
      class="text-xs text-muted-foreground"
      >{{ m.filter.noActive }}</span
    >
  </template>

  <div
    v-else-if="props.compact"
    class="flex items-center gap-1.5"
  >
    <Badge
      variant="secondary"
      class="text-xs"
    >
      {{ m.filter.activeCount({ count: activeCount }) }}
    </Badge>
    <Button
      variant="ghost"
      size="icon-sm"
      class="size-5"
      :title="m.filter.clearFilters"
      @click="emit('clear')"
    >
      <Icon
        icon="icon-[mdi--close]"
        class="size-3"
      />
    </Button>
  </div>

  <div
    v-else
    class="flex flex-wrap items-center gap-1.5"
  >
    <Badge
      v-for="(cond, i) in activeEntries"
      :key="i"
      variant="secondary"
      class="text-xs"
    >
      {{ cond.label }}{{ cond.mode ? `(${cond.mode})` : '' }}: {{ cond.value }}
    </Badge>
    <Button
      variant="ghost"
      size="sm"
      class="h-6 text-xs px-2"
      @click="emit('clear')"
    >
      {{ m.common.clear }}
    </Button>
  </div>
</template>
