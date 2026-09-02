<!--
  FilterSummary
  Displays filter conditions as badges (field label + op + value).
  Supports compact and full modes.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables'
import { countConditions } from '@shared/filter'
import type { FilterCondition, FilterState } from '@shared/filter'
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

const activeCount = computed(() => countConditions(props.filter))
const fieldByKey = computed(() => new Map(props.uiSpec.fields.map((f) => [f.key, f])))

function formatIdList(field: FilterUiFieldDef, values: string[]): string {
  if (field.kind === 'enum') {
    const labels = values.map(
      (value) => field.options.find((option) => option.value === value)?.label ?? value
    )
    if (labels.length <= 2) return labels.join(', ')
    return m.value.filter.summaryAndMore({ first: labels[0]!, count: labels.length })
  }
  return m.value.values.itemCount({ count: values.length })
}

function formatCondition(condition: FilterCondition): string | null {
  const field = fieldByKey.value.get(condition.field)
  if (!field) return null

  const opLabel = m.value.filter.ops[condition.op]

  switch (condition.op) {
    case 'is':
      return `${field.label}: ${condition.value ? m.value.states.yes : m.value.states.no}`
    case 'anyOf':
    case 'noneOf':
    case 'hasAnyOf':
    case 'hasAllOf':
    case 'hasNoneOf': {
      if (condition.value.length === 0) return null
      return `${field.label} · ${opLabel}: ${formatIdList(field, condition.value)}`
    }
    case 'inRange': {
      const scale = field.kind === 'number' ? (field.valueScale ?? 1) : 1
      const min = condition.value.min !== undefined ? condition.value.min / scale : undefined
      const max = condition.value.max !== undefined ? condition.value.max / scale : undefined
      if (min !== undefined && max !== undefined) return `${field.label}: ${min}-${max}`
      if (min !== undefined) return `${field.label}: ≥ ${min}`
      if (max !== undefined) return `${field.label}: ≤ ${max}`
      return null
    }
    case 'inDateRange': {
      const { from, to } = condition.value
      if (from && to) return `${field.label}: ${from} ~ ${to}`
      if (from) return `${field.label}: ${m.value.filter.summaryFrom({ value: from })}`
      if (to) return `${field.label}: ${m.value.filter.summaryTo({ value: to })}`
      return null
    }
    case 'isEmpty':
    case 'isSet':
      return `${field.label} · ${opLabel}`
  }
}

const entries = computed(() =>
  props.filter.conditions
    .map((condition) => formatCondition(condition))
    .filter((entry): entry is string => entry !== null)
)
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
    <Badge variant="secondary">
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
      v-for="(entry, i) in entries"
      :key="i"
      variant="secondary"
    >
      {{ entry }}
    </Badge>
    <Button
      variant="ghost"
      size="sm"
      @click="emit('clear')"
    >
      {{ m.actions.clear }}
    </Button>
  </div>
</template>
