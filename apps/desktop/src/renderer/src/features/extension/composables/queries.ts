/**
 * Extension queries
 *
 * The extension manager's route queries are local IPC reads and load before
 * their page renders. The catalog search is a remote query: it is not route
 * data, the discover panel runs it as a live query and shows its loading
 * state in place.
 */

import type { ExtensionCategory } from '@kisaki3/extension-api'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { refreshExtensionContributionSnapshot } from '@renderer/core/extensions'
import { defineRouteQuery } from '@renderer/core/query'
import type { ExtensionCatalogPackageInfo } from '@shared/extension'
import type { SortDirection } from '@shared/filter'
import type { DiscoverExtensionSortField } from '../stores'

export const DISCOVER_PAGE_SIZE = 20

export interface DiscoverSearchPage {
  results: ExtensionCatalogPackageInfo[]
  hasMore: boolean
}

/** The discover filters one search runs with: a snapshot of the discover store. */
export interface DiscoverSearchView {
  searchQuery: string
  selectedRepositoryId: string | null
  selectedCategory: ExtensionCategory | null
  compatibleOnly: boolean
  sortField: DiscoverExtensionSortField
  sortDirection: SortDirection
}

/** Search one page of the repository-backed catalog with the given filters. */
export async function searchExtensionPage(
  view: DiscoverSearchView,
  page: number
): Promise<DiscoverSearchPage> {
  const data = unwrapIpcData(
    await ipcManager.invoke('extension:search-catalog', {
      query: view.searchQuery,
      page,
      limit: DISCOVER_PAGE_SIZE,
      category: view.selectedCategory ?? undefined,
      repositoryId: view.selectedRepositoryId ?? undefined,
      compatibleOnly: view.compatibleOnly,
      sortBy: view.sortField,
      sortDirection: view.sortDirection
    })
  )

  return { results: [...data.packages], hasMore: data.hasMore }
}

/** Installed extension catalog, shared by the discover and installed pages. */
export const installedExtensionsQuery = defineRouteQuery({
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
export const extensionRepositoriesQuery = defineRouteQuery({
  name: 'extension-repositories',
  key: () => 'extension-repositories',
  fetch: async () => unwrapIpcData(await ipcManager.invoke('extension:list-repositories')),
  invalidate: { ipc: ['extension:repositories-changed'] }
})

export const extensionSignersQuery = defineRouteQuery({
  name: 'extension-signers',
  key: () => 'extension-signers',
  fetch: async () => unwrapIpcData(await ipcManager.invoke('extension:list-trusted-signers')),
  invalidate: { ipc: ['extension:trusted-signers-changed'] }
})
