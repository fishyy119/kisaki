<!-- Labelled slider row with a value readout, for the reader's setting popovers. -->
<script setup lang="ts">
import { computed } from 'vue'
import { Slider } from '@renderer/components/ui/slider'

const props = defineProps<{
  label: string
  min: number
  max: number
  step: number
  /** Formatted readout of the current value, units included. */
  display: string
}>()

const model = defineModel<number>({ required: true })

const sliderValue = computed<number[]>({
  get: () => [model.value],
  set: (value) => {
    const next = value[0]
    if (next !== undefined) model.value = next
  }
})
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs text-muted-foreground">{{ props.label }}</span>
      <span class="text-xs tabular-nums">{{ props.display }}</span>
    </div>
    <Slider
      v-model="sliderValue"
      :min="props.min"
      :max="props.max"
      :step="props.step"
    />
  </div>
</template>
