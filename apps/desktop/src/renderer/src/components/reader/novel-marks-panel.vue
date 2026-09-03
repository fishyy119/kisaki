<!--
Bookmarks and highlights of the entry being read.
Boundary: the two are separate records and stay separate sections here — a
bookmark is a place to come back to, a highlight is a passage worth keeping, and
a reader looks for one or the other.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { useI18n } from '@renderer/composables/use-i18n'
import { HIGHLIGHT_TINTS } from '@renderer/core/reader/text/highlight'
import { cn } from '@renderer/utils/cn'
import type { HighlightColor } from '@shared/db/contracts/enums'
import type { NovelBookmark, NovelHighlight } from '@shared/db'
import { parsePageLocator } from '@shared/reader'
import MarkEditor from './chrome/mark-editor.vue'

const props = defineProps<{
  bookmarks: NovelBookmark[]
  highlights: NovelHighlight[]
  /** Mark the reader just clicked in the text, called out in the list. */
  selectedId: string | null
}>()

const emit = defineEmits<{
  goTo: [volumeId: string, locator: string]
  updateBookmark: [id: string, note: string | null]
  updateHighlight: [id: string, updates: { note?: string | null; color?: HighlightColor }]
  removeBookmark: [id: string]
  removeHighlight: [id: string]
}>()

const { m } = useI18n()

const isEmpty = computed(() => props.bookmarks.length === 0 && props.highlights.length === 0)

const HEADING_CLASS = 'px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground'
const ROW_CLASS = 'flex items-start gap-1.5 rounded-md px-2 py-1.5 transition-colors'

function rowClass(id: string): string {
  return cn(ROW_CLASS, id === props.selectedId ? 'bg-accent' : 'hover:bg-accent/50')
}

/**
 * How far into the book a bookmark sits. A page locator carries its own page
 * number, which is more use than the fraction derived from it.
 */
function bookmarkLocation(bookmark: NovelBookmark): string {
  const page = parsePageLocator(bookmark.locator)
  if (page !== null) return m.value.reader.marks.page({ page: page + 1 })
  if (bookmark.progress === null) return ''
  return m.value.reader.values.percent({ value: Math.round(bookmark.progress * 100) })
}
</script>

<template>
  <ScrollRegion class="p-2">
    <p
      v-if="isEmpty"
      class="px-2 py-1 text-xs text-muted-foreground"
    >
      {{ m.reader.marks.empty }}
    </p>

    <template v-if="props.bookmarks.length > 0">
      <p :class="HEADING_CLASS">{{ m.reader.marks.bookmarksHeading }}</p>
      <div
        v-for="bookmark in props.bookmarks"
        :key="bookmark.id"
        :class="rowClass(bookmark.id)"
      >
        <Icon
          icon="icon-[mdi--bookmark-outline]"
          class="mt-0.5 size-3 shrink-0 text-muted-foreground"
        />
        <button
          type="button"
          class="min-w-0 flex-1 text-left"
          @click="emit('goTo', bookmark.volumeId, bookmark.locator)"
        >
          <!-- Without a quotable passage the location is the row's own title. -->
          <span class="line-clamp-2 text-xs">
            {{ bookmark.excerpt || bookmarkLocation(bookmark) }}
          </span>
          <span
            v-if="bookmark.excerpt"
            class="mt-0.5 block truncate text-xs text-muted-foreground"
          >
            {{ bookmarkLocation(bookmark) }}
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
          @update-note="(note) => emit('updateBookmark', bookmark.id, note)"
          @remove="emit('removeBookmark', bookmark.id)"
        />
      </div>
    </template>

    <template v-if="props.highlights.length > 0">
      <p :class="cn(HEADING_CLASS, props.bookmarks.length > 0 && 'mt-3')">
        {{ m.reader.marks.highlightsHeading }}
      </p>
      <div
        v-for="highlight in props.highlights"
        :key="highlight.id"
        :class="rowClass(highlight.id)"
      >
        <span
          class="mt-0.5 size-3 shrink-0 rounded-full"
          :style="{ backgroundColor: HIGHLIGHT_TINTS[highlight.color] }"
        />
        <button
          type="button"
          class="min-w-0 flex-1 text-left"
          @click="emit('goTo', highlight.volumeId, highlight.locator)"
        >
          <!-- The passage is its own label; a location line would only crowd it. -->
          <span class="line-clamp-2 text-xs">{{ highlight.excerpt }}</span>
          <span
            v-if="highlight.note"
            class="mt-0.5 line-clamp-2 block text-xs text-muted-foreground"
          >
            {{ highlight.note }}
          </span>
        </button>
        <MarkEditor
          :note="highlight.note"
          :color="highlight.color"
          @update-note="(note) => emit('updateHighlight', highlight.id, { note })"
          @update-color="(color) => emit('updateHighlight', highlight.id, { color })"
          @remove="emit('removeHighlight', highlight.id)"
        />
      </div>
    </template>
  </ScrollRegion>
</template>
