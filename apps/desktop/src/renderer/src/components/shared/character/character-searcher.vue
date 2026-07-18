<!--
  CharacterSearcher
  Reusable character search component.
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
import type { CharacterSearchResult } from '@shared/scraper'
import type { CharacterSearcherSelection } from './types'

interface Props {
  defaultProfileId?: string
  defaultSearchQuery?: string
  defaultCharacterId?: string
  isSubmitting?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  defaultSearchQuery: '',
  defaultCharacterId: '',
  isSubmitting: false
})

const emit = defineEmits<{
  selectionChange: [selection: CharacterSearcherSelection]
}>()

const selectedProfileId = ref('')
const selectedProfile = ref<ScraperProfile | null>(null)

function resetSelectionState() {
  searchResults.value = []
  hasSearched.value = false
  selectedResultId.value = null
  characterId.value = ''
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
const searchResults = ref<CharacterSearchResult[]>([])
const hasSearched = ref(false)

const RESULT_TABLE_COLUMNS = ['', '35%', '8rem']

const characterId = ref('')
watch(
  () => props.defaultCharacterId,
  (defaultId) => {
    if (defaultId !== undefined) {
      characterId.value = defaultId
    }
  },
  { immediate: true }
)
const selectedResultId = ref<string | null>(null)

const canSubmit = computed(
  () => !!selectedProfileId.value && !!characterId.value.trim() && !props.isSubmitting
)

watch(
  [selectedProfileId, selectedProfile, characterId, searchResults, selectedResultId],
  () => {
    const trimmedId = characterId.value.trim()
    const selectedResult = selectedResultId.value
      ? searchResults.value.find((r) => r.id === selectedResultId.value)
      : null
    const fallbackKnownIds =
      selectedProfile.value?.searchProviderId && trimmedId
        ? [{ source: selectedProfile.value.searchProviderId, id: trimmedId }]
        : []

    emit('selectionChange', {
      profileId: selectedProfileId.value,
      characterId: trimmedId,
      characterName: selectedResult?.name ?? searchQuery.value.trim(),
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
      'scraper:search-character',
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

function handleResultSelect(result: CharacterSearchResult) {
  selectedResultId.value = result.id
  characterId.value = result.id
}

const characterIdModel = computed({
  get: () => characterId.value,
  set: (v: string) => {
    characterId.value = v
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
          media-type="character"
        />
      </FieldContent>
    </Field>

    <Field>
      <FieldLabel>搜索角色</FieldLabel>
      <FieldContent>
        <div class="flex gap-2">
          <Input
            v-model="searchQuery"
            placeholder="输入角色名称..."
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
            </TableRow>
          </TableHeader>
        </template>

        <template #state>
          <StateView
            v-if="!hasSearched"
            state="empty"
            size="sm"
            icon="icon-[mdi--magnify]"
            description="输入角色名称开始搜索"
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
          </TableRow>
        </TableBody>

        <template #footer>
          <TableFooter>
            <TableRow>
              <TableCell
                colspan="3"
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
        <span>角色 ID</span>
        <FieldDescription>从搜索结果选择或直接输入 ID</FieldDescription>
      </FieldLabel>
      <FieldContent>
        <Input
          v-model="characterIdModel"
          placeholder="从上方选择或直接输入..."
          :disabled="!selectedProfileId || props.isSubmitting"
          class="font-mono text-xs"
        />
      </FieldContent>
    </Field>
  </FieldGroup>
</template>
