<!--
Extension Browse Panel renders extension discovery results.
Boundary: reads store filters and queries extension discovery channels.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { Button } from '@renderer/components/ui/button'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { useAsyncData } from '@renderer/composables/use-async-data'
import ExtensionDiscoverPanelCard from './discover-panel-card.vue'
import ExtensionDiscoverPanelFilterBar from './discover-panel-filter-bar.vue'
import { useDiscoverExtensionStore } from '../../stores'
import type { ExtensionCatalogInfo, ExtensionRegistryEntry } from '@shared/extension'

const PAGE_SIZE = 20

const store = useDiscoverExtensionStore()

async function searchExtensionPage(
  page: number
): Promise<{ results: ExtensionRegistryEntry[]; hasMore: boolean }> {
  const data = unwrapIpcData(
    await ipcManager.invoke('extension:search', store.selectedRegistry, store.searchQuery, {
      page,
      limit: PAGE_SIZE,
      sortBy: store.sortField === 'updatedAt' ? 'updated' : store.sortField,
      sortDirection: store.sortDirection
    })
  )

  return { results: data.entries, hasMore: data.hasMore }
}

const additionalResults = ref<ExtensionRegistryEntry[]>([])
const additionalHasMore = ref(false)
const page = ref(1)
const isLoadingMore = ref(false)
const queryKey = computed(() =>
  [store.searchTrigger, store.selectedRegistry, store.sortField, store.sortDirection].join(':')
)

// Use useAsyncData for the initial search (page 1)
const {
  data: searchData,
  isFetching,
  isLoading
} = useAsyncData(() => searchExtensionPage(1), {
  watch: [queryKey],
  immediate: true
})
const { data: catalog, refetch: refetchCatalog } = useAsyncData(
  async () => unwrapIpcData(await ipcManager.invoke('extension:get-catalog')),
  {
    immediate: true
  }
)

watch(
  queryKey,
  () => {
    page.value = 1
    additionalResults.value = []
    additionalHasMore.value = false
  },
  { immediate: true }
)

const allResults = computed(() => {
  const base = searchData.value?.results ?? []
  return [...base, ...additionalResults.value]
})

const hasMore = computed(() => {
  return page.value === 1 ? (searchData.value?.hasMore ?? false) : additionalHasMore.value
})

const displayedResults = computed(() => {
  let result = [...allResults.value]

  if (store.selectedCategory) {
    result = result.filter((p) => p.categories?.includes(store.selectedCategory!))
  }

  const direction = store.sortDirection === 'asc' ? 1 : -1
  result.sort((a, b) => {
    let comparison = 0
    switch (store.sortField) {
      case 'stars':
        comparison = (a.stars ?? 0) - (b.stars ?? 0)
        break
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'updatedAt':
        comparison = String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? ''))
        break
    }
    return direction * comparison
  })

  return result
})

const searched = computed(() => !isLoading.value)
const installedIds = computed(() => new Set((catalog.value ?? []).map((entry) => entry.id)))
const installedSourceKeys = computed(
  () => new Set((catalog.value ?? []).map((entry) => getCatalogSourceKey(entry)).filter(Boolean))
)

async function handleLoadMore() {
  isLoadingMore.value = true
  const nextPage = page.value + 1

  try {
    const data = await searchExtensionPage(nextPage)

    page.value = nextPage
    additionalResults.value = [...additionalResults.value, ...data.results]
    additionalHasMore.value = data.hasMore
  } finally {
    isLoadingMore.value = false
  }
}

const loading = computed(() => isFetching.value || isLoadingMore.value)

function getCatalogSourceKey(entry: ExtensionCatalogInfo): string | null {
  if (!entry.source) {
    return null
  }

  return getRegistrySourceKey(entry.source.provider, entry.source.locator)
}

function getRegistrySourceKey(provider: string, locator: string): string {
  return `${provider}:${normalizeRegistryLocator(provider, locator)}`
}

function normalizeRegistryLocator(provider: string, locator: string): string {
  if (provider === 'github' && locator.startsWith('github:')) {
    const [ownerRepo] = locator.slice('github:'.length).split('@', 2)
    return `github:${ownerRepo}`
  }

  return locator
}

function isInstalled(extension: ExtensionRegistryEntry): boolean {
  return (
    installedIds.value.has(extension.id) ||
    installedSourceKeys.value.has(getRegistrySourceKey(extension.provider, extension.locator))
  )
}
</script>

<template>
  <div class="flex flex-col h-full">
    <ExtensionDiscoverPanelFilterBar />

    <div class="flex-1 overflow-auto scrollbar-thin">
      <template v-if="loading && displayedResults.length === 0">
        <div class="flex items-center justify-center h-48">
          <Spinner class="size-6" />
        </div>
      </template>

      <template v-else-if="displayedResults.length === 0 && searched">
        <div class="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Icon
            icon="icon-[mdi--puzzle-outline]"
            class="size-16 mb-3 opacity-30"
          />
          <p class="font-medium">未找到扩展</p>
          <p class="text-sm mt-1 text-muted-foreground/70">
            {{ store.selectedCategory ? '该分类下暂无扩展' : '暂无扩展' }}
          </p>
        </div>

        <div
          v-if="hasMore"
          class="flex justify-center py-6"
        >
          <Button
            variant="outline"
            size="sm"
            :disabled="loading"
            @click="handleLoadMore"
          >
            <Spinner
              v-if="loading"
              class="size-4 mr-2"
            />
            加载更多
          </Button>
        </div>
      </template>

      <template v-else>
        <!-- Grid - no container borders -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <ExtensionDiscoverPanelCard
            v-for="extension in displayedResults"
            :key="extension.id"
            :extension="extension"
            :installed="isInstalled(extension)"
            :refresh-installed-state="refetchCatalog"
          />
        </div>

        <div
          v-if="hasMore"
          class="flex justify-center py-6"
        >
          <Button
            variant="outline"
            size="sm"
            :disabled="loading"
            @click="handleLoadMore"
          >
            <Spinner
              v-if="loading"
              class="size-4 mr-2"
            />
            加载更多
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
