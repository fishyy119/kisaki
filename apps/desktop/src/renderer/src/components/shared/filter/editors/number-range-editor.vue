<!--
  NumberRangeEditor
  Min/max inputs for number range conditions with an optional unit suffix;
  syncs on blur.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { NumberRangeValue } from '@shared/filter'
import { Input } from '@renderer/components/ui/input'
import { useI18n } from '@renderer/composables'
import type { FilterUiFieldDef } from '../specs/types'

interface Props {
  field: Extract<FilterUiFieldDef, { kind: 'number' }>
}

const props = defineProps<Props>()
const model = defineModel<NumberRangeValue>({ required: true })
const { m } = useI18n()

const minInput = ref('')
const maxInput = ref('')

/** Stored values are scaled (e.g. milliseconds); inputs use the display unit. */
const scale = props.field.valueScale ?? 1

watch(
  model,
  (value) => {
    minInput.value = value.min !== undefined ? (value.min / scale).toString() : ''
    maxInput.value = value.max !== undefined ? (value.max / scale).toString() : ''
  },
  { immediate: true }
)

function handleBlur() {
  const min = minInput.value ? Number.parseFloat(minInput.value) : undefined
  const max = maxInput.value ? Number.parseFloat(maxInput.value) : undefined

  model.value = {
    ...(min !== undefined && !Number.isNaN(min) && { min: min * scale }),
    ...(max !== undefined && !Number.isNaN(max) && { max: max * scale })
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Input
      v-model="minInput"
      type="number"
      :placeholder="m.filter.minPlaceholder"
      :min="props.field.min"
      :max="props.field.max"
      :step="props.field.step"
      @blur="handleBlur"
    />
    <span class="text-xs text-muted-foreground">-</span>
    <Input
      v-model="maxInput"
      type="number"
      :placeholder="m.filter.maxPlaceholder"
      :min="props.field.min"
      :max="props.field.max"
      :step="props.field.step"
      @blur="handleBlur"
    />
    <span
      v-if="props.field.unit"
      class="shrink-0 text-xs text-muted-foreground"
    >
      {{ props.field.unit }}
    </span>
  </div>
</template>
