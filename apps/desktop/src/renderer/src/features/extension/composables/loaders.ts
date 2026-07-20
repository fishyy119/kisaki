/**
 * Extension route data loaders
 *
 * Navigation-time loaders for the extension pages. Panels consume the loader
 * stores directly and keep their own IPC event wiring for refetches.
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

/** First result page for the discover panel; further pages load in-panel. */
export const discoverSearchData = defineRouteData(() => searchExtensionPage(1))

/** Installed extension catalog, shared by the discover and installed pages. */
export const installedExtensionsData = defineRouteData(async () => {
  const [catalog] = await Promise.all([
    ipcManager.invoke('extension:get-installed-packages').then(unwrapIpcData),
    refreshExtensionContributionSnapshot()
  ])
  return catalog
})

export const extensionRepositoriesData = defineRouteData(async () => {
  return unwrapIpcData(await ipcManager.invoke('extension:list-repositories'))
})

export const extensionSignersData = defineRouteData(async () => {
  return unwrapIpcData(await ipcManager.invoke('extension:list-trusted-signers'))
})
