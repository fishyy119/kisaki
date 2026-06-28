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
  ThemeContribution,
  UiCallbackResult,
  WebviewSurface
} from '@kisaki3/extension-api'
import type {
  ExtensionRegistryArtifactTarget,
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
  name: string
  version: string | null
  description?: string
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
 */
export interface ExtensionDevelopmentStaleChangedEvent {
  extensionIds: readonly string[]
}

export interface ExtensionUpdateInfo {
  planId: string
  planFingerprint: string
  extensionId: string
  currentVersion: string
  latestVersion: string
  repository?: ExtensionInstallPlanRepositoryInfo | null
  release?: ExtensionCatalogReleaseInfo | null
  artifact?: ExtensionCatalogArtifactInfo | null
  signer?: ExtensionInstallPlanSignerInfo
  updatePolicy?: ExtensionInstallUpdatePolicy
  includePreviewUpdates?: boolean
  automaticEligible?: boolean
  risks?: readonly ExtensionInstallRiskInfo[]
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
  name: string
  summary: string
  description?: string
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
  changelog?: {
    text?: string
    url?: string
  }
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

export interface ExtensionUpdateRequest {
  extensionId: string
  planId: string
  planFingerprint: string
  trustSignerFingerprint?: boolean
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

export type ExtensionCreateInstallPlanRequest =
  | ExtensionCreateRepositoryInstallPlanRequest
  | ExtensionCreateLocalInstallPlanRequest

export interface ExtensionCreateRepositoryInstallPlanRequest {
  sourceKind?: 'repository'
  extensionId: string
  releaseId?: string
  repositoryId?: string
}

export interface ExtensionCreateLocalInstallPlanRequest {
  sourceKind: 'local-file'
  filePath: string
}

export interface ExtensionInstallPlanConfirmation {
  planId: string
  planFingerprint: string
}

export interface ExtensionInstallReleaseRequest
  extends ExtensionCreateRepositoryInstallPlanRequest, ExtensionInstallPlanConfirmation {
  trustSignerFingerprint?: boolean
  enabled?: boolean
  updatePolicy?: ExtensionInstallUpdatePolicy
}

export interface ExtensionInstallFromFileRequest extends ExtensionInstallPlanConfirmation {
  filePath: string
  enabled?: boolean
}

export interface ExtensionPurgeDataRequest {
  extensionId: string
  force?: boolean
}

export type ExtensionInstallSourceKind = 'repository' | 'local-file'

export type ExtensionInstallRiskCode =
  | 'downgrade'
  | 'same-version'
  | 'preview-release'
  | 'preview-updates-change'
  | 'yanked-release'
  | 'unsigned-release'
  | 'signer-untrusted'
  | 'signer-changed'
  | 'local-unsigned'

export type ExtensionInstallRiskSeverity = 'info' | 'warning' | 'danger'

export interface ExtensionInstallRiskInfo {
  id: string
  code: ExtensionInstallRiskCode
  severity: ExtensionInstallRiskSeverity
  message: string
}

export type ExtensionInstallSignerTrustStatus = 'trusted' | 'untrusted' | 'changed' | 'unsigned'

export interface ExtensionInstallPlanSignerInfo {
  status: ExtensionInstallSignerTrustStatus
  keyId?: string
  algorithm?: ExtensionRegistrySigningAlgorithm
  fingerprint?: string
  trusted: boolean
}

export interface ExtensionInstallPlanRepositoryInfo {
  id: string
  name: string
  url: string
  manifestDigest: string | null
}

export interface ExtensionInstallPlanPackageInfo {
  id: string
  name: string
  summary?: string
  currentVersion: string | null
  targetVersion: string
  releaseKind: ExtensionRegistryReleaseKind
}

export interface ExtensionInstallPlan {
  id: string
  fingerprint: string
  sourceKind: ExtensionInstallSourceKind
  package: ExtensionInstallPlanPackageInfo
  repository: ExtensionInstallPlanRepositoryInfo | null
  release: ExtensionCatalogReleaseInfo | null
  artifact: ExtensionCatalogArtifactInfo | null
  localFile: ExtensionInstallPlanLocalFileInfo | null
  signer: ExtensionInstallPlanSignerInfo
  risks: readonly ExtensionInstallRiskInfo[]
  defaultEnabled: boolean
  updatePolicy: ExtensionInstallUpdatePolicy
  includePreviewUpdates: boolean
}

export interface ExtensionInstallPlanLocalFileInfo {
  path: string
  size: number
  sha256: string
}

export interface ExtensionContributionOwnerInfo {
  extensionId: string
  extensionName: string
  extensionVersion: string
}

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

export interface ExtensionContributionSnapshot {
  entityMenus: readonly ExtensionEntityMenuRegistrationInfo[]
  cardActions: readonly ExtensionCardActionRegistrationInfo[]
  scraperProviders: readonly ExtensionScraperProviderRegistrationInfo[]
  deeplinkRoutes: readonly ExtensionDeeplinkRouteRegistrationInfo[]
  themes: readonly ExtensionThemeRegistrationInfo[]
}

export interface ExtensionContributionError {
  extensionId: string
  contributionId: string
  message: string
  code?: string
}

export type ExtensionResolvedEntityMenuActionNode = Omit<EntityMenuActionNode, 'onClick'>

export type ExtensionResolvedEntityMenuCheckboxNode = Omit<EntityMenuCheckboxNode, 'onChange'>

export type ExtensionResolvedEntityMenuSelectNode = Omit<EntityMenuSelectNode, 'onChange'>

export type ExtensionResolvedEntityMenuSubmenuNode = Omit<EntityMenuSubmenuNode, 'children'> & {
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
 * One open webview session as projected to the renderer. `documentUrl` always
 * uses the app-owned extension UI protocol, regardless of whether main serves
 * package files or proxies a development server. The renderer appends the
 * bootstrap query, mounts the iframe, and relays messages through main.
 */
export interface ExtensionWebviewSessionInfo {
  webviewId: string
  extensionId: string
  extensionName: string
  title: string
  surface: WebviewSurface
  entry: string
  params: JsonObject
  documentUrl: string
  openedAt: number
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
    ExtensionDevelopmentStaleChangedEvent: ExtensionDevelopmentStaleChangedEvent
    ExtensionUpdateCheckResult: ExtensionUpdateCheckResult
    ExtensionRepositoryInfo: ExtensionRepositoryInfo
    ExtensionRepositoryCreateRequest: ExtensionRepositoryCreateRequest
    ExtensionRepositoryUpdateRequest: ExtensionRepositoryUpdateRequest
    ExtensionRepositoryRefreshResult: ExtensionRepositoryRefreshResult
    ExtensionTrustedSignerInfo: ExtensionTrustedSignerInfo
    ExtensionCatalogSearchRequest: ExtensionCatalogSearchRequest
    ExtensionCatalogSearchResult: ExtensionCatalogSearchResult
    ExtensionAutomaticUpdateRunState: ExtensionAutomaticUpdateRunState
    ExtensionCreateInstallPlanRequest: ExtensionCreateInstallPlanRequest
    ExtensionInstallPlan: ExtensionInstallPlan
    ExtensionInstallReleaseRequest: ExtensionInstallReleaseRequest
    ExtensionInstallFromFileRequest: ExtensionInstallFromFileRequest
    ExtensionPurgeDataRequest: ExtensionPurgeDataRequest
    ExtensionUpdatePolicyRequest: ExtensionUpdatePolicyRequest
    ExtensionUpdateRequest: ExtensionUpdateRequest
    ExtensionContributionSnapshot: ExtensionContributionSnapshot
    ExtensionResolvedEntityMenu: ExtensionResolvedEntityMenu
    ExtensionEntityMenuResolveRequest: ExtensionEntityMenuResolveRequest
    ExtensionEntityMenuInvokeRequest: ExtensionEntityMenuInvokeRequest
    ExtensionEntityMenuInvokeResponse: ExtensionEntityMenuInvokeResponse
    ExtensionEntityMenuReleaseRequest: ExtensionEntityMenuReleaseRequest
    ExtensionEntityMenuRefreshRequestedEvent: ExtensionEntityMenuRefreshRequestedEvent
    ExtensionCardActionRunRequest: ExtensionCardActionRunRequest
    ExtensionWebviewSessionInfo: ExtensionWebviewSessionInfo
    ExtensionWebviewMessageEvent: ExtensionWebviewMessageEvent
    ExtensionWebviewPostMessageRequest: ExtensionWebviewPostMessageRequest
    ExtensionWebviewReadyRequest: ExtensionWebviewReadyRequest
    ExtensionWebviewCloseRequest: ExtensionWebviewCloseRequest
  }>
>
