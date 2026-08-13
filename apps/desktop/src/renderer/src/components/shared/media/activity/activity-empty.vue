<!--
  Media Activity Empty State

  Displayed when there are no sessions for the media entry.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import type { MediaType } from '@shared/common'
import { useI18n } from '@renderer/composables/use-i18n'

interface Props {
  mediaType: MediaType
}

const props = defineProps<Props>()

const { m } = useI18n()

const labels = computed(() => m.value[props.mediaType].activity)
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <Icon
      icon="icon-[mdi--report-timeline-variant]"
      class="size-12 text-muted-foreground/30 mb-3"
    />
    <p class="text-sm text-muted-foreground font-medium mb-1">{{ labels.emptyTitle }}</p>
    <p class="text-xs text-muted-foreground/70 max-w-xs">{{ labels.emptyHint }}</p>
  </div>
</template>
