import type {
  CharacterScraperProviderRegistrationInfo,
  CompanyScraperProviderRegistrationInfo,
  DeeplinkRouteRegistrationInfo,
  EntityMenuActionNode,
  EntityMenuCheckboxNode,
  EntityMenuDomain,
  EntityMenuInput,
  EntityMenuRefreshReason,
  EntityMenuScope,
  EntityMenuSelectNode,
  EntityMenuSeparatorNode,
  EntityMenuSubmenuNode,
  ExtensionCategory,
  ExtensionRuntimeDiagnostic,
  GameScraperProviderRegistrationInfo,
  PersonScraperProviderRegistrationInfo,
  JsonObject,
  JsonSafe,
  JsonValue,
  LocalizedText,
  ThemeContribution,
  UiCallbackResult,
  WebviewDialogSize
} from '@kisaki3/extension-api'
import type {
  ExtensionRegistryArtifactTarget,
  ExtensionRegistryReleaseChangelog,
  ExtensionRegistryReleaseKind,
  ExtensionRegistryReleaseEngines,
  ExtensionRegistrySigningAlgorithm
} from '@kisaki3/extension-registry'
import type { ExtensionInstallationSource } from './installation-source'

export type InstalledExtensionStatus = 'ready' | 'invalid' | 'missing-package'

export type InstalledExtensionRuntimeStatus = 'loading' | 'running' | 'failed' | 'stopped'

export interface ExtensionInstalledRuntimeInfo {
  runtimeStatus: InstalledExtensionRuntimeStatus
  runtimeError: string | null
  runtimeDiagnostics: readonly ExtensionRuntimeDiagnostic[]
}

export interface ExtensionInstalledPackageInfo extends ExtensionInstalledRuntimeInfo {
  builtin: boolean
  id: string
  /** Localized display name; renderer resolves it against the current UI locale. */
  name: LocalizedText
  version: string | null
  /** Localized description; renderer resolves it against the current UI locale. */
  description?: LocalizedText
  author?: string
  homepage?: string
  iconUrl?: string
  categories: readonly ExtensionCategory[]
  enabled: boolean
  status: InstalledExtensionStatus
  installationSource: ExtensionInstallationSource | null
  updatePolicy?: ExtensionInstallUpdatePolicy
  pinnedVersion?: string | null
  includePreviewUpdates?: boolean | null
  installedAt?: string | null
  directory: string
  issues: readonly string[]
}

export interface ExtensionRuntimeStateChangedEvent extends ExtensionInstalledRuntimeInfo {
  extensionId: string
}

/**
 * Development extensions whose on-disk code is newer than what the extension
 * host is currently running. The renderer surfaces these as a pending reload.
 * Pushed on every change and pullable as a snapshot on renderer startup.
 */
export interface ExtensionDevelopmentStaleState {
  extensionIds: readonly string[]
}

export interface ExtensionUpdateInfo {
  extensionId: string
  currentVersion: string
  latestVersion: string
  releasePlan: ExtensionReleasePlan
  updatePolicy?: ExtensionInstallUpdatePolicy
  includePreviewUpdates?: boolean
  automaticEligible?: boolean
}

export type ExtensionUpdateUnavailableReason =
  | 'auto-policy-disabled'
  | 'invalid-current-version'
  | 'local-file-source'
  | 'no-compatible-release'
  | 'no-newer-release'
  | 'pinned-policy'
  | 'repository-source-missing'
  | 'requires-manual-confirmation'
  | 'preview-updates-disabled'

export interface ExtensionUpdateUnavailableInfo {
  extensionId: string
  currentVersion: string | null
  updatePolicy?: ExtensionInstallUpdatePolicy | null
  includePreviewUpdates?: boolean | null
  reason: ExtensionUpdateUnavailableReason
  message: string
}

export interface ExtensionUpdateCheckResult {
  updates: readonly ExtensionUpdateInfo[]
  unavailable: readonly ExtensionUpdateUnavailableInfo[]
}

export type ExtensionRepositoryState = 'enabled' | 'disabled'

export interface ExtensionRepositoryInfo {
  id: string
  url: string
  name: string
  state: ExtensionRepositoryState
  priority: number
  packageCount: number
  manifestDigest: string | null
  manifestUpdatedAt: string | null
  lastRefreshAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
  etag: string | null
  lastModified: string | null
  createdAt: string
  updatedAt: string
}

export interface ExtensionRepositoryCreateRequest {
  url: string
  name?: string
  state?: ExtensionRepositoryState
  priority?: number
}

export interface ExtensionRepositoryUpdateRequest {
  id: string
  url?: string
  name?: string
  state?: ExtensionRepositoryState
  priority?: number
}

export type ExtensionRepositoryRefreshStatus = 'success' | 'not-modified' | 'failed'

export interface ExtensionRepositoryRefreshResult {
  repository: ExtensionRepositoryInfo
  status: ExtensionRepositoryRefreshStatus
  changed: boolean
  error: string | null
}

export interface ExtensionTrustedSignerInfo {
  id: string
  extensionId: string
  fingerprint: string
  algorithm: ExtensionRegistrySigningAlgorithm
  publicKey: string
  label: string | null
  trustedFromRepositoryId: string | null
  trustedFromRepositoryUrl: string | null
  trustedAt: string
  createdAt: string
  updatedAt: string
}

export interface ExtensionCatalogSearchRequest {
  query?: string
  category?: ExtensionCategory
  repositoryId?: string
  compatibleOnly?: boolean
  installedOnly?: boolean
  hasUpdateOnly?: boolean
  sortBy?: 'relevance' | 'name' | 'updatedAt' | 'publishedAt' | 'repositoryPriority'
  sortDirection?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface ExtensionCatalogSearchResult {
  packages: readonly ExtensionCatalogPackageInfo[]
  total: number
  hasMore: boolean
}

export interface ExtensionCatalogPackageInfo {
  id: string
  /** Localized display name; renderer resolves it against the current UI locale. */
  name: LocalizedText
  /** Localized summary; renderer resolves it against the current UI locale. */
  summary: LocalizedText
  /** Localized description; renderer resolves it against the current UI locale. */
  description?: LocalizedText
  categories: readonly ExtensionCategory[]
  keywords: readonly string[]
  owner?: {
    name: string
    url?: string
  }
  homepage?: string
  repository?: string
  license?: string
  iconUrl?: string
  repositoryCount: number
  latestRelease: ExtensionCatalogReleaseInfo | null
  releases: readonly ExtensionCatalogReleaseInfo[]
  sources: readonly ExtensionCatalogRepositorySourceInfo[]
  updatedAt: string | null
}

export interface ExtensionCatalogRepositorySourceInfo {
  repositoryId: string
  repositoryName: string
  repositoryUrl: string
  repositoryPriority: number
  manifestDigest: string | null
}

export interface ExtensionCatalogReleaseInfo {
  id: string
  releaseDigest: string
  version: string
  releaseKind: ExtensionRegistryReleaseKind
  publishedAt: string
  engines: ExtensionRegistryReleaseEngines
  changelog?: ExtensionRegistryReleaseChangelog
  yanked: boolean
  compatible: boolean
  repositoryCount: number
  repositoryId: string
  repositoryName: string
  repositoryUrl: string
  repositoryPriority: number
  manifestDigest: string | null
  sources: readonly ExtensionCatalogRepositorySourceInfo[]
  artifact: ExtensionCatalogArtifactInfo | null
  artifacts: readonly ExtensionCatalogArtifactInfo[]
}

export interface ExtensionCatalogArtifactInfo {
  target: ExtensionRegistryArtifactTarget
  url: string
  size: number
  sha256: string
  signature: ExtensionCatalogArtifactSignatureInfo | null
}

export interface ExtensionCatalogArtifactSignatureInfo {
  keyId: string
  algorithm: ExtensionRegistrySigningAlgorithm
  fingerprint: string
}

export type ExtensionInstallUpdatePolicy = 'manual' | 'auto' | 'pinned'

export interface ExtensionUpdatePolicyRequest {
  extensionId: string
  updatePolicy: ExtensionInstallUpdatePolicy
  pinnedVersion?: string | null
  includePreviewUpdates?: boolean
}

export type ExtensionAutomaticUpdateRunStatus = 'idle' | 'running' | 'completed'

export type ExtensionAutomaticUpdateResultStatus = 'updated' | 'failed'

export interface ExtensionAutomaticUpdateResult {
  extensionId: string
  status: ExtensionAutomaticUpdateResultStatus
  currentVersion: string
  targetVersion: string
  error?: string
}

export interface ExtensionAutomaticUpdateRunState {
  status: ExtensionAutomaticUpdateRunStatus
  trigger: 'startup'
  startedAt: string | null
  finishedAt: string | null
  results: readonly ExtensionAutomaticUpdateResult[]
  repositoryRefreshError?: string
}

export type ExtensionCreateReleasePlanRequest =
  ExtensionCreateRepositoryReleasePlanRequest | ExtensionCreateLocalReleasePlanRequest

export interface ExtensionCreateRepositoryReleasePlanRequest {
  sourceKind: 'repository'
  extensionId: string
  releaseId?: string
  repositoryId?: string
}

export interface ExtensionCreateLocalReleasePlanRequest {
  sourceKind: 'local-file'
  filePath: string
}

export interface ExtensionReleasePlanConfirmation {
  planId: string
  planFingerprint: string
}

export type ExtensionApplyReleaseRequest =
  ExtensionApplyRepositoryReleaseRequest | ExtensionApplyLocalReleaseRequest

export interface ExtensionApplyRepositoryReleaseRequest
  extends ExtensionCreateRepositoryReleasePlanRequest, ExtensionReleasePlanConfirmation {
  trustSignerFingerprint?: boolean
  enabled?: boolean
  updatePolicy?: ExtensionInstallUpdatePolicy
}

export interface ExtensionApplyLocalReleaseRequest extends ExtensionReleasePlanConfirmation {
  sourceKind: 'local-file'
  filePath: string
  enabled?: boolean
}

export interface ExtensionPurgeDataRequest {
  extensionId: string
  force?: boolean
}

export type ExtensionReleaseSourceKind = 'repository' | 'local-file'

export type ExtensionReleaseAction = 'install' | 'update' | 'reinstall' | 'downgrade'

export type ExtensionReleaseRiskCode =
  | 'downgrade'
  | 'same-version'
  | 'preview-release'
  | 'preview-updates-change'
  | 'yanked-release'
  | 'unsigned-release'
  | 'signer-untrusted'
  | 'signer-changed'
  | 'local-unsigned'

export type ExtensionReleaseRiskSeverity = 'info' | 'warning' | 'danger'

export interface ExtensionReleaseRiskInfo {
  id: string
  code: ExtensionReleaseRiskCode
  severity: ExtensionReleaseRiskSeverity
  message: string
}

export type ExtensionReleaseSignerTrustStatus = 'trusted' | 'untrusted' | 'changed' | 'unsigned'

export interface ExtensionReleasePlanSignerInfo {
  status: ExtensionReleaseSignerTrustStatus
  keyId?: string
  algorithm?: ExtensionRegistrySigningAlgorithm
  fingerprint?: string
  trusted: boolean
}

export interface ExtensionReleasePlanRepositoryInfo {
  id: string
  name: string
  url: string
  manifestDigest: string | null
}

export interface ExtensionReleasePlanPackageInfo {
  id: string
  /** Localized display name; renderer resolves it against the current UI locale. */
  name: LocalizedText
  /** Localized summary; renderer resolves it against the current UI locale. */
  summary?: LocalizedText
  currentVersion: string | null
  targetVersion: string
  releaseKind: ExtensionRegistryReleaseKind
}

export interface ExtensionReleasePlan {
  id: string
  fingerprint: string
  action: ExtensionReleaseAction
  sourceKind: ExtensionReleaseSourceKind
  package: ExtensionReleasePlanPackageInfo
  repository: ExtensionReleasePlanRepositoryInfo | null
  release: ExtensionCatalogReleaseInfo | null
  artifact: ExtensionCatalogArtifactInfo | null
  localFile: ExtensionReleasePlanLocalFileInfo | null
  signer: ExtensionReleasePlanSignerInfo
  risks: readonly ExtensionReleaseRiskInfo[]
  defaultEnabled: boolean
  updatePolicy: ExtensionInstallUpdatePolicy
  includePreviewUpdates: boolean
}

export interface ExtensionReleasePlanLocalFileInfo {
  path: string
  size: number
  sha256: string
}

export interface ExtensionContributionOwnerInfo {
  extensionId: string
  extensionName: string
  extensionVersion: string
}

/**
 * Contribution icon resolved by main into a renderer-consumable form. `mdi`
 * names the bundled Material Design Icon; `url` is an app-local URL for an
 * extension package icon file. The renderer renders both as a currentColor
 * mask.
 */
export type ExtensionIconInfo = { kind: 'mdi'; name: string } | { kind: 'url'; url: string }

export type ExtensionEntityMenuRegistrationScopeInfo = {
  [TDomain in EntityMenuDomain]: {
    [TScope in EntityMenuScope<TDomain>]: {
      contributionId: string
      domain: TDomain
      scope: TScope
    }
  }[EntityMenuScope<TDomain>]
}[EntityMenuDomain]

export type ExtensionEntityMenuRegistrationInfo = ExtensionContributionOwnerInfo &
  ExtensionEntityMenuRegistrationScopeInfo & {
    order: number
  }

export interface ExtensionCardActionRegistrationInfo extends ExtensionContributionOwnerInfo {
  contributionId: string
  label: string
  description?: string
  order: number
}

export interface ExtensionThemeRegistrationInfo extends ExtensionContributionOwnerInfo {
  theme: ThemeContribution
}

export interface ExtensionDeeplinkRouteRegistrationInfo extends ExtensionContributionOwnerInfo {
  contribution: DeeplinkRouteRegistrationInfo
}

export interface ExtensionScraperProviderRegistrationInfo extends ExtensionContributionOwnerInfo {
  mediaType: 'game' | 'person' | 'company' | 'character'
  provider:
    | GameScraperProviderRegistrationInfo
    | PersonScraperProviderRegistrationInfo
    | CompanyScraperProviderRegistrationInfo
    | CharacterScraperProviderRegistrationInfo
}

/**
 * One declared webview page as projected to the renderer. Pages with `nav`
 * appear in the top-level sidebar; the renderer resolves `title` against the
 * UI locale and renders `icon` through the contribution icon component.
 */
export interface ExtensionWebviewPageRegistrationInfo extends ExtensionContributionOwnerInfo {
  pageId: string
  title: LocalizedText
  icon?: ExtensionIconInfo
  nav?: { order: number }
}

export interface ExtensionContributionSnapshot {
  entityMenus: readonly ExtensionEntityMenuRegistrationInfo[]
  cardActions: readonly ExtensionCardActionRegistrationInfo[]
  scraperProviders: readonly ExtensionScraperProviderRegistrationInfo[]
  deeplinkRoutes: readonly ExtensionDeeplinkRouteRegistrationInfo[]
  themes: readonly ExtensionThemeRegistrationInfo[]
  webviewPages: readonly ExtensionWebviewPageRegistrationInfo[]
}

export interface ExtensionContributionError {
  extensionId: string
  contributionId: string
  message: string
  code?: string
}

export type ExtensionResolvedEntityMenuActionNode = Omit<
  EntityMenuActionNode,
  'onClick' | 'icon'
> & {
  icon?: ExtensionIconInfo
}

export type ExtensionResolvedEntityMenuCheckboxNode = Omit<
  EntityMenuCheckboxNode,
  'onChange' | 'icon'
> & {
  icon?: ExtensionIconInfo
}

export type ExtensionResolvedEntityMenuSelectNode = Omit<
  EntityMenuSelectNode,
  'onChange' | 'icon'
> & {
  icon?: ExtensionIconInfo
}

export type ExtensionResolvedEntityMenuSubmenuNode = Omit<
  EntityMenuSubmenuNode,
  'children' | 'icon'
> & {
  icon?: ExtensionIconInfo
  children: readonly ExtensionResolvedEntityMenuNode[]
}

export type ExtensionResolvedEntityMenuSeparatorNode = Omit<EntityMenuSeparatorNode, 'id'> & {
  id: string
}

export type ExtensionResolvedEntityMenuNode =
  | ExtensionResolvedEntityMenuActionNode
  | ExtensionResolvedEntityMenuCheckboxNode
  | ExtensionResolvedEntityMenuSelectNode
  | ExtensionResolvedEntityMenuSubmenuNode
  | ExtensionResolvedEntityMenuSeparatorNode

export type ExtensionResolvedEntityMenuGroup = ExtensionEntityMenuRegistrationInfo & {
  nodes: readonly ExtensionResolvedEntityMenuNode[]
}

export interface ExtensionResolvedEntityMenu {
  sessionId: string
  input: EntityMenuInput
  groups: readonly ExtensionResolvedEntityMenuGroup[]
  errors: readonly ExtensionContributionError[]
}

export interface ExtensionEntityMenuResolveRequest {
  input: EntityMenuInput
}

export interface ExtensionEntityMenuInvokeRequest {
  sessionId: string
  extensionId: string
  contributionId: string
  domain: EntityMenuDomain
  scope: EntityMenuInput['scope']
  nodePath: readonly string[]
  input: EntityMenuInput
  value?: boolean | string
}

export interface ExtensionEntityMenuInvokeResponse {
  result: UiCallbackResult
}

export interface ExtensionEntityMenuReleaseRequest {
  sessionId: string
}

export type ExtensionEntityMenuRefreshRequestedEvent = ExtensionEntityMenuRegistrationScopeInfo & {
  extensionId: string
  reason?: EntityMenuRefreshReason
}

export interface ExtensionCardActionRunRequest {
  extensionId: string
  contributionId: string
}

/**
 * Declared surface a webview session belongs to, resolved from the owning
 * page or dialog contribution.
 */
export type ExtensionWebviewSurfaceInfo =
  { kind: 'page'; pageId: string } | { kind: 'dialog'; dialogId: string; size: WebviewDialogSize }

/**
 * One open webview session as projected to the renderer. `documentUrl` always
 * uses the app-owned extension UI protocol, regardless of whether main serves
 * package files or proxies a development server. The renderer appends the
 * bootstrap query, mounts the iframe, and relays messages through main.
 */
export interface ExtensionWebviewSessionInfo {
  webviewId: string
  extensionId: string
  /**
   * Accessible session title from the owning declaration; never rendered as
   * visible chrome. The renderer resolves it against the current UI locale.
   */
  title: LocalizedText
  surface: ExtensionWebviewSurfaceInfo
  params: JsonObject
  documentUrl: string
  openedAt: number
}

export interface ExtensionWebviewOpenPageRequest {
  extensionId: string
  pageId: string
}

export interface ExtensionWebviewMessageEvent {
  webviewId: string
  message: JsonValue
}

export interface ExtensionWebviewPostMessageRequest {
  webviewId: string
  message: JsonValue
}

export interface ExtensionWebviewReadyRequest {
  webviewId: string
}

export interface ExtensionWebviewCloseRequest {
  webviewId: string
}

type UnsafeDtosOf<TMap> = {
  [K in keyof TMap]: [TMap[K]] extends [JsonSafe<TMap[K]>] ? never : K
}[keyof TMap]

type AssertNever<T extends never> = T

/**
 * Compile-time guarantees that every extension DTO crossing the main↔renderer
 * IPC boundary stays inside the strict JSON value domain. A non-JSON field
 * surfaces here as a type error naming the offending DTO.
 */
export type AssertExtensionDtosAreJsonSafe = AssertNever<
  UnsafeDtosOf<{
    ExtensionInstalledPackageInfo: ExtensionInstalledPackageInfo
    ExtensionRuntimeStateChangedEvent: ExtensionRuntimeStateChangedEvent
    ExtensionDevelopmentStaleState: ExtensionDevelopmentStaleState
    ExtensionUpdateCheckResult: ExtensionUpdateCheckResult
    ExtensionRepositoryInfo: ExtensionRepositoryInfo
    ExtensionRepositoryCreateRequest: ExtensionRepositoryCreateRequest
    ExtensionRepositoryUpdateRequest: ExtensionRepositoryUpdateRequest
    ExtensionRepositoryRefreshResult: ExtensionRepositoryRefreshResult
    ExtensionTrustedSignerInfo: ExtensionTrustedSignerInfo
    ExtensionCatalogSearchRequest: ExtensionCatalogSearchRequest
    ExtensionCatalogSearchResult: ExtensionCatalogSearchResult
    ExtensionAutomaticUpdateRunState: ExtensionAutomaticUpdateRunState
    ExtensionCreateReleasePlanRequest: ExtensionCreateReleasePlanRequest
    ExtensionReleasePlan: ExtensionReleasePlan
    ExtensionApplyReleaseRequest: ExtensionApplyReleaseRequest
    ExtensionPurgeDataRequest: ExtensionPurgeDataRequest
    ExtensionUpdatePolicyRequest: ExtensionUpdatePolicyRequest
    ExtensionContributionSnapshot: ExtensionContributionSnapshot
    ExtensionResolvedEntityMenu: ExtensionResolvedEntityMenu
    ExtensionEntityMenuResolveRequest: ExtensionEntityMenuResolveRequest
    ExtensionEntityMenuInvokeRequest: ExtensionEntityMenuInvokeRequest
    ExtensionEntityMenuInvokeResponse: ExtensionEntityMenuInvokeResponse
    ExtensionEntityMenuReleaseRequest: ExtensionEntityMenuReleaseRequest
    ExtensionEntityMenuRefreshRequestedEvent: ExtensionEntityMenuRefreshRequestedEvent
    ExtensionCardActionRunRequest: ExtensionCardActionRunRequest
    ExtensionWebviewSessionInfo: ExtensionWebviewSessionInfo
    ExtensionWebviewOpenPageRequest: ExtensionWebviewOpenPageRequest
    ExtensionWebviewMessageEvent: ExtensionWebviewMessageEvent
    ExtensionWebviewPostMessageRequest: ExtensionWebviewPostMessageRequest
    ExtensionWebviewReadyRequest: ExtensionWebviewReadyRequest
    ExtensionWebviewCloseRequest: ExtensionWebviewCloseRequest
  }>
>
