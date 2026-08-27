<!--
In-book search results, grouped by the section each hit falls in.
Boundary: the engine runs the search and draws the hits; this panel only feeds
it a query, renders what it yields, and clears the drawing on the way out.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Input } from '@renderer/components/ui/input'
import { Spinner } from '@renderer/components/ui/spinner'
import { useDebouncedRef } from '@renderer/composables/use-debounced-ref'
import { useI18n } from '@renderer/composables/use-i18n'
import { createLogger } from '@renderer/core/log'
import type { FoliateExcerpt, FoliateSearchResult } from '@renderer/core/reader/text/foliate'

const props = defineProps<{
  /** Runs a book-wide search; the panel renders only what it yields. */
  run: (query: string) => AsyncGenerator<FoliateSearchResult, void, undefined>
}>()

const emit = defineEmits<{
  goTo: [cfi: string]
  clear: []
}>()

const log = createLogger('Reader')
const { m } = useI18n()

/** Long enough that a word is typed before the book is walked. */
const DEBOUNCE_MS = 350

/**
 * Hits kept before the walk is abandoned. Every hit is also drawn in the text,
 * so a one-character query in a long book is a drawing cost, not a search cost.
 */
const MAX_RESULTS = 300

interface SearchGroup {
  /** Section labels repeat, so the first hit's position identifies the group. */
  key: string
  label: string
  items: { cfi: string; excerpt: FoliateExcerpt }[]
}

const query = ref('')
const debouncedQuery = useDebouncedRef(query, DEBOUNCE_MS)
const groups = ref<SearchGroup[]>([])
const running = ref(false)
const capped = ref(false)
/** Text the shown results belong to; empty until something has been searched. */
const searchedText = ref('')

const isEmptyResult = computed(
  () => searchedText.value !== '' && !running.value && groups.value.length === 0
)

// A run that is no longer the newest must not append to the list it started.
let runToken = 0

watch(debouncedQuery, (value) => {
  void runQuery(value)
})

onBeforeUnmount(() => {
  runToken += 1
  emit('clear')
})

/** Runs the query now, ahead of the pending debounce. */
function submit(): void {
  void runQuery(query.value)
}

/** Empties the field and drops the results with it, without waiting to debounce. */
function clearQuery(): void {
  query.value = ''
  void runQuery('')
}

async function runQuery(raw: string): Promise<void> {
  const text = raw.trim()
  // Enter and the debounce both arrive for the same text; the walk is expensive
  // enough that repeating it is worth guarding against.
  if (text === searchedText.value) return

  const token = ++runToken
  searchedText.value = text
  groups.value = []
  capped.value = false
  emit('clear')

  if (text === '') {
    running.value = false
    return
  }

  running.value = true
  let total = 0
  try {
    for await (const result of props.run(text)) {
      if (token !== runToken) return
      if (result === 'done') break
      if (!('subitems' in result)) continue

      const items = result.subitems.slice(0, MAX_RESULTS - total)
      total += items.length
      if (items.length > 0) {
        groups.value = [
          ...groups.value,
          {
            key: items[0].cfi,
            label: result.label.trim() || m.value.reader.search.unnamedSection,
            items
          }
        ]
      }

      // Leaving the loop returns the generator, which stops the walk.
      if (total >= MAX_RESULTS) {
        capped.value = true
        break
      }
    }
  } catch (error) {
    // Closing the volume mid-walk abandons the search; the hits already found
    // stay listed rather than the panel emptying itself.
    log.warn('In-book search stopped early.', error)
  } finally {
    if (token === runToken) running.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="p-2">
      <div class="relative">
        <Icon
          icon="icon-[mdi--magnify]"
          class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="query"
          autofocus
          class="bg-muted/50 pl-8 pr-7"
          :placeholder="m.reader.search.placeholder"
          @keydown.enter="submit"
        />
        <Spinner
          v-if="running"
          class="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Button
          v-else-if="query"
          variant="ghost"
          size="icon"
          class="absolute right-1.5 top-1/2 size-5 -translate-y-1/2"
          :tooltip="m.common.clear"
          @click="clearQuery"
        >
          <Icon
            icon="icon-[mdi--close]"
            class="size-3"
          />
        </Button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <p
        v-if="isEmptyResult"
        class="px-2 py-1 text-xs text-muted-foreground"
      >
        {{ m.reader.search.noResults }}
      </p>

      <div
        v-for="group in groups"
        :key="group.key"
        class="mb-1"
      >
        <!-- The panel's own plane at full opacity: a heading that results slide
             under has to occlude them, and an elevated plane would read as a
             floating slab rather than part of the panel. The reader window has
             no light layers behind it, so nothing is lost by not transmitting. -->
        <div
          class="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-[var(--surface)] px-2 py-1"
        >
          <span class="min-w-0 truncate text-xs font-medium">
            {{ group.label }}
          </span>
          <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {{ group.items.length }}
          </span>
        </div>

        <button
          v-for="item in group.items"
          :key="item.cfi"
          type="button"
          class="block w-full rounded-md px-2 py-1.5 text-left text-xs leading-relaxed text-muted-foreground transition-colors hover:bg-accent/50"
          @click="emit('goTo', item.cfi)"
        >
          <span>{{ item.excerpt.pre }}</span>
          <span class="rounded-sm bg-primary/15 px-0.5 font-medium text-foreground">
            {{ item.excerpt.match }}
          </span>
          <span>{{ item.excerpt.post }}</span>
        </button>
      </div>

      <p
        v-if="capped"
        class="px-2 py-1 text-[11px] text-muted-foreground"
      >
        {{ m.reader.search.tooMany({ count: MAX_RESULTS }) }}
      </p>
    </div>
  </div>
</template>
