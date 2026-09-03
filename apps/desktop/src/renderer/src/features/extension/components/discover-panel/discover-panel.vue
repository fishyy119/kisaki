<!--
Extension Browse Panel renders extension catalog results.
Boundary: reads store filters and queries the repository-backed catalog.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Spinner } from '@renderer/components/ui/spinner'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables/use-i18n'
import { useLiveQuery } from '@renderer/composables/use-live-query'
import ExtensionReleaseDialog from '../extension-release-dialog.vue'
import ExtensionDiscoverPanelCard from './discover-panel-card.vue'
import ExtensionDiscoverPanelDetailsDialog from './discover-panel-details-dialog.vue'
import ExtensionDiscoverPanelFilterBar from './discover-panel-filter-bar.vue'
import { useDiscoverExtensionStore } from '../../stores'
import {
  installedExtensionsQuery,
  searchExtensionPage,
  type DiscoverSearchView
} from '../../composables'
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

// The filters one search runs with; a snapshot, so the fetch is pure over it.
const searchView = computed<DiscoverSearchView>(() => ({
  searchQuery: store.searchQuery,
  selectedRepositoryId: store.selectedRepositoryId,
  selectedCategory: store.selectedCategory,
  compatibleOnly: store.compatibleOnly,
  sortField: store.sortField,
  sortDirection: store.sortDirection
}))

// The first page is a remote search, not route data: it loads in the panel,
// reruns on every filter change and on catalog changes, and shows its own
// loading and error states. The installed catalog is the route query shared
// with the installed page.
const {
  data: searchData,
  error,
  isFetching
} = useLiveQuery(() => searchExtensionPage(searchView.value, 1), {
  watch: [searchView],
  invalidate: { ipc: ['extension:catalog-changed'] }
})
const { data: catalog } = installedExtensionsQuery()

// Pages beyond the first accumulate here and belong to the first page they
// extend: whenever page 1 is replaced (a filter change, a catalog change),
// they are gone with it.
watch(searchData, () => {
  page.value = 1
  additionalResults.value = []
  additionalHasMore.value = false
})

const results = computed(() => [...(searchData.value?.results ?? []), ...additionalResults.value])

const hasMore = computed(() =>
  page.value === 1 ? (searchData.value?.hasMore ?? false) : additionalHasMore.value
)

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
    const data = await searchExtensionPage(searchView.value, nextPage)

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

watch(detailsOpen, (open) => {
  if (!open) {
    detailsPackage.value = null
  }
})
</script>

<template>
  <div class="flex flex-col h-full">
    <ExtensionDiscoverPanelFilterBar />

    <ScrollRegion>
      <StateView
        v-if="loading && results.length === 0"
        state="loading"
        class="h-48"
      />

      <StateView
        v-else-if="error && results.length === 0"
        state="error"
        :error="error"
        class="h-48"
      />

      <template v-else-if="results.length === 0 && searched">
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
            v-for="extension in results"
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
    </ScrollRegion>

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
    />
  </div>
</template>
