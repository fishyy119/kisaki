<!-- Compact stat tiles shared by the preview and done steps. -->
<script setup lang="ts">
export interface StatCard {
  label: string
  value: number
  /**
   * Highlights non-zero values with a semantic tone.
   */
  tone?: 'warning' | 'destructive' | 'success'
}

interface Props {
  stats: readonly StatCard[]
}

const props = defineProps<Props>()

function valueClass(stat: StatCard): string {
  if (!stat.tone || stat.value === 0) {
    return 'text-foreground'
  }

  switch (stat.tone) {
    case 'warning':
      return 'text-warning'
    case 'destructive':
      return 'text-destructive'
    case 'success':
      return 'text-success'
  }
}
</script>

<template>
  <div class="grid grid-cols-5 gap-2">
    <div
      v-for="stat in props.stats"
      :key="stat.label"
      class="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2"
    >
      <span class="text-xs text-muted-foreground">{{ stat.label }}</span>
      <span
        class="text-lg leading-tight font-semibold"
        :class="valueClass(stat)"
      >
        {{ stat.value }}
      </span>
    </div>
  </div>
</template>
