import type {
  ExtensionCatalogInfo,
  ExtensionContributionSnapshot,
  ExtensionEntityMenuContributionInfo,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResult,
  ExtensionRegistryEntry,
  ExtensionResolvedEntityMenu,
  ExtensionResolvedEntityMenuGroup,
  ExtensionResolvedSettingsFrame,
  ExtensionSettingsContributionInfo,
  ExtensionSettingsFrameOpenRequest,
  ExtensionSettingsFrameRefreshRequest,
  ExtensionSettingsFrameReleaseRequest,
  ExtensionSettingsInteractionResponse,
  ExtensionSettingsInvokeRequest,
  ExtensionSettingsSession,
  ExtensionSettingsSubmitRequest,
  ExtensionThemeContributionInfo,
  ExtensionUpdateInfo
} from '@shared/extension'

export type {
  ExtensionCatalogInfo,
  ExtensionContributionSnapshot,
  ExtensionEntityMenuContributionInfo,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResult,
  ExtensionRegistryEntry,
  ExtensionResolvedEntityMenu,
  ExtensionResolvedEntityMenuGroup,
  ExtensionResolvedSettingsFrame,
  ExtensionSettingsContributionInfo,
  ExtensionSettingsFrameOpenRequest,
  ExtensionSettingsFrameRefreshRequest,
  ExtensionSettingsFrameReleaseRequest,
  ExtensionSettingsInteractionResponse,
  ExtensionSettingsInvokeRequest,
  ExtensionSettingsSession,
  ExtensionSettingsSubmitRequest,
  ExtensionThemeContributionInfo,
  ExtensionUpdateInfo
}

export interface ExtensionSourceInfo {
  name: string
  displayName: string
  searchable: boolean
}

export interface ExtensionSearchOptions {
  page?: number
  limit?: number
  sortBy?: 'stars' | 'updated' | 'name'
  sortDirection?: 'asc' | 'desc'
}

export interface ExtensionSearchResult {
  entries: ExtensionRegistryEntry[]
  total: number
  hasMore: boolean
}
