<!--
Extension Browse Panel renders extension catalog results.
Boundary: reads store filters and queries the repository-backed catalog.
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Spinner } from '@renderer/components/ui/spinner'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { ipcManager } from '@renderer/core/ipc'
import { useI18n } from '@renderer/composables/use-i18n'
import ExtensionReleaseDialog from '../extension-release-dialog.vue'
import ExtensionDiscoverPanelCard from './discover-panel-card.vue'
import ExtensionDiscoverPanelDetailsDialog from './discover-panel-details-dialog.vue'
import ExtensionDiscoverPanelFilterBar from './discover-panel-filter-bar.vue'
import { useDiscoverExtensionStore } from '../../stores'
import { discoverSearchData, installedExtensionsData, searchExtensionPage } from '../../composables'
import type {
  ExtensionCatalogPackageInfo,
  ExtensionCreateRepositoryReleasePlanRequest,
  ExtensionInstalledPackageInfo
} from '@shared/extension'

const store = useDiscoverExtensionStore()
const { m } = useI18n()

const additionalResults = ref<ExtensionCatalogPackageInfo[]>([])
const additionalHasMore = ref(false)
const page = ref(1)
const isLoadingMore = ref(false)
const detailsPackage = ref<ExtensionCatalogPackageInfo | null>(null)
const detailsOpen = ref(false)
const releaseRequest = ref<ExtensionCreateRepositoryReleasePlanRequest | null>(null)
const releaseDialogOpen = ref(false)
const queryKey = computed(() =>
  [
    store.searchQuery,
    store.selectedRepositoryId ?? 'all',
    store.selectedCategory ?? 'all',
    store.compatibleOnly ? 'compatible' : 'any',
    store.sortField,
    store.sortDirection
  ].join(':')
)

// Initial search (page 1) and installed catalog settle during navigation via
// the route loaders; filter changes trigger a non-blocking SWR refetch.
const { data: searchData, isFetching, refetch: refetchSearch } = discoverSearchData()
const { data: catalog, refetch: refetchCatalog } = installedExtensionsData()

let unsubscribeCatalogChanged: (() => void) | null = null
let unsubscribeInstallationsChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeCatalogChanged = ipcManager.on('extension:catalog-changed', () => {
    refetchSearch()
  })
  unsubscribeInstallationsChanged = ipcManager.on('extension:installations-changed', () => {
    refetchCatalog()
  })
})

onUnmounted(() => {
  unsubscribeCatalogChanged?.()
  unsubscribeInstallationsChanged?.()
})

watch(queryKey, () => {
  page.value = 1
  additionalResults.value = []
  additionalHasMore.value = false
  void refetchSearch()
})

const allResults = computed(() => {
  const base = searchData.value?.results ?? []
  return [...base, ...additionalResults.value]
})

const hasMore = computed(() => {
  return page.value === 1 ? (searchData.value?.hasMore ?? false) : additionalHasMore.value
})

const displayedResults = computed(() => {
  return [...allResults.value]
})

const searched = computed(() => searchData.value !== undefined)
const installedIds = computed(() => new Set((catalog.value ?? []).map((entry) => entry.id)))
const installedById = computed(
  () => new Map((catalog.value ?? []).map((entry) => [entry.id, entry]))
)
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

function getCatalogSourceKey(entry: ExtensionInstalledPackageInfo): string | null {
  if (!entry.installationSource || entry.installationSource.kind !== 'repository') {
    return null
  }

  return `${entry.installationSource.repositoryId}:${entry.installationSource.releaseId}`
}

function isInstalled(extension: ExtensionCatalogPackageInfo): boolean {
  return (
    installedIds.value.has(extension.id) ||
    extension.releases.some((release) =>
      installedSourceKeys.value.has(`${release.repositoryId}:${release.releaseDigest}`)
    )
  )
}

function getInstalledPackage(
  extension: ExtensionCatalogPackageInfo
): ExtensionInstalledPackageInfo | null {
  return installedById.value.get(extension.id) ?? null
}

function openReleaseDialog(request: ExtensionCreateRepositoryReleasePlanRequest) {
  releaseRequest.value = request
  releaseDialogOpen.value = true
}

function openDetails(extension: ExtensionCatalogPackageInfo) {
  detailsPackage.value = extension
  detailsOpen.value = true
}

async function handleReleaseApplied() {
  await Promise.all([refetchCatalog(), refetchSearch()])
}

watch(detailsOpen, (open) => {
  if (!open) {
    detailsPackage.value = null
  }
})
</script>

<template>
  <div class="flex flex-col h-full">
    <ExtensionDiscoverPanelFilterBar />

    <div class="flex-1 overflow-auto">
      <StateView
        v-if="loading && displayedResults.length === 0"
        state="loading"
        class="h-48"
      />

      <template v-else-if="displayedResults.length === 0 && searched">
        <StateView
          state="empty"
          icon="icon-[mdi--puzzle-outline]"
          :title="m.extension.discover.emptyTitle"
          :description="
            store.selectedCategory
              ? m.extension.discover.emptyCategoryDescription
              : m.extension.discover.emptyDescription
          "
          class="h-48"
        />

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
            {{ m.extension.discover.loadMore }}
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
            @apply-release="openReleaseDialog"
            @details="openDetails"
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
            {{ m.extension.discover.loadMore }}
          </Button>
        </div>
      </template>
    </div>

    <ExtensionDiscoverPanelDetailsDialog
      v-if="detailsPackage"
      v-model:open="detailsOpen"
      :extension="detailsPackage"
      :installed-package="getInstalledPackage(detailsPackage)"
      @apply-release="openReleaseDialog"
    />

    <ExtensionReleaseDialog
      v-if="releaseDialogOpen"
      v-model:open="releaseDialogOpen"
      :request="releaseRequest"
      @applied="handleReleaseApplied"
    />
  </div>
</template>
