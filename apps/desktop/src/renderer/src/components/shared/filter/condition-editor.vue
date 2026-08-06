<!--
  ConditionEditor
  Edits one FilterCondition inside a subtle outlined block using standard
  controls: field select + operator select on the first line, kind-specific
  value editor on the second. Boolean folds op+value into one yes/no select;
  the operator select is hidden when a kind has a single legal op.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { DateRangeValue, FilterCondition, FilterOp, NumberRangeValue } from '@shared/filter'
import { FILTER_OPS_BY_KIND, createDefaultCondition, getFilterQuerySpec } from '@shared/filter'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useI18n } from '@renderer/composables'
import EnumEditor from './editors/enum-editor.vue'
import NumberRangeEditor from './editors/number-range-editor.vue'
import DateRangeEditor from './editors/date-range-editor.vue'
import RelationEditor from './editors/relation-editor.vue'
import type { FilterUiFieldDef, FilterUiSpec } from './specs/types'

interface Props {
  uiSpec: FilterUiSpec
}

const props = defineProps<Props>()
const model = defineModel<FilterCondition>({ required: true })

const emit = defineEmits<{
  remove: []
}>()

const { m } = useI18n()

const field = computed<FilterUiFieldDef | undefined>(() =>
  props.uiSpec.fields.find((f) => f.key === model.value.field)
)

const opOptions = computed<readonly FilterOp[]>(() =>
  field.value ? FILTER_OPS_BY_KIND[field.value.kind] : []
)

// Boolean folds op+value into one select; other single-op kinds need no picker.
const showOpSelect = computed(() => opOptions.value.length > 1)

const showValueEditor = computed(
  () =>
    field.value !== undefined &&
    field.value.kind !== 'boolean' &&
    model.value.op !== 'isEmpty' &&
    model.value.op !== 'isSet'
)

const targetEntity = computed(() => {
  const queryField = getFilterQuerySpec(props.uiSpec.entityType).fieldByKey.get(model.value.field)
  return queryField?.kind === 'relation' ? queryField.targetEntity : undefined
})

// ---------------------------------------------------------------------------
// Field / op transitions
// ---------------------------------------------------------------------------

const fieldKey = computed({
  get: () => model.value.field,
  set: (key: string) => {
    const next = props.uiSpec.fields.find((f) => f.key === key)
    if (!next) return
    // Same kind keeps op and value; kind change resets to the kind default.
    if (field.value && next.kind === field.value.kind) {
      model.value = { ...model.value, field: key }
    } else {
      model.value = createDefaultCondition(key, next.kind)
    }
  }
})

const opValue = computed({
  get: () => model.value.op,
  set: (op: FilterOp) => {
    model.value = buildConditionForOp(op)
  }
})

function currentIdList(): string[] {
  const value = 'value' in model.value ? model.value.value : undefined
  return Array.isArray(value) ? value : []
}

function buildConditionForOp(op: FilterOp): FilterCondition {
  const key = model.value.field
  switch (op) {
    case 'is':
      return { field: key, op, value: model.value.op === 'is' ? model.value.value : true }
    case 'anyOf':
    case 'noneOf':
      return { field: key, op, value: currentIdList() }
    case 'hasAnyOf':
    case 'hasAllOf':
    case 'hasNoneOf':
      return { field: key, op, value: currentIdList() }
    case 'inRange':
      return { field: key, op, value: model.value.op === 'inRange' ? model.value.value : {} }
    case 'inDateRange':
      return { field: key, op, value: model.value.op === 'inDateRange' ? model.value.value : {} }
    case 'isEmpty':
    case 'isSet':
      return { field: key, op }
  }
}

// ---------------------------------------------------------------------------
// Value models per kind
// ---------------------------------------------------------------------------

/** Boolean op+value folded into one yes/no select. */
const booleanValue = computed({
  get: () => (model.value.op === 'is' && model.value.value === false ? 'false' : 'true'),
  set: (value: string) => {
    model.value = { field: model.value.field, op: 'is', value: value === 'true' }
  }
})

const idListValue = computed({
  get: () => currentIdList(),
  set: (value: string[]) => {
    const op = model.value.op
    if (op === 'anyOf' || op === 'noneOf') {
      model.value = { field: model.value.field, op, value }
    } else if (op === 'hasAnyOf' || op === 'hasAllOf' || op === 'hasNoneOf') {
      model.value = { field: model.value.field, op, value }
    }
  }
})

const numberRangeValue = computed({
  get: (): NumberRangeValue => (model.value.op === 'inRange' ? model.value.value : {}),
  set: (value: NumberRangeValue) => {
    model.value = { field: model.value.field, op: 'inRange', value }
  }
})

const dateRangeValue = computed({
  get: (): DateRangeValue => (model.value.op === 'inDateRange' ? model.value.value : {}),
  set: (value: DateRangeValue) => {
    model.value = { field: model.value.field, op: 'inDateRange', value }
  }
})
</script>

<template>
  <div class="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-2">
    <div class="flex items-center gap-1.5">
      <Select v-model="fieldKey">
        <SelectTrigger class="h-7 flex-1 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="f in props.uiSpec.fields"
            :key="f.key"
            :value="f.key"
          >
            {{ f.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Boolean: op+value folded into one yes/no select -->
      <Select
        v-if="field?.kind === 'boolean'"
        v-model="booleanValue"
      >
        <SelectTrigger class="h-7 w-32 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{{ m.common.yes }}</SelectItem>
          <SelectItem value="false">{{ m.common.no }}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        v-else-if="showOpSelect"
        v-model="opValue"
      >
        <SelectTrigger class="h-7 w-32 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="op in opOptions"
            :key="op"
            :value="op"
          >
            {{ m.filter.ops[op] }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        class="shrink-0 text-muted-foreground hover:text-foreground"
        @click="emit('remove')"
      >
        <Icon
          icon="icon-[mdi--close]"
          class="size-3.5"
        />
      </Button>
    </div>

    <template v-if="field && showValueEditor">
      <EnumEditor
        v-if="field.kind === 'enum'"
        v-model="idListValue"
        :options="field.options"
      />
      <NumberRangeEditor
        v-else-if="field.kind === 'number'"
        v-model="numberRangeValue"
        :field="field"
      />
      <DateRangeEditor
        v-else-if="field.kind === 'date'"
        v-model="dateRangeValue"
      />
      <RelationEditor
        v-else-if="field.kind === 'relation' && targetEntity"
        v-model="idListValue"
        :target-entity="targetEntity"
      />
    </template>
  </div>
</template>
