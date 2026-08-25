<!--
  ComicDetailChapterItem
  One unit row: identity at either grain (volume or chapter), read state,
  file facts, and the edit action.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import ComicReadButton from '../../../comic-read-button.vue'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import { formatUnitNumber } from '@renderer/utils/format'
import type { ComicChapterEntry } from '@renderer/composables/use-comic'

interface Props {
  chapter: ComicChapterEntry
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggleRead: []
  /** Carries the readable file path so the parent never re-derives it. */
  openFolder: [path: string]
  edit: []
}>()

const { m, f } = useI18n()

const isRead = computed(() => props.chapter.read)
const readableFile = computed(() => props.chapter.files[0] ?? null)

/** Number badge at the unit's own grain: chapters read as chapters, volumes as volumes. */
const numberLabel = computed(() => {
  if (props.chapter.chapterNumber !== null) return formatUnitNumber(props.chapter.chapterNumber)
  if (props.chapter.volumeNumber !== null) {
    return m.value.comic.chapters.unnamedVolume({
      number: formatUnitNumber(props.chapter.volumeNumber)
    })
  }
  return null
})

const title = computed(() => {
  if (props.chapter.name) return props.chapter.name
  if (props.chapter.chapterNumber !== null) {
    return m.value.comic.chapters.unnamedChapter({
      number: formatUnitNumber(props.chapter.chapterNumber)
    })
  }
  if (props.chapter.volumeNumber !== null) {
    return m.value.comic.chapters.unnamedVolume({
      number: formatUnitNumber(props.chapter.volumeNumber)
    })
  }
  return m.value.common.emptyValue
})
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/50',
        !readableFile && 'opacity-70'
      )
    "
  >
    <div class="flex items-center gap-3 min-w-0">
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="isRead ? m.comic.chapters.markUnread : m.comic.chapters.markRead"
        @click="emit('toggleRead')"
      >
        <Icon
          :icon="isRead ? 'icon-[mdi--circle]' : 'icon-[mdi--circle-outline]'"
          :class="cn('size-4', isRead && 'text-success')"
        />
      </Button>

      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span
            v-if="numberLabel && props.chapter.name"
            class="text-xs font-mono text-muted-foreground shrink-0"
          >
            {{ numberLabel }}
          </span>
          <p class="text-sm font-medium truncate">{{ title }}</p>
        </div>

        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span v-if="!readableFile">{{ m.comic.files.missingFile }}</span>
          <template v-else>
            <span>{{ readableFile.container }}</span>
            <template v-if="readableFile.pageCount">
              <span>·</span>
              <span>{{ m.comic.chapters.pageCount({ count: readableFile.pageCount }) }}</span>
            </template>
            <template v-if="props.chapter.files.length > 1">
              <span>·</span>
              <span>{{ m.comic.files.fileCount({ count: props.chapter.files.length }) }}</span>
            </template>
          </template>
          <template v-if="props.chapter.releaseDate">
            <span>·</span>
            <span>{{ f.date(props.chapter.releaseDate) }}</span>
          </template>
          <template v-if="props.chapter.resumePage">
            <span>·</span>
            <span>{{ m.comic.chapters.resumeAt({ page: props.chapter.resumePage }) }}</span>
          </template>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <ComicReadButton
        v-if="readableFile"
        :comic-id="props.chapter.comicId"
        :chapter-id="props.chapter.id"
        display="icon"
        size="sm"
      />

      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.comic.chapters.editChapter"
        @click="emit('edit')"
      >
        <Icon
          icon="icon-[mdi--pencil-outline]"
          class="size-4"
        />
      </Button>

      <Button
        v-if="readableFile"
        variant="ghost"
        size="icon-sm"
        :tooltip="m.comic.files.openFolder"
        @click="emit('openFolder', readableFile.path)"
      >
        <Icon
          icon="icon-[mdi--folder-open-outline]"
          class="size-4"
        />
      </Button>
    </div>
  </div>
</template>
