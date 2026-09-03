<!--
Marked pages of the entry being read, shown as the pages themselves.
Boundary: a comic mark is a page, so the list is previews; the shell owns which
unit each mark belongs to and what opening one does.
-->
<script setup lang="ts">
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { useI18n } from '@renderer/composables/use-i18n'
import type { PageSource } from '@renderer/core/reader/image/source'
import type { ComicBookmark } from '@shared/db'
import MarkEditor from './chrome/mark-editor.vue'
import PageThumbnail from './image/page-thumbnail.vue'

const props = defineProps<{
  bookmarks: ComicBookmark[]
  /** Preview source of the open unit; marks of other units list without one. */
  source: PageSource | null
  currentUnitId: string
  unitLabels: Record<string, string>
}>()

const emit = defineEmits<{
  open: [chapterId: string, pageIndex: number]
  updateNote: [id: string, note: string | null]
  remove: [id: string]
}>()

const { m } = useI18n()
</script>

<template>
  <ScrollRegion class="p-2">
    <p
      v-if="props.bookmarks.length === 0"
      class="px-2 py-1 text-xs text-muted-foreground"
    >
      {{ m.reader.marks.empty }}
    </p>

    <div
      v-for="bookmark in props.bookmarks"
      :key="bookmark.id"
      class="flex items-start gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-accent/50"
    >
      <span class="w-16 shrink-0">
        <PageThumbnail
          v-if="props.source && bookmark.chapterId === props.currentUnitId"
          :source="props.source"
          :index="bookmark.pageIndex"
          :active="false"
          :numbered="false"
          @select="emit('open', bookmark.chapterId, bookmark.pageIndex)"
        />
      </span>

      <button
        type="button"
        class="min-w-0 flex-1 text-left"
        @click="emit('open', bookmark.chapterId, bookmark.pageIndex)"
      >
        <span class="line-clamp-1 text-xs">
          {{ props.unitLabels[bookmark.chapterId] ?? m.reader.units.comicLabel }}
        </span>
        <span class="text-xs tabular-nums text-muted-foreground">
          {{ m.reader.marks.page({ page: bookmark.pageIndex + 1 }) }}
        </span>
        <span
          v-if="bookmark.note"
          class="mt-0.5 line-clamp-2 block text-xs text-muted-foreground"
        >
          {{ bookmark.note }}
        </span>
      </button>

      <MarkEditor
        :note="bookmark.note"
        @update-note="(note) => emit('updateNote', bookmark.id, note)"
        @remove="emit('remove', bookmark.id)"
      />
    </div>
  </ScrollRegion>
</template>
