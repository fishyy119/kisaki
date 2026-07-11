<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { TaskRun } from '@shared/task-run'
import { Progress } from '@renderer/components/ui/progress'
import { Spinner } from '@renderer/components/ui/spinner'
import {
  formatProgressCount,
  formatProgressPercent,
  formatTaskRunDuration,
  formatTaskRunEta,
  formatTaskRunPhase,
  formatTaskRunRate,
  getProgressPercentValue
} from '../../../utils/display'

interface Props {
  run: TaskRun
}

const props = defineProps<Props>()

const now = ref(Date.now())
const percentValue = computed(() => getProgressPercentValue(props.run))
const percentText = computed(() => formatProgressPercent(props.run))
const countText = computed(() => formatProgressCount(props.run))
const rateText = computed(() => formatTaskRunRate(props.run))
const etaText = computed(() => formatTaskRunEta(props.run))
const durationText = computed(() => formatTaskRunDuration(props.run, now.value))
const isIndeterminate = computed(
  () => props.run.progress?.work?.indeterminate === true || percentValue.value === null
)
const metrics = computed(() => {
  const items = [
    { label: '进度', value: countText.value },
    { label: '速度', value: rateText.value },
    { label: '剩余', value: etaText.value }
  ]

  return items.filter((item): item is { label: string; value: string } => Boolean(item.value))
})

let durationTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  durationTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (durationTimer) {
    clearInterval(durationTimer)
  }
})
</script>

<template>
  <div class="min-w-0 space-y-1">
    <div class="flex items-center justify-between gap-2 text-xs">
      <div class="min-w-0 flex items-center gap-1.5 text-muted-foreground">
        <Spinner
          v-if="isIndeterminate"
          class="size-3.5 shrink-0"
        />
        <span class="truncate">{{ formatTaskRunPhase(props.run) }}</span>
      </div>
      <div class="shrink-0 text-muted-foreground">
        <template v-if="percentText">{{ percentText }}</template>
        <template v-else>{{ durationText }}</template>
      </div>
    </div>

    <Progress
      v-if="!isIndeterminate"
      :model-value="percentValue ?? 0"
      :aria-valuenow="percentValue ?? 0"
      :aria-valuemax="100"
      class="h-1.5"
    />
    <div
      v-else
      class="relative h-1.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuetext="进行中"
    >
      <div
        class="task-run-progress-indicator absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary"
      />
    </div>

    <div
      v-if="metrics.length"
      class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] leading-4 text-muted-foreground"
    >
      <span
        v-for="item in metrics"
        :key="item.label"
        class="min-w-0"
      >
        <span>{{ item.label }}</span>
        <span class="ml-1 text-foreground">{{ item.value }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
@keyframes task-run-progress-slide {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(300%);
  }
}

.task-run-progress-indicator {
  animation: task-run-progress-slide 1.15s ease-in-out infinite;
}
</style>
