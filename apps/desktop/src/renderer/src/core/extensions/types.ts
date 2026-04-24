import type {
  ExtensionCatalogInfo,
  ExtensionContributionSnapshot,
  ExtensionEntityMenuContributionInfo,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResult,
  ExtensionRegistryEntry,
  ExtensionResolvedEntityMenu,
  ExtensionResolvedEntityMenuGroup,
  ExtensionResolvedSettingsPanel,
  ExtensionSettingsPanelCallbackResult,
  ExtensionSettingsPanelInfo,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelSubmitRequest,
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
  ExtensionResolvedSettingsPanel,
  ExtensionSettingsPanelCallbackResult,
  ExtensionSettingsPanelInfo,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelSubmitRequest,
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
}

export interface ExtensionSearchResult {
  entries: ExtensionRegistryEntry[]
  total: number
  hasMore: boolean
}
