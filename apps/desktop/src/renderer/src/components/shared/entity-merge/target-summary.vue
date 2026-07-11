<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import type { EntityMergeSummary } from './types'

interface Props {
  summary: EntityMergeSummary | null | undefined
}

const props = defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-3 rounded-md border bg-muted/30 p-2">
    <div
      class="size-12 shrink-0 overflow-hidden rounded-md border bg-background flex items-center justify-center"
    >
      <img
        v-if="props.summary?.imageUrl"
        :src="props.summary.imageUrl"
        :alt="props.summary.name"
        class="size-full object-cover"
      />
      <Icon
        v-else
        :icon="getEntityIcon(props.summary?.entityType ?? 'game')"
        class="size-5 text-muted-foreground"
      />
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <div class="truncate text-sm font-medium">
          {{ props.summary?.name ?? '...' }}
        </div>
        <span class="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
          保留
        </span>
      </div>
      <div class="truncate text-xs text-muted-foreground">
        {{ props.summary?.subText ?? '' }}
      </div>
    </div>
  </div>
</template>
