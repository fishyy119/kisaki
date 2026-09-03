<!--
  EntitySearcher
  Names one provider entry for an entity: search by name and pick a row, or type
  a provider id directly. The search channel, the columns that tell candidates
  apart and the lookup facts a row contributes come from the spec registry.
-->
<script setup lang="ts" generic="T extends ContentEntityType">
import type { HTMLAttributes } from 'vue'
import { computed, ref, shallowRef, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldGroup,
  FieldDescription
} from '@renderer/components/ui/field'
import { StateView } from '@renderer/components/ui/state-view'
import {
  Table,
  TableBody,
  TableFooter,
  TableRow,
  TableCell,
  type TableColumn
} from '@renderer/components/ui/table'
import { ScraperProfileSelect, useSearchProviderSource } from '@renderer/components/shared/scraper'
import type { ContentEntityType } from '@shared/entity-types'
import type { EntitySearcherSelection } from './selection'
import { SEARCHER_SPECS, type ScraperLookupMap, type SearchResultMap } from './specs'

interface Props {
  entityType: T
  /** Profile preselected when the caller already knows one. */
  defaultProfileId?: string
  defaultSearchQuery?: string
  /** Whether the caller is submitting, which locks the id input. */
  isSubmitting?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  defaultSearchQuery: '',
  isSubmitting: false
})

const emit = defineEmits<{
  selectionChange: [selection: EntitySearcherSelection<ScraperLookupMap[T]>]
}>()

const { m, f } = useI18n()

const spec = computed(() => SEARCHER_SPECS[props.entityType])
const entityLabel = computed(() => m.value.library.entities[props.entityType])
const columns = computed<TableColumn[]>(() =>
  spec.value.columns.map((column, index) => ({
    label: column.header(m.value),
    width: column.width,
    tone: index === 0 ? 'default' : 'muted'
  }))
)

const selectedProfileId = ref('')
const searchProviderSource = useSearchProviderSource(selectedProfileId, () => props.entityType)

const searchQuery = ref('')
const isSearching = ref(false)
/**
 * Shallow: the picked row travels back to the main process inside the emitted
 * lookup, and a reactive proxy cannot cross IPC. Rows are only ever replaced
 * wholesale, so nothing here needs deep tracking.
 */
const searchResults = shallowRef<SearchResultMap[T][]>([])
const hasSearched = ref(false)
const entityId = ref('')
const selectedResultId = ref<string | null>(null)

function resetSelectionState(): void {
  searchResults.value = []
  hasSearched.value = false
  selectedResultId.value = null
  entityId.value = ''
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

// A different entity type searches other providers, so nothing carries over.
watch(
  () => props.entityType,
  () => resetSelectionState()
)

watch(
  () => props.defaultSearchQuery,
  (defaultQuery) => {
    searchQuery.value = defaultQuery
  },
  { immediate: true }
)

const canSubmit = computed(
  () => !!selectedProfileId.value && !!entityId.value.trim() && !props.isSubmitting
)

watch(
  [selectedProfileId, searchProviderSource, entityId, searchResults, selectedResultId],
  () => {
    const trimmedId = entityId.value.trim()
    const selectedResult =
      searchResults.value.find((result) => result.id === selectedResultId.value) ?? null
    const fallbackKnownIds =
      searchProviderSource.value && trimmedId
        ? [{ source: searchProviderSource.value, id: trimmedId }]
        : []

    emit('selectionChange', {
      profileId: selectedProfileId.value,
      lookup: spec.value.buildLookup(
        {
          name: selectedResult?.originalName || selectedResult?.name || searchQuery.value.trim(),
          knownIds: selectedResult?.externalIds ?? fallbackKnownIds
        },
        selectedResult
      ),
      canSubmit: canSubmit.value
    })
  },
  { immediate: true }
)

async function handleSearch(): Promise<void> {
  if (!searchQuery.value.trim() || !selectedProfileId.value) return

  isSearching.value = true
  hasSearched.value = true
  searchResults.value = []
  selectedResultId.value = null

  try {
    const result = await spec.value.search(selectedProfileId.value, searchQuery.value.trim())

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

function handleSearchKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleSearch()
  }
}

function handleResultSelect(result: SearchResultMap[T]): void {
  selectedResultId.value = result.id
  entityId.value = result.id
}

// Clears the picked row when the id is edited by hand.
const entityIdModel = computed({
  get: () => entityId.value,
  set: (value: string) => {
    entityId.value = value
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
          :entity-type="props.entityType"
        />
      </FieldContent>
    </Field>

    <Field>
      <FieldLabel>{{ m.library.searcher.searchLabel({ label: entityLabel }) }}</FieldLabel>
      <FieldContent>
        <div class="flex gap-2">
          <Input
            v-model="searchQuery"
            :placeholder="m.library.searcher.namePlaceholder({ label: entityLabel })"
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
            {{ m.actions.search }}
          </Button>
        </div>
      </FieldContent>
    </Field>

    <div class="border border-border rounded-md overflow-hidden">
      <Table
        fixed-header
        :columns="columns"
        body-class="h-40"
      >
        <template #state>
          <StateView
            v-if="!hasSearched"
            state="empty"
            size="sm"
            icon="icon-[mdi--magnify]"
            :description="m.library.searcher.startHint({ label: entityLabel })"
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
            <TableCell
              v-for="(column, index) in spec.columns"
              :key="index"
              class="truncate"
            >
              {{ column.cell(result, m, f) }}
            </TableCell>
          </TableRow>
        </TableBody>

        <template #footer>
          <TableFooter>
            <TableRow>
              <TableCell
                :colspan="spec.columns.length"
                class="h-6 py-0 text-muted-foreground"
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
      <FieldLabel>
        <span>{{ m.library.searcher.idLabel({ label: entityLabel }) }}</span>
        <FieldDescription>{{ m.library.searcher.idDescription }}</FieldDescription>
      </FieldLabel>
      <FieldContent>
        <Input
          v-model="entityIdModel"
          :placeholder="m.library.searcher.idPlaceholder"
          :disabled="!selectedProfileId || props.isSubmitting"
          class="font-mono"
        />
      </FieldContent>
    </Field>
  </FieldGroup>
</template>
