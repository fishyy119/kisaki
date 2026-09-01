<!--
  NovelReadButton
  Read/stop button for a novel entry or a specific volume. The read action
  reads "start" or "continue" depending on recorded volume progress, a live
  reader window turns the button into the stop that closes it, and
  transitional phases keep the action label and show a spinner. Transport and
  failure notices live in the shared reading facade.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, ref, watch } from 'vue'
import { cva } from 'class-variance-authority'
import { and, eq, isNotNull, or } from 'drizzle-orm'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { useDbChanges } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { useNovelReading } from '@renderer/composables/use-novel-reading'
import { db } from '@renderer/core/db'
import { cn } from '@renderer/utils/cn'
import { novelVolumes } from '@shared/db'

type ReadButtonState = 'idle' | 'starting' | 'reading' | 'stopping'

interface Props {
  novelId: string
  /** Read this volume instead of the next unread one. */
  volumeId?: string
  /** Read this file version instead of the volume's primary file. */
  fileId?: string
  display?: 'icon' | 'labeled'
  size?: 'sm' | 'md' | 'lg'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  display: 'labeled',
  size: 'md'
})

const { m } = useI18n()

const { isReading, pendingAction, read, stop } = useNovelReading(
  () => props.novelId,
  () => props.volumeId
)

// The activity push lands before the IPC reply, so the in-flight phase ends
// on the tracked state instead of the reply.
const state = computed<ReadButtonState>(() => {
  if (pendingAction.value === 'start' && !isReading.value) return 'starting'
  if (pendingAction.value === 'stop' && isReading.value) return 'stopping'
  return isReading.value ? 'reading' : 'idle'
})

const isBusy = computed(() => state.value === 'starting' || state.value === 'stopping')
const isStopAction = computed(() => state.value === 'reading' || state.value === 'stopping')

/**
 * Whether the read action resumes existing progress: a volume button resumes
 * from the volume's own resume point, while an entry button resumes once any
 * volume carries read progress.
 */
const hasProgress = ref(false)

async function refreshProgress(): Promise<void> {
  const { novelId, volumeId } = props

  if (volumeId) {
    const [row] = await db
      .select({ resumeLocator: novelVolumes.resumeLocator })
      .from(novelVolumes)
      .where(eq(novelVolumes.id, volumeId))
      .limit(1)
    hasProgress.value = (row?.resumeLocator ?? null) !== null
    return
  }

  const [row] = await db
    .select({ id: novelVolumes.id })
    .from(novelVolumes)
    .where(
      and(
        eq(novelVolumes.novelId, novelId),
        or(eq(novelVolumes.read, true), isNotNull(novelVolumes.resumeLocator))
      )
    )
    .limit(1)
  hasProgress.value = row !== undefined
}

watch(
  () => [props.novelId, props.volumeId],
  () => void refreshProgress(),
  { immediate: true }
)

useDbChanges(({ tables }) => {
  if (tables.has('novel_volumes')) void refreshProgress()
})

// Transitional phases keep the action label; the spinner alone signals progress.
const label = computed<string>(() =>
  isStopAction.value
    ? m.value.novel.stop
    : hasProgress.value
      ? m.value.novel.readContinue
      : m.value.novel.readStart
)

const iconVariants = cva('', {
  variants: {
    size: {
      sm: 'size-4',
      md: 'size-4',
      lg: 'size-5'
    }
  },
  defaultVariants: { size: 'md' }
})

const iconButtonSize = computed(() => {
  if (props.size === 'lg') return 'icon-lg'
  if (props.size === 'sm') return 'icon-sm'
  return 'icon'
})

// Reserve the widest label so switching states never shifts the surrounding row.
const labeledVariants = cva('gap-1.5 disabled:opacity-100', {
  variants: {
    size: {
      sm: 'min-w-24',
      md: 'min-w-28',
      lg: 'min-w-28'
    }
  },
  defaultVariants: { size: 'md' }
})

const labeledButtonSize = computed(() => {
  if (props.size === 'lg') return 'lg'
  if (props.size === 'sm') return 'sm'
  return 'default'
})

async function handleClick(e: Event) {
  e.stopPropagation()
  e.preventDefault()
  await (isReading.value ? stop() : read(props.fileId))
}
</script>

<template>
  <!-- Icon variant -->
  <Button
    v-if="props.display === 'icon'"
    variant="ghost"
    :size="iconButtonSize"
    :disabled="isBusy"
    :aria-busy="isBusy"
    :aria-label="label"
    :tooltip="label"
    :class="cn('disabled:opacity-100', props.class)"
    @click="handleClick"
  >
    <Spinner
      v-if="isBusy"
      :class="iconVariants({ size: props.size })"
    />
    <Icon
      v-else
      :icon="isStopAction ? 'icon-[mdi--stop]' : 'icon-[mdi--play]'"
      :class="iconVariants({ size: props.size })"
    />
  </Button>

  <!-- Labeled variant -->
  <Button
    v-else
    :variant="isStopAction ? 'secondary' : 'default'"
    :size="labeledButtonSize"
    :disabled="isBusy"
    :aria-busy="isBusy"
    :class="cn(labeledVariants({ size: props.size }), props.class)"
    @click="handleClick"
  >
    <Spinner
      v-if="isBusy"
      class="size-4"
    />
    <Icon
      v-else
      :icon="isStopAction ? 'icon-[mdi--stop]' : 'icon-[mdi--play]'"
      class="size-4"
    />
    {{ label }}
  </Button>
</template>
