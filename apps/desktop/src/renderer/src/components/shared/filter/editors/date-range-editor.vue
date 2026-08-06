<!--
  DateRangeEditor
  From/to date inputs for date range conditions.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { DateRangeValue } from '@shared/filter'
import { Input } from '@renderer/components/ui/input'

const model = defineModel<DateRangeValue>({ required: true })

const fromDate = computed({
  get: () => model.value.from ?? '',
  set: (value: string) => {
    model.value = { ...(value && { from: value }), ...(model.value.to && { to: model.value.to }) }
  }
})

const toDate = computed({
  get: () => model.value.to ?? '',
  set: (value: string) => {
    model.value = {
      ...(model.value.from && { from: model.value.from }),
      ...(value && { to: value })
    }
  }
})
</script>

<template>
  <div class="flex items-center gap-2">
    <Input
      v-model="fromDate"
      type="date"
    />
    <span class="text-xs text-muted-foreground">-</span>
    <Input
      v-model="toDate"
      type="date"
    />
  </div>
</template>
