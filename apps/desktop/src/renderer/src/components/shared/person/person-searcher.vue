<!--
  PersonSearcher
  Reusable person search component.
  Supports both search by name and direct ID identification.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { formatDate } from '@renderer/utils/datetime'
import { scraperProfiles, type ScraperProfile } from '@shared/db'
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
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell
} from '@renderer/components/ui/table'
import { ScraperProfileSelect } from '@renderer/components/shared/scraper'
import type { PersonSearchResult } from '@shared/scraper'
import type { PersonSearcherSelection } from './types'

interface Props {
  /** Default profile ID to use */
  defaultProfileId?: string
  /** Default search query */
  defaultSearchQuery?: string
  /** Default person ID */
  defaultPersonId?: string
  /** Whether the component is in a loading/submitting state */
  isSubmitting?: boolean
  /** Custom class name */
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  defaultSearchQuery: '',
  defaultPersonId: '',
  isSubmitting: false
})

const emit = defineEmits<{
  selectionChange: [selection: PersonSearcherSelection]
}>()

// Profile state - initialized via watch to maintain reactivity
const selectedProfileId = ref('')
const selectedProfile = ref<ScraperProfile | null>(null)

function resetSelectionState() {
  searchResults.value = []
  hasSearched.value = false
  selectedResultId.value = null
  personId.value = ''
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

// Search state
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
const searchResults = ref<PersonSearchResult[]>([])
const hasSearched = ref(false)

const RESULT_TABLE_COLUMNS = ['', '28%', '7rem', '7rem']

// ID state
const personId = ref('')
watch(
  () => props.defaultPersonId,
  (defaultId) => {
    if (defaultId !== undefined) {
      personId.value = defaultId
    }
  },
  { immediate: true }
)
const selectedResultId = ref<string | null>(null)

const canSubmit = computed(
  () => !!selectedProfileId.value && !!personId.value.trim() && !props.isSubmitting
)

watch(
  [selectedProfileId, selectedProfile, personId, searchResults, selectedResultId],
  () => {
    const trimmedId = personId.value.trim()
    const selectedResult = selectedResultId.value
      ? searchResults.value.find((r) => r.id === selectedResultId.value)
      : null
    const fallbackKnownIds =
      selectedProfile.value?.searchProviderId && trimmedId
        ? [{ source: selectedProfile.value.searchProviderId, id: trimmedId }]
        : []

    emit('selectionChange', {
      profileId: selectedProfileId.value,
      personId: trimmedId,
      personName: selectedResult?.name ?? searchQuery.value.trim(),
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
      'scraper:search-person',
      selectedProfileId.value,
      searchQuery.value.trim()
    )

    if (!result.success) {
      throw new Error('Search failed.')
    }

    searchResults.value = result.data ?? []
  } catch (error) {
    notify.error('搜索失败', error instanceof Error ? error.message : '未知错误')
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

function handleResultSelect(result: PersonSearchResult) {
  selectedResultId.value = result.id
  personId.value = result.id
}

const personIdModel = computed({
  get: () => personId.value,
  set: (v: string) => {
    personId.value = v
    selectedResultId.value = null
  }
})
</script>

<template>
  <FieldGroup :class="props.class">
    <Field>
      <FieldLabel>刮削配置</FieldLabel>
      <FieldContent>
        <ScraperProfileSelect
          v-model="selectedProfileId"
          media-type="person"
        />
      </FieldContent>
    </Field>

    <Field>
      <FieldLabel>搜索人物</FieldLabel>
      <FieldContent>
        <div class="flex gap-2">
          <Input
            v-model="searchQuery"
            placeholder="输入人物名称..."
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
            搜索
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
              <TableHead class="h-7 text-[11px]">名称</TableHead>
              <TableHead class="h-7 text-[11px]">原名</TableHead>
              <TableHead class="h-7 text-[11px]">出生</TableHead>
              <TableHead class="h-7 text-[11px]">逝世</TableHead>
            </TableRow>
          </TableHeader>
        </template>

        <template #state>
          <StateView
            v-if="!hasSearched"
            state="empty"
            size="sm"
            icon="icon-[mdi--magnify]"
            description="输入人物名称开始搜索"
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
            title="无匹配结果"
            description="请尝试其它关键词"
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
              {{ formatDate(result.birthDate ?? null) }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatDate(result.deathDate ?? null) }}
            </TableCell>
          </TableRow>
        </TableBody>

        <template #footer>
          <TableFooter>
            <TableRow>
              <TableCell
                colspan="4"
                class="h-6 py-0 text-[10px] text-muted-foreground"
              >
                共 {{ searchResults.length }} 条结果
                <template v-if="selectedResultId"> · 已选择 1 条</template>
              </TableCell>
            </TableRow>
          </TableFooter>
        </template>
      </Table>
    </div>

    <Field>
      <FieldLabel>
        <span>人物 ID</span>
        <FieldDescription>从搜索结果选择或直接输入 ID</FieldDescription>
      </FieldLabel>
      <FieldContent>
        <Input
          v-model="personIdModel"
          placeholder="从上方选择或直接输入..."
          :disabled="!selectedProfileId || props.isSubmitting"
          class="font-mono text-xs"
        />
      </FieldContent>
    </Field>
  </FieldGroup>
</template>
