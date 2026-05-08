import type {
  CharacterScraperProviderRegistration,
  DeeplinkContributionRegistration,
  ExtensionCategory,
  GameScraperProviderRegistration,
  MenuActionNode,
  MenuCheckboxNode,
  MenuDomain,
  MenuInput,
  MenuRefreshReason,
  MenuScope,
  MenuSelectNode,
  MenuSeparatorNode,
  MenuSubmenuNode,
  PersonScraperProviderRegistration,
  CompanyScraperProviderRegistration,
  SerializableRecord,
  SerializableValue,
  SettingsButtonNode,
  SettingsCallbackResult,
  SettingsCheckboxNode,
  SettingsDialogSize,
  SettingsDividerNode,
  SettingsImageNode,
  SettingsMultiSelectNode,
  SettingsNoticeNode,
  SettingsNumberInputNode,
  SettingsPopoverWidth,
  SettingsRecordListNode,
  SettingsRefreshReason,
  SettingsSelectNode,
  SettingsStatusNode,
  SettingsStringListNode,
  SettingsSwitchNode,
  SettingsTableNode,
  SettingsTextInputNode,
  SettingsTextNode,
  SettingsTextareaNode,
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

export type ExtensionMenuContributionScopeInfo = {
  [TDomain in MenuDomain]: {
    [TScope in MenuScope<TDomain>]: {
      contributionId: string
      domain: TDomain
      scope: TScope
    }
  }[MenuScope<TDomain>]
}[MenuDomain]

export type ExtensionMenuContributionInfo = ExtensionContributionOwnerInfo &
  ExtensionMenuContributionScopeInfo & {
    order: number
  }

export interface ExtensionSettingsContributionInfo extends ExtensionContributionOwnerInfo {
  contributionId: string
  title: string
  description?: string
  order: number
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
  menus: readonly ExtensionMenuContributionInfo[]
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

export type ExtensionResolvedMenuActionNode = Omit<MenuActionNode, 'onClick'>

export type ExtensionResolvedMenuCheckboxNode = Omit<MenuCheckboxNode, 'onChange'>

export type ExtensionResolvedMenuSelectNode = Omit<MenuSelectNode, 'onChange'>

export type ExtensionResolvedMenuSubmenuNode = Omit<MenuSubmenuNode, 'children'> & {
  children: readonly ExtensionResolvedMenuNode[]
}

export type ExtensionResolvedMenuSeparatorNode = Omit<MenuSeparatorNode, 'id'> & {
  id: string
}

export type ExtensionResolvedMenuNode =
  | ExtensionResolvedMenuActionNode
  | ExtensionResolvedMenuCheckboxNode
  | ExtensionResolvedMenuSelectNode
  | ExtensionResolvedMenuSubmenuNode
  | ExtensionResolvedMenuSeparatorNode

export type ExtensionResolvedMenuGroup = ExtensionMenuContributionInfo & {
  nodes: readonly ExtensionResolvedMenuNode[]
}

export interface ExtensionResolvedMenu {
  sessionId: string
  input: MenuInput
  groups: readonly ExtensionResolvedMenuGroup[]
  errors: readonly ExtensionContributionError[]
}

export interface ExtensionMenuResolveRequest {
  input: MenuInput
}

export interface ExtensionMenuInvokeRequest {
  sessionId: string
  extensionId: string
  contributionId: string
  nodePath: readonly string[]
  input: MenuInput
  value?: boolean | string
}

export interface ExtensionMenuInvokeResponse {
  result: UiCallbackResult
}

export interface ExtensionMenuReleaseRequest {
  sessionId: string
}

export type ExtensionMenuRefreshRequestedEvent = ExtensionMenuContributionScopeInfo & {
  extensionId: string
  reason?: MenuRefreshReason
}

export type ExtensionSettingsSurface = 'root' | 'dialog' | 'popover'
export type ExtensionSettingsScope = ExtensionSettingsSurface | 'all'

export interface ExtensionSettingsDraftSnapshot {
  values: SerializableRecord
  dirtyNodeIds: readonly string[]
}

export interface ExtensionSettingsSessionRef {
  sessionId: string
  extensionId: string
  contributionId: string
}

export type ExtensionSettingsSession = ExtensionSettingsSessionRef

export type ExtensionSettingsParentRef =
  | { surface: 'root' }
  | { surface: 'dialog'; dialogId: string }

type ExtensionResolvedSettingsCommitNode<TNode extends { onCommit?: unknown }> = Omit<
  TNode,
  'onCommit'
> & {
  callbackId?: string
}

type ExtensionResolvedSettingsButtonBase<TNode extends { onClick?: unknown }> = Omit<
  TNode,
  'onClick'
> & {
  callbackId?: string
}

export type ExtensionResolvedSettingsSwitchNode = ExtensionResolvedSettingsCommitNode<
  SettingsSwitchNode<unknown, unknown>
>

export type ExtensionResolvedSettingsCheckboxNode = ExtensionResolvedSettingsCommitNode<
  SettingsCheckboxNode<unknown, unknown>
>

export type ExtensionResolvedSettingsSelectNode = ExtensionResolvedSettingsCommitNode<
  SettingsSelectNode<unknown, unknown>
>

export type ExtensionResolvedSettingsMultiSelectNode = ExtensionResolvedSettingsCommitNode<
  SettingsMultiSelectNode<unknown, unknown>
>

export type ExtensionResolvedSettingsTextInputNode = ExtensionResolvedSettingsCommitNode<
  SettingsTextInputNode<unknown, unknown>
>

export type ExtensionResolvedSettingsTextareaNode = ExtensionResolvedSettingsCommitNode<
  SettingsTextareaNode<unknown, unknown>
>

export type ExtensionResolvedSettingsNumberInputNode = ExtensionResolvedSettingsCommitNode<
  SettingsNumberInputNode<unknown, unknown>
>

export type ExtensionResolvedSettingsStringListNode = ExtensionResolvedSettingsCommitNode<
  SettingsStringListNode<unknown, unknown>
>

export type ExtensionResolvedSettingsRecordListNode = ExtensionResolvedSettingsCommitNode<
  SettingsRecordListNode<unknown, unknown>
>

export type ExtensionResolvedSettingsButtonNode = ExtensionResolvedSettingsButtonBase<
  SettingsButtonNode<unknown, unknown>
>

export type ExtensionResolvedSettingsTextNode = SettingsTextNode
export type ExtensionResolvedSettingsNoticeNode = SettingsNoticeNode
export type ExtensionResolvedSettingsStatusNode = SettingsStatusNode
export type ExtensionResolvedSettingsTableNode = SettingsTableNode
export type ExtensionResolvedSettingsImageNode = SettingsImageNode
export type ExtensionResolvedSettingsDividerNode = SettingsDividerNode

export type ExtensionResolvedSettingsNode =
  | ExtensionResolvedSettingsSwitchNode
  | ExtensionResolvedSettingsCheckboxNode
  | ExtensionResolvedSettingsSelectNode
  | ExtensionResolvedSettingsMultiSelectNode
  | ExtensionResolvedSettingsTextInputNode
  | ExtensionResolvedSettingsTextareaNode
  | ExtensionResolvedSettingsNumberInputNode
  | ExtensionResolvedSettingsStringListNode
  | ExtensionResolvedSettingsRecordListNode
  | ExtensionResolvedSettingsButtonNode
  | ExtensionResolvedSettingsTextNode
  | ExtensionResolvedSettingsNoticeNode
  | ExtensionResolvedSettingsStatusNode
  | ExtensionResolvedSettingsTableNode
  | ExtensionResolvedSettingsImageNode
  | ExtensionResolvedSettingsDividerNode

export interface ExtensionResolvedSettingsField {
  id: string
  label?: string
  description?: string
  hidden?: boolean
  disabled?: boolean
  orientation?: 'vertical' | 'horizontal' | 'responsive'
  span?: 1 | 2 | 3 | 'full'
  contentLayout?: 'stack' | 'inline' | 'grid'
  contentColumns?: 1 | 2 | 3
  content: readonly ExtensionResolvedSettingsNode[]
}

export interface ExtensionResolvedSettingsTab {
  id: string
  label: string
  description?: string
  icon?: string
  fields: readonly ExtensionResolvedSettingsField[]
}

export type ExtensionResolvedSettingsRoot = {
  surface: 'root'
  title?: string
  description?: string
  size?: SettingsDialogSize
} & (
  | {
      fields: readonly ExtensionResolvedSettingsField[]
      tabs?: never
      activeTabId?: never
    }
  | {
      tabs: readonly ExtensionResolvedSettingsTab[]
      activeTabId?: string
      fields?: never
    }
)

export interface ExtensionResolvedSettingsDialog {
  surface: 'dialog'
  dialogId: string
  title?: string
  description?: string
  size?: SettingsDialogSize
  fields: readonly ExtensionResolvedSettingsField[]
}

export interface ExtensionResolvedSettingsPopover {
  surface: 'popover'
  popoverId: string
  parent: ExtensionSettingsParentRef
  anchorNodeKey?: string
  title?: string
  description?: string
  width?: SettingsPopoverWidth
  fields: readonly ExtensionResolvedSettingsField[]
}

export type ExtensionSettingsOpenRequest =
  | {
      surface: 'root'
      extensionId: string
      contributionId: string
      reason?: SettingsRefreshReason
    }
  | (ExtensionSettingsSessionRef & {
      surface: 'dialog'
      dialogId: string
      params?: SerializableRecord
      parentDraft: ExtensionSettingsDraftSnapshot
      revision: number
    })
  | (ExtensionSettingsSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsParentRef
      params?: SerializableRecord
      parentDraft: ExtensionSettingsDraftSnapshot
      anchorNodeKey: string
      revision: number
    })

export type ExtensionSettingsRefreshRequest =
  | (ExtensionSettingsSessionRef & {
      surface: 'root'
      draft: ExtensionSettingsDraftSnapshot
      reason?: SettingsRefreshReason
      revision: number
    })
  | (ExtensionSettingsSessionRef & {
      surface: 'dialog'
      dialogId: string
      draft: ExtensionSettingsDraftSnapshot
      parentDraft: ExtensionSettingsDraftSnapshot
      reason?: SettingsRefreshReason
      revision: number
    })
  | (ExtensionSettingsSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsParentRef
      draft: ExtensionSettingsDraftSnapshot
      parentDraft: ExtensionSettingsDraftSnapshot
      reason?: SettingsRefreshReason
      revision: number
    })
  | (ExtensionSettingsSessionRef & {
      surface: 'all'
      rootDraft: ExtensionSettingsDraftSnapshot
      activeDialog?: {
        dialogId: string
        draft: ExtensionSettingsDraftSnapshot
      }
      reason?: SettingsRefreshReason
      revision: number
    })

export type ExtensionSettingsSubmitRequest =
  | (ExtensionSettingsSessionRef & {
      surface: 'root'
      draft: ExtensionSettingsDraftSnapshot
      revision: number
    })
  | (ExtensionSettingsSessionRef & {
      surface: 'dialog'
      dialogId: string
      draft: ExtensionSettingsDraftSnapshot
      parentDraft: ExtensionSettingsDraftSnapshot
      revision: number
    })

export interface ExtensionSettingsInvokeBase extends ExtensionSettingsSessionRef {
  callbackId: string
  fieldId: string
  nodeId: string
  value?: SerializableValue
  requestId: string
  revision: number
}

export type ExtensionSettingsInvokeRequest =
  | (ExtensionSettingsInvokeBase & {
      surface: 'root'
      draft: ExtensionSettingsDraftSnapshot
    })
  | (ExtensionSettingsInvokeBase & {
      surface: 'dialog'
      dialogId: string
      draft: ExtensionSettingsDraftSnapshot
      parentDraft: ExtensionSettingsDraftSnapshot
    })
  | (ExtensionSettingsInvokeBase & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsParentRef
      draft: ExtensionSettingsDraftSnapshot
      parentDraft: ExtensionSettingsDraftSnapshot
    })

export type ExtensionSettingsReleaseRequest =
  | (ExtensionSettingsSessionRef & { surface: 'root' | 'all' })
  | (ExtensionSettingsSessionRef & { surface: 'dialog'; dialogId: string })
  | (ExtensionSettingsSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsParentRef
    })

export type ExtensionSettingsOpenResponse =
  | {
      surface: 'root'
      session: ExtensionSettingsSession
      view: ExtensionResolvedSettingsRoot
    }
  | {
      surface: 'dialog'
      dialog: ExtensionResolvedSettingsDialog
    }
  | {
      surface: 'popover'
      popover: ExtensionResolvedSettingsPopover
    }

export type ExtensionSettingsRefreshResponse =
  | {
      surface: 'root'
      view: ExtensionResolvedSettingsRoot
    }
  | {
      surface: 'dialog'
      dialog: ExtensionResolvedSettingsDialog
    }
  | {
      surface: 'popover'
      popover: ExtensionResolvedSettingsPopover
    }
  | {
      surface: 'all'
      view: ExtensionResolvedSettingsRoot
      activeDialog?: {
        dialogId: string
        dialog: ExtensionResolvedSettingsDialog
      }
    }

export interface ExtensionSettingsCallbackResponse {
  result: SettingsCallbackResult
}

export interface ExtensionSettingsRefreshRequestedEvent {
  extensionId: string
  contributionId: string
  reason?: SettingsRefreshReason
}
