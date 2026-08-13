<!--
  AnimePlaybackProgress
  Live playback line under a playing row: state label, progress bar, and the
  position/duration readout. Shared by episode and extra rows.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Progress } from '@renderer/components/ui/progress'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import type { AnimePlaybackState } from '@renderer/stores'

interface Props {
  status: AnimePlaybackState['status'] | undefined
  progress: { positionMs: number; durationMs: number | null } | undefined
}

const props = defineProps<Props>()

const { m, f } = useI18n()

const isPaused = computed(() => props.status === 'paused')

const percent = computed(() => {
  const progress = props.progress
  if (!progress?.durationMs) return 0
  return Math.min(100, (progress.positionMs / progress.durationMs) * 100)
})

const label = computed(() => {
  if (props.status === 'paused') return m.value.anime.player.paused
  if (props.status === 'loading') return m.value.anime.starting
  return m.value.anime.playing
})

const timeText = computed(() => {
  const progress = props.progress
  if (!progress) return null
  const position = f.value.durationFine(progress.positionMs)
  return progress.durationMs === null
    ? position
    : `${position} / ${f.value.duration(progress.durationMs)}`
})
</script>

<template>
  <div class="mt-1.5 flex items-center gap-2">
    <span
      :class="
        cn('text-xs font-medium shrink-0', isPaused ? 'text-muted-foreground' : 'text-primary')
      "
    >
      {{ label }}
    </span>
    <Progress
      :model-value="percent"
      class="h-1 w-40 shrink-0"
    />
    <span
      v-if="timeText"
      class="text-xs text-muted-foreground truncate"
    >
      {{ timeText }}
    </span>
  </div>
</template>
