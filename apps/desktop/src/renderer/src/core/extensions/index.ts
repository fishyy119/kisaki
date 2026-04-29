export {
  checkExtensionUpdates,
  disableExtension,
  enableExtension,
  getExtensionCatalog,
  getExtensionContributionSnapshot,
  getExtensionSettingsContributions,
  getExtensionSources,
  getExtensionThemeContributions,
  installExtension,
  installExtensionFromFile,
  invokeExtensionEntityMenu,
  invokeExtensionSettingsNode,
  openExtensionSettingsFrame,
  openExtensionSettingsSession,
  releaseExtensionEntityMenuSession,
  refreshExtensionSettingsFrame,
  releaseExtensionSettingsFrame,
  releaseExtensionSettingsSession,
  resolveExtensionEntityMenu,
  searchExtensions,
  submitExtensionSettingsFrame,
  uninstallExtension,
  updateExtension
} from './ipc'
export { getEntityMenuInputKey } from './menus'
export {
  extensionContributionStore,
  getExtensionSettingsFor,
  refreshExtensionContributionSnapshot,
  setupExtensionContributionStore
} from './store'
export { createSettingsDraft, getSettingsNodeCallbackId, type SettingsDraft } from './settings'
export { refreshExtensionThemes, setupExtensionThemeSync, syncExtensionThemes } from './themes'
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
  ExtensionSearchOptions,
  ExtensionSearchResult,
  ExtensionSettingsContributionInfo,
  ExtensionSettingsFrameOpenRequest,
  ExtensionSettingsFrameRefreshRequest,
  ExtensionSettingsFrameReleaseRequest,
  ExtensionSettingsInteractionResponse,
  ExtensionSettingsInvokeRequest,
  ExtensionSettingsSession,
  ExtensionSettingsSubmitRequest,
  ExtensionSourceInfo,
  ExtensionThemeContributionInfo,
  ExtensionUpdateInfo
} from './types'
