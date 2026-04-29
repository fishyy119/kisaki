import type {
  DeeplinkContributionRegistration,
  EntityMenuItem,
  EntityMenuResolveInput,
  EntityMenuTarget,
  GameScraperProviderRegistration,
  PersonScraperProviderRegistration,
  CompanyScraperProviderRegistration,
  CharacterScraperProviderRegistration,
  SerializableValue,
  SettingsDialogTarget,
  SettingsInteractionResult,
  SettingsResolvedScreenModel,
  ThemeContribution,
  UiCallbackResult
} from '@kisaki/extension-api'
import type { ExtensionCategory } from '@kisaki/extension-api'

export type InstalledExtensionStatus = 'ready' | 'invalid' | 'missing-package' | 'orphaned'

export type InstalledExtensionRuntimeStatus = 'running' | 'failed' | 'stopped'

export interface ExtensionSourceReference {
  provider: string
  locator: string
}

export interface ExtensionCatalogInfo {
  builtin: boolean
  id: string
  name: string
  version: string | null
  description?: string
  author?: string
  homepage?: string
  iconUrl?: string
  categories: readonly ExtensionCategory[]
  enabled: boolean
  status: InstalledExtensionStatus
  runtimeStatus: InstalledExtensionRuntimeStatus
  runtimeError: string | null
  source: ExtensionSourceReference | null
  directory: string
  issues: readonly string[]
}

export interface ExtensionRegistryEntry {
  id: string
  name: string
  version: string | null
  description?: string
  author?: string
  homepage?: string
  categories?: readonly ExtensionCategory[]
  provider: string
  locator: string
  iconUrl?: string
  stars?: number
  updatedAt?: string
}

export interface ExtensionUpdateInfo {
  extensionId: string
  currentVersion: string
  latestVersion: string
  source: ExtensionSourceReference | null
}

export interface ExtensionContributionOwnerInfo {
  extensionId: string
  extensionName: string
  extensionVersion: string
}

export interface ExtensionEntityMenuContributionInfo extends ExtensionContributionOwnerInfo {
  contributionId: string
  target: EntityMenuTarget
  order: number
}

export interface ExtensionSettingsContributionInfo extends ExtensionContributionOwnerInfo {
  contributionId: string
  title: string
  description?: string
  order: number
  rootScreenId: string
}

export interface ExtensionThemeContributionInfo extends ExtensionContributionOwnerInfo {
  theme: ThemeContribution
}

export interface ExtensionDeeplinkContributionInfo extends ExtensionContributionOwnerInfo {
  contribution: DeeplinkContributionRegistration
}

export interface ExtensionScraperProviderInfo extends ExtensionContributionOwnerInfo {
  mediaType: 'game' | 'person' | 'company' | 'character'
  provider:
    | GameScraperProviderRegistration
    | PersonScraperProviderRegistration
    | CompanyScraperProviderRegistration
    | CharacterScraperProviderRegistration
}

export interface ExtensionContributionSnapshot {
  entityMenus: readonly ExtensionEntityMenuContributionInfo[]
  settings: readonly ExtensionSettingsContributionInfo[]
  themes: readonly ExtensionThemeContributionInfo[]
  deeplinks: readonly ExtensionDeeplinkContributionInfo[]
  scrapers: readonly ExtensionScraperProviderInfo[]
}

export interface ExtensionContributionError {
  extensionId: string
  contributionId: string
  message: string
  code?: string
}

export interface ExtensionResolvedEntityMenuGroup extends ExtensionEntityMenuContributionInfo {
  items: readonly EntityMenuItem[]
}

export interface ExtensionResolvedEntityMenu {
  sessionId: string
  target: EntityMenuResolveInput['target']
  groups: readonly ExtensionResolvedEntityMenuGroup[]
  errors: readonly ExtensionContributionError[]
}

export interface ExtensionEntityMenuInvokeRequest {
  sessionId: string
  extensionId: string
  contributionId: string
  callbackId: string
  input: EntityMenuResolveInput
  value?: boolean | string
}

export interface ExtensionEntityMenuInvokeResult {
  result: UiCallbackResult
  refreshed?: ExtensionResolvedEntityMenu
}

export interface ExtensionResolvedSettingsFrame {
  sessionId: string
  extensionId: string
  contributionId: string
  frameId: string
  screenId: string
  params: Record<string, SerializableValue>
  screen: SettingsResolvedScreenModel
}

export interface ExtensionSettingsSession {
  sessionId: string
  extensionId: string
  contributionId: string
  frame: ExtensionResolvedSettingsFrame
}

export interface ExtensionSettingsFrameOpenRequest {
  sessionId: string
  extensionId: string
  contributionId: string
  target: SettingsDialogTarget
}

export interface ExtensionSettingsFrameRefreshRequest {
  sessionId: string
  extensionId: string
  contributionId: string
  frameId: string
}

export interface ExtensionSettingsSubmitRequest {
  sessionId: string
  extensionId: string
  contributionId: string
  frameId: string
  values: Record<string, SerializableValue>
}

export interface ExtensionSettingsInvokeRequest {
  sessionId: string
  extensionId: string
  contributionId: string
  frameId: string
  callbackId: string
  value?: SerializableValue
}

export interface ExtensionSettingsFrameReleaseRequest {
  sessionId: string
  extensionId: string
  contributionId: string
  frameId: string
}

export interface ExtensionSettingsInteractionResponse {
  result: SettingsInteractionResult
  refreshedFrames: readonly ExtensionResolvedSettingsFrame[]
}
