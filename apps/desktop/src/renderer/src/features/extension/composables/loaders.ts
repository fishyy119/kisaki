/**
 * Extension route data
 *
 * Resources of the extension manager pages. Everything but the catalog
 * search is local IPC and blocks navigation; the search is a remote query and
 * is the one non-blocking resource in the app, so the Discover page opens
 * instantly and shows the search loading in its panel.
 */

import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { refreshExtensionContributionSnapshot } from '@renderer/core/extensions'
import { defineRouteData } from '@renderer/core/route-data'
import { useDiscoverExtensionStore } from '../stores'
import type { ExtensionCatalogPackageInfo } from '@shared/extension'

export const DISCOVER_PAGE_SIZE = 20

export interface DiscoverSearchPage {
  results: ExtensionCatalogPackageInfo[]
  hasMore: boolean
}

/** Search one page of the repository-backed catalog with current store filters. */
export async function searchExtensionPage(page: number): Promise<DiscoverSearchPage> {
  const store = useDiscoverExtensionStore()
  const data = unwrapIpcData(
    await ipcManager.invoke('extension:search-catalog', {
      query: store.searchQuery,
      page,
      limit: DISCOVER_PAGE_SIZE,
      category: store.selectedCategory ?? undefined,
      repositoryId: store.selectedRepositoryId ?? undefined,
      compatibleOnly: store.compatibleOnly,
      sortBy: store.sortField,
      sortDirection: store.sortDirection
    })
  )

  return { results: [...data.packages], hasMore: data.hasMore }
}

/**
 * First result page for the discover panel; further pages load in-panel. The
 * persisted discover store is the resource's view: a filter change reloads.
 */
export const discoverSearchData = defineRouteData({
  name: 'extension-discover',
  key: () => 'extension-discover',
  view: () => {
    const store = useDiscoverExtensionStore()
    return {
      searchQuery: store.searchQuery,
      selectedRepositoryId: store.selectedRepositoryId,
      selectedCategory: store.selectedCategory,
      compatibleOnly: store.compatibleOnly,
      sortField: store.sortField,
      sortDirection: store.sortDirection
    }
  },
  fetch: () => searchExtensionPage(1),
  invalidate: { ipc: ['extension:catalog-changed'] },
  blocking: false
})

/** Installed extension catalog, shared by the discover and installed pages. */
export const installedExtensionsData = defineRouteData({
  name: 'extension-installed',
  key: () => 'extension-installed',
  fetch: async () => {
    const [catalog] = await Promise.all([
      ipcManager.invoke('extension:get-installed-packages').then(unwrapIpcData),
      refreshExtensionContributionSnapshot()
    ])
    return catalog
  },
  invalidate: { ipc: ['extension:installations-changed', 'extension:runtime-state-changed'] }
})

/** Configured repositories, shared by the repositories page and the discover filter bar. */
export const extensionRepositoriesData = defineRouteData({
  name: 'extension-repositories',
  key: () => 'extension-repositories',
  fetch: async () => unwrapIpcData(await ipcManager.invoke('extension:list-repositories')),
  invalidate: { ipc: ['extension:repositories-changed'] }
})

export const extensionSignersData = defineRouteData({
  name: 'extension-signers',
  key: () => 'extension-signers',
  fetch: async () => unwrapIpcData(await ipcManager.invoke('extension:list-trusted-signers')),
  invalidate: { ipc: ['extension:trusted-signers-changed'] }
})
