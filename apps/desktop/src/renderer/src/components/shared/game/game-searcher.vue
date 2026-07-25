<!--
  GameSearcher
  Reusable game search component.
  Supports both search by name and direct ID identification.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { useI18n } from '@renderer/composables/use-i18n'
import { scraperProfiles, type ScraperProfile } from '@shared/db'
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
import { ScraperProfileSelect } from '@renderer/components/shared/scraper'
import type { GameSearchResult } from '@shared/scraper'
import type { GameSearcherSelection } from './types'

interface Props {
  /** Default profile ID to use */
  defaultProfileId?: string
  /** Default search query */
  defaultSearchQuery?: string
  /** Default game ID */
  defaultGameId?: string
  /** Whether the component is in a loading/submitting state */
  isSubmitting?: boolean
  /** Custom class name */
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  defaultSearchQuery: '',
  defaultGameId: '',
  isSubmitting: false
})

const { m, f } = useI18n()

const emit = defineEmits<{
  selectionChange: [selection: GameSearcherSelection]
}>()

// Profile state - initialized via watch to maintain reactivity
const selectedProfileId = ref('')
const selectedProfile = ref<ScraperProfile | null>(null)

function resetSelectionState() {
  searchResults.value = []
  hasSearched.value = false
  selectedResultId.value = null
  gameId.value = ''
}

// Initialize from props
watch(
  () => props.defaultProfileId,
  (defaultId) => {
    if (defaultId && !selectedProfileId.value) {
      selectedProfileId.value = defaultId
    }
  },
  { immediate: true }
)

// Fetch profile details when profileId changes (for searchProviderId)
watch(
  selectedProfileId,
  async (id, previousId) => {
    if (previousId && previousId !== id) {
      resetSelectionState()
    }

    if (!id) {
      selectedProfile.value = null
      return
    }

    selectedProfile.value = null
    const profile = await db.query.scraperProfiles.findFirst({
      where: eq(scraperProfiles.id, id)
    })

    if (selectedProfileId.value !== id) {
      return
    }

    selectedProfile.value = profile ?? null
  },
  { immediate: true }
)

// Search state - use computed for props to maintain reactivity
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
const searchResults = ref<GameSearchResult[]>([])
const hasSearched = ref(false)

const RESULT_TABLE_COLUMNS = ['', '30%', '7.5rem']

// ID state
const gameId = ref('')
watch(
  () => props.defaultGameId,
  (defaultId) => {
    if (defaultId !== undefined) {
      gameId.value = defaultId
    }
  },
  { immediate: true }
)
const selectedResultId = ref<string | null>(null)

// Notify parent when relevant state changes
const canSubmit = computed(
  () => !!selectedProfileId.value && !!gameId.value.trim() && !props.isSubmitting
)

watch(
  [selectedProfileId, selectedProfile, gameId, searchResults, selectedResultId],
  () => {
    const trimmedGameId = gameId.value.trim()
    const selectedResult = selectedResultId.value
      ? searchResults.value.find((r) => r.id === selectedResultId.value)
      : null
    const fallbackKnownIds =
      selectedProfile.value?.searchProviderId && trimmedGameId
        ? [{ source: selectedProfile.value.searchProviderId, id: trimmedGameId }]
        : []

    emit('selectionChange', {
      profileId: selectedProfileId.value,
      gameId: trimmedGameId,
      gameName: selectedResult?.name ?? searchQuery.value.trim(),
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
      'scraper:search-game',
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

function handleResultSelect(result: GameSearchResult) {
  selectedResultId.value = result.id
  gameId.value = result.id
}

// Computed model for game ID input (clears selection when manually edited)
const gameIdModel = computed({
  get: () => gameId.value,
  set: (v: string) => {
    gameId.value = v
    selectedResultId.value = null
  }
})
</script>

<template>
  <FieldGroup :class="props.class">
    <!-- Profile selector -->
    <Field>
      <FieldLabel>{{ m.library.searcher.scraperProfile }}</FieldLabel>
      <FieldContent>
        <ScraperProfileSelect
          v-model="selectedProfileId"
          media-type="game"
        />
      </FieldContent>
    </Field>

    <!-- Search section -->
    <Field>
      <FieldLabel>{{
        m.library.searcher.searchLabel({ label: m.library.entities.game })
      }}</FieldLabel>
      <FieldContent>
        <div class="flex gap-2">
          <Input
            v-model="searchQuery"
            :placeholder="m.library.searcher.namePlaceholder({ label: m.library.entities.game })"
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

    <!-- Search results table -->
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
            :description="m.library.searcher.startHint({ label: m.library.entities.game })"
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

    <!-- ID input -->
    <Field>
      <FieldLabel>{{ m.library.searcher.idLabel({ label: m.library.entities.game }) }}</FieldLabel>
      <FieldContent>
        <Input
          v-model="gameIdModel"
          :placeholder="m.library.searcher.idPlaceholder"
          :disabled="!selectedProfileId || props.isSubmitting"
          class="font-mono text-xs"
        />
      </FieldContent>
    </Field>
  </FieldGroup>
</template>
