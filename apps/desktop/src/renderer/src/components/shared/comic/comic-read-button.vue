<!--
  ComicReadButton
  Read button for a comic entry or a specific unit. The action reads "start"
  or "continue" depending on recorded unit progress; a live reader window is
  refocused by the same action, so there is no stop state. Transport and
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
import { useComicReading } from '@renderer/composables/use-comic-reading'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { useReadingActivityStore } from '@renderer/stores'
import { cn } from '@renderer/utils/cn'
import { comicChapters } from '@shared/db'

interface Props {
  comicId: string
  /** Read this unit instead of the next unread one. */
  chapterId?: string
  /** Read this file version instead of the unit's primary file. */
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
const readingActivity = useReadingActivityStore()

const { isStartPending, read } = useComicReading(() => props.comicId)

/** A window already open reads as live: the action refocuses it. */
const isReading = computed(() => readingActivity.isComicReading(props.comicId))

/**
 * Whether the read action resumes existing progress: a unit button resumes
 * from the unit's own resume point, while an entry button resumes once any
 * unit carries read progress.
 */
const hasProgress = ref(false)

async function refreshProgress(): Promise<void> {
  const { comicId, chapterId } = props

  if (chapterId) {
    const [row] = await db
      .select({ resumePage: comicChapters.resumePage })
      .from(comicChapters)
      .where(eq(comicChapters.id, chapterId))
      .limit(1)
    hasProgress.value = (row?.resumePage ?? null) !== null
    return
  }

  const [row] = await db
    .select({ id: comicChapters.id })
    .from(comicChapters)
    .where(
      and(
        eq(comicChapters.comicId, comicId),
        or(eq(comicChapters.read, true), isNotNull(comicChapters.resumePage))
      )
    )
    .limit(1)
  hasProgress.value = row !== undefined
}

watch(
  () => [props.comicId, props.chapterId],
  () => void refreshProgress(),
  { immediate: true }
)

useDbChanges(({ table }) => {
  if (table === 'comic_chapters') void refreshProgress()
})

const label = computed<string>(() => {
  if (isReading.value) return m.value.comic.readOpen
  return hasProgress.value ? m.value.comic.readContinue : m.value.comic.readStart
})

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
  await read(props.chapterId, props.fileId)
}
</script>

<template>
  <!-- Icon variant -->
  <Button
    v-if="props.display === 'icon'"
    variant="ghost"
    :size="iconButtonSize"
    :disabled="isStartPending"
    :aria-busy="isStartPending"
    :aria-label="label"
    :tooltip="label"
    :class="cn('disabled:opacity-100', props.class)"
    @click="handleClick"
  >
    <Spinner
      v-if="isStartPending"
      :class="iconVariants({ size: props.size })"
    />
    <Icon
      v-else
      icon="icon-[mdi--image-filter-hdr-outline]"
      :class="iconVariants({ size: props.size })"
    />
  </Button>

  <!-- Labeled variant -->
  <Button
    v-else
    variant="default"
    :size="labeledButtonSize"
    :disabled="isStartPending"
    :aria-busy="isStartPending"
    :class="cn(labeledVariants({ size: props.size }), props.class)"
    @click="handleClick"
  >
    <Spinner
      v-if="isStartPending"
      class="size-4"
    />
    <Icon
      v-else
      icon="icon-[mdi--image-filter-hdr-outline]"
      class="size-4"
    />
    {{ label }}
  </Button>
</template>
