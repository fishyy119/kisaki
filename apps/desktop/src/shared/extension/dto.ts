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
  SerializableRecord,
  SerializableValue,
  SettingsPanelButtonNode,
  SettingsPanelCallbackResult,
  SettingsPanelCheckboxNode,
  SettingsPanelComparisonListNode,
  SettingsPanelDialogSize,
  SettingsPanelDividerNode,
  SettingsPanelFieldHelp,
  SettingsPanelFieldLink,
  SettingsPanelImageNode,
  SettingsPanelLinkNode,
  SettingsPanelMultiSelectNode,
  SettingsPanelNoticeNode,
  SettingsPanelNumberInputNode,
  SettingsPanelPopoverWidth,
  SettingsPanelRadioGroupNode,
  SettingsPanelRecordListNode,
  SettingsPanelRefreshReason,
  SettingsPanelSelectNode,
  SettingsPanelStatusNode,
  SettingsPanelStringListNode,
  SettingsPanelSwitchNode,
  SettingsPanelTableNode,
  SettingsPanelTextInputNode,
  SettingsPanelTextNode,
  SettingsPanelTextareaNode,
  ThemeContribution,
  UiCallbackResult
} from '@kisaki3/extension-api'
import type {
  ExtensionRegistryArtifactTarget,
  ExtensionRegistryReleaseKind,
  ExtensionRegistryReleaseEngines,
  ExtensionRegistrySigningAlgorithm
} from '@kisaki3/extension-registry'
import type { ExtensionInstallationSource } from './installation-source'

export type InstalledExtensionStatus = 'ready' | 'invalid' | 'missing-package'

export type InstalledExtensionRuntimeStatus = 'running' | 'failed' | 'stopped'

export interface ExtensionInstalledPackageInfo {
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
  runtimeDiagnostics: readonly ExtensionRuntimeDiagnostic[]
  installationSource: ExtensionInstallationSource | null
  updatePolicy?: ExtensionInstallUpdatePolicy
  pinnedVersion?: string | null
  includePreviewUpdates?: boolean | null
  installedAt?: string | null
  directory: string
  issues: readonly string[]
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

export interface ExtensionSettingsPanelRegistrationInfo extends ExtensionContributionOwnerInfo {
  contributionId: string
  title: string
  description?: string
  size?: SettingsPanelDialogSize
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
  settingsPanels: readonly ExtensionSettingsPanelRegistrationInfo[]
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

export type ExtensionSettingsPanelSurface = 'root' | 'dialog' | 'popover'
export type ExtensionSettingsPanelScope = ExtensionSettingsPanelSurface | 'all'

export interface ExtensionSettingsPanelDraftSnapshot {
  values: SerializableRecord
  dirtyNodeIds: readonly string[]
}

export interface ExtensionSettingsPanelSessionRef {
  sessionId: string
  extensionId: string
  contributionId: string
}

export type ExtensionSettingsPanelSession = ExtensionSettingsPanelSessionRef

export type ExtensionSettingsPanelParentRef =
  | { surface: 'root' }
  | { surface: 'dialog'; dialogId: string }

type ExtensionResolvedSettingsPanelChangeNode<TNode extends { onChange?: unknown }> = Omit<
  TNode,
  'onChange'
> & {
  callbackId?: string
}

type ExtensionResolvedSettingsPanelButtonBase<TNode extends { onClick?: unknown }> = Omit<
  TNode,
  'onClick'
> & {
  callbackId?: string
}

export type ExtensionResolvedSettingsPanelSwitchNode = ExtensionResolvedSettingsPanelChangeNode<
  SettingsPanelSwitchNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelCheckboxNode = ExtensionResolvedSettingsPanelChangeNode<
  SettingsPanelCheckboxNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelSelectNode = ExtensionResolvedSettingsPanelChangeNode<
  SettingsPanelSelectNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelRadioGroupNode = ExtensionResolvedSettingsPanelChangeNode<
  SettingsPanelRadioGroupNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelMultiSelectNode =
  ExtensionResolvedSettingsPanelChangeNode<SettingsPanelMultiSelectNode<unknown, unknown>>

export type ExtensionResolvedSettingsPanelTextInputNode = ExtensionResolvedSettingsPanelChangeNode<
  SettingsPanelTextInputNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelTextareaNode = ExtensionResolvedSettingsPanelChangeNode<
  SettingsPanelTextareaNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelNumberInputNode =
  ExtensionResolvedSettingsPanelChangeNode<SettingsPanelNumberInputNode<unknown, unknown>>

export type ExtensionResolvedSettingsPanelStringListNode = ExtensionResolvedSettingsPanelChangeNode<
  SettingsPanelStringListNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelRecordListNode = ExtensionResolvedSettingsPanelChangeNode<
  SettingsPanelRecordListNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelButtonNode = ExtensionResolvedSettingsPanelButtonBase<
  SettingsPanelButtonNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelTextNode = SettingsPanelTextNode
export type ExtensionResolvedSettingsPanelNoticeNode = SettingsPanelNoticeNode
export type ExtensionResolvedSettingsPanelStatusNode = SettingsPanelStatusNode
export type ExtensionResolvedSettingsPanelTableNode = SettingsPanelTableNode
export type ExtensionResolvedSettingsPanelComparisonListNode = SettingsPanelComparisonListNode
export type ExtensionResolvedSettingsPanelLinkNode = SettingsPanelLinkNode
export type ExtensionResolvedSettingsPanelImageNode = SettingsPanelImageNode
export type ExtensionResolvedSettingsPanelDividerNode = SettingsPanelDividerNode

export type ExtensionResolvedSettingsPanelNode =
  | ExtensionResolvedSettingsPanelSwitchNode
  | ExtensionResolvedSettingsPanelCheckboxNode
  | ExtensionResolvedSettingsPanelSelectNode
  | ExtensionResolvedSettingsPanelRadioGroupNode
  | ExtensionResolvedSettingsPanelMultiSelectNode
  | ExtensionResolvedSettingsPanelTextInputNode
  | ExtensionResolvedSettingsPanelTextareaNode
  | ExtensionResolvedSettingsPanelNumberInputNode
  | ExtensionResolvedSettingsPanelStringListNode
  | ExtensionResolvedSettingsPanelRecordListNode
  | ExtensionResolvedSettingsPanelButtonNode
  | ExtensionResolvedSettingsPanelTextNode
  | ExtensionResolvedSettingsPanelNoticeNode
  | ExtensionResolvedSettingsPanelStatusNode
  | ExtensionResolvedSettingsPanelTableNode
  | ExtensionResolvedSettingsPanelComparisonListNode
  | ExtensionResolvedSettingsPanelLinkNode
  | ExtensionResolvedSettingsPanelImageNode
  | ExtensionResolvedSettingsPanelDividerNode

export interface ExtensionResolvedSettingsPanelField {
  id: string
  label?: string
  description?: string
  help?: SettingsPanelFieldHelp
  link?: SettingsPanelFieldLink
  hidden?: boolean
  disabled?: boolean
  orientation?: 'vertical' | 'horizontal' | 'responsive'
  span?: 1 | 2 | 3 | 'full'
  contentLayout?: 'stack' | 'inline' | 'grid'
  contentColumns?: 1 | 2 | 3
  content: readonly ExtensionResolvedSettingsPanelNode[]
}

export interface ExtensionResolvedSettingsPanelTab {
  id: string
  label: string
  description?: string
  icon?: string
  fields: readonly ExtensionResolvedSettingsPanelField[]
}

export type ExtensionResolvedSettingsPanelRoot = {
  surface: 'root'
  title?: string
  description?: string
  submitLabel?: string
} & (
  | {
      fields: readonly ExtensionResolvedSettingsPanelField[]
      tabs?: never
      activeTabId?: never
    }
  | {
      tabs: readonly ExtensionResolvedSettingsPanelTab[]
      activeTabId?: string
      fields?: never
    }
)

export interface ExtensionResolvedSettingsPanelDialog {
  surface: 'dialog'
  dialogId: string
  title?: string
  description?: string
  size?: SettingsPanelDialogSize
  submitLabel?: string
  fields: readonly ExtensionResolvedSettingsPanelField[]
}

export interface ExtensionResolvedSettingsPanelPopover {
  surface: 'popover'
  popoverId: string
  parent: ExtensionSettingsPanelParentRef
  anchorNodeKey?: string
  title?: string
  description?: string
  width?: SettingsPanelPopoverWidth
  fields: readonly ExtensionResolvedSettingsPanelField[]
}

export type ExtensionSettingsPanelOpenRequest =
  | {
      surface: 'root'
      extensionId: string
      contributionId: string
      reason?: SettingsPanelRefreshReason
    }
  | (ExtensionSettingsPanelSessionRef & {
      surface: 'dialog'
      dialogId: string
      params?: SerializableRecord
      parentDraft: ExtensionSettingsPanelDraftSnapshot
      revision: number
    })
  | (ExtensionSettingsPanelSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsPanelParentRef
      params?: SerializableRecord
      parentDraft: ExtensionSettingsPanelDraftSnapshot
      anchorNodeKey: string
      revision: number
    })

export type ExtensionSettingsPanelRefreshRequest =
  | (ExtensionSettingsPanelSessionRef & {
      surface: 'root'
      draft: ExtensionSettingsPanelDraftSnapshot
      reason?: SettingsPanelRefreshReason
      revision: number
    })
  | (ExtensionSettingsPanelSessionRef & {
      surface: 'dialog'
      dialogId: string
      draft: ExtensionSettingsPanelDraftSnapshot
      parentDraft: ExtensionSettingsPanelDraftSnapshot
      reason?: SettingsPanelRefreshReason
      revision: number
    })
  | (ExtensionSettingsPanelSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsPanelParentRef
      draft: ExtensionSettingsPanelDraftSnapshot
      parentDraft: ExtensionSettingsPanelDraftSnapshot
      reason?: SettingsPanelRefreshReason
      revision: number
    })
  | (ExtensionSettingsPanelSessionRef & {
      surface: 'all'
      rootDraft: ExtensionSettingsPanelDraftSnapshot
      activeDialog?: {
        dialogId: string
        draft: ExtensionSettingsPanelDraftSnapshot
      }
      reason?: SettingsPanelRefreshReason
      revision: number
    })

export type ExtensionSettingsPanelSubmitRequest =
  | (ExtensionSettingsPanelSessionRef & {
      surface: 'root'
      draft: ExtensionSettingsPanelDraftSnapshot
      revision: number
    })
  | (ExtensionSettingsPanelSessionRef & {
      surface: 'dialog'
      dialogId: string
      draft: ExtensionSettingsPanelDraftSnapshot
      parentDraft: ExtensionSettingsPanelDraftSnapshot
      revision: number
    })

export interface ExtensionSettingsPanelInvokeBase extends ExtensionSettingsPanelSessionRef {
  callbackId: string
  fieldId: string
  nodeId: string
  value?: SerializableValue
  requestId: string
  revision: number
}

export type ExtensionSettingsPanelInvokeRequest =
  | (ExtensionSettingsPanelInvokeBase & {
      surface: 'root'
      draft: ExtensionSettingsPanelDraftSnapshot
    })
  | (ExtensionSettingsPanelInvokeBase & {
      surface: 'dialog'
      dialogId: string
      draft: ExtensionSettingsPanelDraftSnapshot
      parentDraft: ExtensionSettingsPanelDraftSnapshot
    })
  | (ExtensionSettingsPanelInvokeBase & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsPanelParentRef
      draft: ExtensionSettingsPanelDraftSnapshot
      parentDraft: ExtensionSettingsPanelDraftSnapshot
    })

export type ExtensionSettingsPanelReleaseRequest =
  | (ExtensionSettingsPanelSessionRef & { surface: 'root' | 'all' })
  | (ExtensionSettingsPanelSessionRef & { surface: 'dialog'; dialogId: string })
  | (ExtensionSettingsPanelSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsPanelParentRef
    })

export type ExtensionSettingsPanelOpenResponse =
  | {
      surface: 'root'
      session: ExtensionSettingsPanelSession
      view: ExtensionResolvedSettingsPanelRoot
    }
  | {
      surface: 'dialog'
      dialog: ExtensionResolvedSettingsPanelDialog
    }
  | {
      surface: 'popover'
      popover: ExtensionResolvedSettingsPanelPopover
    }

export type ExtensionSettingsPanelRefreshResponse =
  | {
      surface: 'root'
      view: ExtensionResolvedSettingsPanelRoot
    }
  | {
      surface: 'dialog'
      dialog: ExtensionResolvedSettingsPanelDialog
    }
  | {
      surface: 'popover'
      popover: ExtensionResolvedSettingsPanelPopover
    }
  | {
      surface: 'all'
      view: ExtensionResolvedSettingsPanelRoot
      activeDialog?: {
        dialogId: string
        dialog: ExtensionResolvedSettingsPanelDialog
      }
    }

export interface ExtensionSettingsPanelCallbackResponse {
  result: SettingsPanelCallbackResult
}

export interface ExtensionSettingsPanelRefreshRequestedEvent {
  extensionId: string
  contributionId: string
  reason?: SettingsPanelRefreshReason
}
