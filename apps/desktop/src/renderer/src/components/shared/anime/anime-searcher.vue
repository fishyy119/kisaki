<!--
  AnimeSearcher
  Reusable anime search component.
  Supports both search by name and direct ID identification.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref, computed, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import { ipcManager } from '@renderer/core/ipc'
import { useI18n } from '@renderer/composables/use-i18n'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { StateView } from '@renderer/components/ui/state-view'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell
} from '@renderer/components/ui/table'
import { ScraperProfileSelect, useSearchProviderSource } from '@renderer/components/shared/scraper'
import type { AnimeSearchResult } from '@shared/scraper'
import type { AnimeSearcherSelection } from './types'

interface Props {
  /** Default profile ID to use */
  defaultProfileId?: string
  /** Default search query */
  defaultSearchQuery?: string
  /** Default anime ID */
  defaultAnimeId?: string
  /** Whether the component is in a loading/submitting state */
  isSubmitting?: boolean
  /** Custom class name */
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  defaultSearchQuery: '',
  defaultAnimeId: '',
  isSubmitting: false
})

const { m, f } = useI18n()

const emit = defineEmits<{
  selectionChange: [selection: AnimeSearcherSelection]
}>()

const selectedProfileId = ref('')
const searchProviderSource = useSearchProviderSource(selectedProfileId, 'anime')

function resetSelectionState() {
  searchResults.value = []
  hasSearched.value = false
  selectedResultId.value = null
  animeId.value = ''
}

watch(
  () => props.defaultProfileId,
  (defaultId) => {
    if (defaultId && !selectedProfileId.value) {
      selectedProfileId.value = defaultId
    }
  },
  { immediate: true }
)

watch(selectedProfileId, (id, previousId) => {
  if (previousId && previousId !== id) {
    resetSelectionState()
  }
})

const searchQuery = ref('')
watch(
  () => props.defaultSearchQuery,
  (defaultQuery) => {
    if (defaultQuery !== undefined) {
      searchQuery.value = defaultQuery
    }
  },
  { immediate: true }
)
const isSearching = ref(false)
const searchResults = ref<AnimeSearchResult[]>([])
const hasSearched = ref(false)

const RESULT_TABLE_COLUMNS = ['', '30%', '7.5rem']

const animeId = ref('')
watch(
  () => props.defaultAnimeId,
  (defaultId) => {
    if (defaultId !== undefined) {
      animeId.value = defaultId
    }
  },
  { immediate: true }
)
const selectedResultId = ref<string | null>(null)

const canSubmit = computed(
  () => !!selectedProfileId.value && !!animeId.value.trim() && !props.isSubmitting
)

watch(
  [selectedProfileId, searchProviderSource, animeId, searchResults, selectedResultId],
  () => {
    const trimmedAnimeId = animeId.value.trim()
    const selectedResult = selectedResultId.value
      ? searchResults.value.find((result) => result.id === selectedResultId.value)
      : null
    const fallbackKnownIds =
      searchProviderSource.value && trimmedAnimeId
        ? [{ source: searchProviderSource.value, id: trimmedAnimeId }]
        : []

    emit('selectionChange', {
      profileId: selectedProfileId.value,
      animeId: trimmedAnimeId,
      animeName: selectedResult?.name ?? searchQuery.value.trim(),
      originalName: selectedResult?.originalName,
      knownIds: selectedResult?.externalIds ?? fallbackKnownIds,
      canSubmit: canSubmit.value
    })
  },
  { immediate: true }
)

async function handleSearch() {
  if (!searchQuery.value.trim() || !selectedProfileId.value) return

  isSearching.value = true
  hasSearched.value = true
  searchResults.value = []
  selectedResultId.value = null

  try {
    const result = await ipcManager.invoke(
      'scraper:search-anime',
      selectedProfileId.value,
      searchQuery.value.trim()
    )

    if (!result.success) {
      throw new Error('Search failed.')
    }

    searchResults.value = result.data ?? []
  } catch (error) {
    notify.error(
      m.value.library.feedback.searchFailed,
      error instanceof Error ? error.message : m.value.library.feedback.unknownError
    )
  } finally {
    isSearching.value = false
  }
}

function handleSearchKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleSearch()
  }
}

function handleResultSelect(result: AnimeSearchResult) {
  selectedResultId.value = result.id
  animeId.value = result.id
}

// Clears the picked result when the id is edited by hand.
const animeIdModel = computed({
  get: () => animeId.value,
  set: (value: string) => {
    animeId.value = value
    selectedResultId.value = null
  }
})
</script>

<template>
  <FieldGroup :class="props.class">
    <Field>
      <FieldLabel>{{ m.library.searcher.scraperProfile }}</FieldLabel>
      <FieldContent>
        <ScraperProfileSelect
          v-model="selectedProfileId"
          media-type="anime"
        />
      </FieldContent>
    </Field>

    <Field>
      <FieldLabel>
        {{ m.library.searcher.searchLabel({ label: m.library.entities.anime }) }}
      </FieldLabel>
      <FieldContent>
        <div class="flex gap-2">
          <Input
            v-model="searchQuery"
            :placeholder="m.library.searcher.namePlaceholder({ label: m.library.entities.anime })"
            :disabled="!selectedProfileId || isSearching"
            class="flex-1"
            @keydown="handleSearchKeyDown"
          />
          <Button
            type="button"
            variant="secondary"
            :disabled="!searchQuery.trim() || !selectedProfileId || isSearching"
            @click="handleSearch"
          >
            <Icon
              v-if="isSearching"
              icon="icon-[mdi--loading]"
              class="size-4 animate-spin"
            />
            <Icon
              v-else
              icon="icon-[mdi--magnify]"
              class="size-4"
            />
            {{ m.common.search }}
          </Button>
        </div>
      </FieldContent>
    </Field>

    <div class="border border-border rounded-md overflow-hidden">
      <Table
        fixed-header
        :columns="RESULT_TABLE_COLUMNS"
        body-class="h-[20vh]"
      >
        <template #header>
          <TableHeader>
            <TableRow>
              <TableHead>{{ m.library.searcher.columnName }}</TableHead>
              <TableHead>{{ m.library.searcher.columnOriginalName }}</TableHead>
              <TableHead>{{ m.library.searcher.columnReleaseDate }}</TableHead>
            </TableRow>
          </TableHeader>
        </template>

        <template #state>
          <StateView
            v-if="!hasSearched"
            state="empty"
            size="sm"
            icon="icon-[mdi--magnify]"
            :description="m.library.searcher.startHint({ label: m.library.entities.anime })"
            class="h-full"
          />

          <StateView
            v-else-if="isSearching"
            state="loading"
            size="sm"
            class="h-full"
          />

          <StateView
            v-else-if="searchResults.length === 0"
            state="empty"
            size="sm"
            icon="icon-[mdi--magnify-close]"
            :title="m.library.searcher.noMatchTitle"
            :description="m.library.searcher.noMatchDescription"
            class="h-full"
          />
        </template>

        <TableBody>
          <TableRow
            v-for="result in searchResults"
            :key="result.id"
            :data-state="selectedResultId === result.id ? 'selected' : undefined"
            class="cursor-pointer text-xs border-border"
            @click="handleResultSelect(result)"
          >
            <TableCell class="truncate">{{ result.name }}</TableCell>
            <TableCell class="text-muted-foreground truncate">
              {{ result.originalName || '-' }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ result.releaseDate ? f.date(result.releaseDate) : m.common.emptyValue }}
            </TableCell>
          </TableRow>
        </TableBody>

        <template #footer>
          <TableFooter>
            <TableRow>
              <TableCell
                colspan="3"
                class="h-6 py-0 text-[10px] text-muted-foreground"
              >
                {{ m.library.searcher.resultCount({ count: searchResults.length }) }}
                <template v-if="selectedResultId"> · {{ m.library.searcher.selectedOne }}</template>
              </TableCell>
            </TableRow>
          </TableFooter>
        </template>
      </Table>
    </div>

    <Field>
      <FieldLabel>{{ m.library.searcher.idLabel({ label: m.library.entities.anime }) }}</FieldLabel>
      <FieldContent>
        <Input
          v-model="animeIdModel"
          :placeholder="m.library.searcher.idPlaceholder"
          :disabled="!selectedProfileId || props.isSubmitting"
          class="font-mono text-xs"
        />
      </FieldContent>
    </Field>
  </FieldGroup>
</template>
