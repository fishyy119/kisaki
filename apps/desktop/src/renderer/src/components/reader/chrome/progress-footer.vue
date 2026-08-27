<!--
Reader progress footer: where the reader is, a seekable track to move there,
and how long this sitting has lasted.
Boundary: it seeks on release only, so dragging never makes the engine load
every page it passes over.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Slider } from '@renderer/components/ui/slider'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ReaderProgress } from './types'

const props = defineProps<{
  progress: ReaderProgress
  elapsedMinutes: number
}>()

const emit = defineEmits<{
  /** A page index for paged units, a fraction in [0, 1] for reflowable text. */
  seek: [value: number]
}>()

const jumpOpen = defineModel<boolean>('jumpOpen', { default: false })

const { m } = useI18n()

/** Fine enough to land inside any chapter of a long book. */
const FRACTION_STEP = 0.001

const pageProgress = computed(() => (props.progress.kind === 'page' ? props.progress : null))
const fractionProgress = computed(() =>
  props.progress.kind === 'fraction' ? props.progress : null
)

const position = computed(() =>
  props.progress.kind === 'page' ? props.progress.pageIndex : props.progress.fraction
)

const sliderMax = computed(() => {
  const paged = pageProgress.value
  if (!paged) return 1
  return paged.pageCount === null ? 0 : Math.max(paged.pageCount - 1, 0)
})

const sliderStep = computed(() => (pageProgress.value ? 1 : FRACTION_STEP))

const sliderDisabled = computed(() => sliderMax.value <= 0)

const positionLabel = computed(() => {
  const paged = pageProgress.value
  if (paged) {
    return m.value.reader.progress.pageOf({ page: paged.pageIndex + 1, total: paged.pageCount })
  }
  return m.value.reader.values.percent({
    value: Math.round((fractionProgress.value?.fraction ?? 0) * 100)
  })
})

// The slider owns its value while the pointer is down; the reported position
// only changes once a seek has been committed, so the two never fight.
const sliderValue = ref<number[]>([position.value])

watch(position, (value) => {
  sliderValue.value = [value]
})

const jumpInput = ref('')

watch(jumpOpen, (open) => {
  if (open) jumpInput.value = String((pageProgress.value?.pageIndex ?? 0) + 1)
})

function handleCommit(value: number[]): void {
  const next = value[0]
  if (next !== undefined) emit('seek', next)
}

/** Chapter ticks sit at reading-order fractions, so an RTL track mirrors them. */
function tickStyle(fraction: number): Record<string, string> {
  const percent = `${fraction * 100}%`
  return props.progress.rtl ? { right: percent } : { left: percent }
}

function submitJump(): void {
  const total = pageProgress.value?.pageCount
  const parsed = Number.parseInt(jumpInput.value, 10)
  jumpOpen.value = false
  if (!Number.isInteger(parsed) || total === null || total === undefined) return
  emit('seek', Math.min(Math.max(parsed - 1, 0), total - 1))
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-3 border-t border-border bg-surface px-3 py-1.5">
    <Popover
      v-if="pageProgress"
      v-model:open="jumpOpen"
    >
      <PopoverTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="shrink-0 tabular-nums"
          :tooltip="m.reader.progress.jumpToPage"
          :disabled="pageProgress.pageCount === null"
        >
          {{ positionLabel }}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        class="w-56"
      >
        <p class="mb-2 text-sm font-medium">{{ m.reader.progress.jumpToPage }}</p>
        <div class="flex items-center gap-2">
          <Input
            v-model="jumpInput"
            type="number"
            min="1"
            :max="pageProgress.pageCount ?? undefined"
            @keydown.enter="submitJump"
          />
          <Button
            size="sm"
            @click="submitJump"
          >
            {{ m.reader.progress.jump }}
          </Button>
        </div>
      </PopoverContent>
    </Popover>

    <span
      v-else
      class="shrink-0 text-xs tabular-nums text-muted-foreground"
    >
      {{ positionLabel }}
    </span>

    <span
      v-if="fractionProgress?.section"
      class="min-w-0 max-w-48 truncate text-xs text-muted-foreground"
      :title="fractionProgress.section"
    >
      {{ fractionProgress.section }}
    </span>

    <div class="relative flex-1">
      <span
        v-for="fraction in fractionProgress?.sectionFractions ?? []"
        :key="fraction"
        class="pointer-events-none absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-border"
        :style="tickStyle(fraction)"
      />
      <Slider
        v-model="sliderValue"
        :min="0"
        :max="sliderMax"
        :step="sliderStep"
        :dir="props.progress.rtl ? 'rtl' : 'ltr'"
        :disabled="sliderDisabled"
        @value-commit="handleCommit"
      />
    </div>

    <span class="shrink-0 text-xs tabular-nums text-muted-foreground">
      {{ m.reader.progress.elapsed({ minutes: props.elapsedMinutes }) }}
    </span>
  </div>
</template>
