<!--
  MatchModeSwitch
  Segmented all/any match mode control for a FilterState. A query-scoped
  setting meant for the filter panel/dialog header; renders nothing until
  two or more conditions combine.
-->
<script setup lang="ts">
import type { FilterState } from '@shared/filter'
import { setMatchMode } from '@shared/filter'
import { useI18n } from '@renderer/composables'
import { cn } from '@renderer/utils/cn'

const model = defineModel<FilterState>({ required: true })
const { m } = useI18n()

const matchModes = ['all', 'any'] as const
</script>

<template>
  <div
    v-if="model.conditions.length >= 2"
    class="inline-flex items-center rounded bg-muted/50 p-0.5 text-xs"
    :title="m.filter.matchModeLabel"
  >
    <button
      v-for="mode in matchModes"
      :key="mode"
      type="button"
      :class="
        cn(
          'px-2 py-0.5 rounded transition-colors',
          model.match === mode
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )
      "
      @click="() => (model = setMatchMode(model, mode))"
    >
      {{ mode === 'all' ? m.filter.matchAll : m.filter.matchAny }}
    </button>
  </div>
</template>
