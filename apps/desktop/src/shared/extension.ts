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
  SettingsPanelDialogSize,
  SettingsPanelDividerNode,
  SettingsPanelImageNode,
  SettingsPanelMultiSelectNode,
  SettingsPanelNoticeNode,
  SettingsPanelNumberInputNode,
  SettingsPanelPopoverWidth,
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
} from '@kisaki/extension-api'

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
  runtimeDiagnostics: readonly ExtensionRuntimeDiagnostic[]
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

type ExtensionResolvedSettingsPanelCommitNode<TNode extends { onCommit?: unknown }> = Omit<
  TNode,
  'onCommit'
> & {
  callbackId?: string
}

type ExtensionResolvedSettingsPanelButtonBase<TNode extends { onClick?: unknown }> = Omit<
  TNode,
  'onClick'
> & {
  callbackId?: string
}

export type ExtensionResolvedSettingsPanelSwitchNode = ExtensionResolvedSettingsPanelCommitNode<
  SettingsPanelSwitchNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelCheckboxNode = ExtensionResolvedSettingsPanelCommitNode<
  SettingsPanelCheckboxNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelSelectNode = ExtensionResolvedSettingsPanelCommitNode<
  SettingsPanelSelectNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelMultiSelectNode =
  ExtensionResolvedSettingsPanelCommitNode<SettingsPanelMultiSelectNode<unknown, unknown>>

export type ExtensionResolvedSettingsPanelTextInputNode = ExtensionResolvedSettingsPanelCommitNode<
  SettingsPanelTextInputNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelTextareaNode = ExtensionResolvedSettingsPanelCommitNode<
  SettingsPanelTextareaNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelNumberInputNode =
  ExtensionResolvedSettingsPanelCommitNode<SettingsPanelNumberInputNode<unknown, unknown>>

export type ExtensionResolvedSettingsPanelStringListNode = ExtensionResolvedSettingsPanelCommitNode<
  SettingsPanelStringListNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelRecordListNode = ExtensionResolvedSettingsPanelCommitNode<
  SettingsPanelRecordListNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelButtonNode = ExtensionResolvedSettingsPanelButtonBase<
  SettingsPanelButtonNode<unknown, unknown>
>

export type ExtensionResolvedSettingsPanelTextNode = SettingsPanelTextNode
export type ExtensionResolvedSettingsPanelNoticeNode = SettingsPanelNoticeNode
export type ExtensionResolvedSettingsPanelStatusNode = SettingsPanelStatusNode
export type ExtensionResolvedSettingsPanelTableNode = SettingsPanelTableNode
export type ExtensionResolvedSettingsPanelImageNode = SettingsPanelImageNode
export type ExtensionResolvedSettingsPanelDividerNode = SettingsPanelDividerNode

export type ExtensionResolvedSettingsPanelNode =
  | ExtensionResolvedSettingsPanelSwitchNode
  | ExtensionResolvedSettingsPanelCheckboxNode
  | ExtensionResolvedSettingsPanelSelectNode
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
  | ExtensionResolvedSettingsPanelImageNode
  | ExtensionResolvedSettingsPanelDividerNode

export interface ExtensionResolvedSettingsPanelField {
  id: string
  label?: string
  description?: string
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
  size?: SettingsPanelDialogSize
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
