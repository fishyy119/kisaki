<!--
  Anime Detail Activity Empty State

  Displayed when there are no watch sessions for the anime.
-->

<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <Icon
      icon="icon-[mdi--report-timeline-variant]"
      class="size-12 text-muted-foreground/30 mb-3"
    />
    <p class="text-sm text-muted-foreground font-medium mb-1">{{ m.anime.activity.emptyTitle }}</p>
    <p class="text-xs text-muted-foreground/70 max-w-xs">{{ m.anime.activity.emptyHint }}</p>
  </div>
</template>
