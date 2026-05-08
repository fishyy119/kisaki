import type { CommandExecutionSource } from '../capabilities/commands'
import type { CommandContribution } from '../contributions/commands'
import type { DeeplinkRequest, DeeplinkResponse } from '../contributions/deeplinks'
import type { MenuDomain, MenuInput, MenuRefreshReason, MenuScope } from '../contributions/menus'
import type {
  SettingsDialogButtonResult,
  SettingsDialogCommitResult,
  SettingsDialogSubmitResult,
  SettingsPopoverActionResult,
  SettingsRefreshReason,
  SettingsRootButtonResult,
  SettingsRootCommitResult,
  SettingsRootSubmitResult
} from '../contributions/settings'
import type {
  CharacterScraperSlot,
  CharacterSessionResultMap,
  CharacterSearchResult,
  CompanyScraperSlot,
  CompanySessionResultMap,
  CompanySearchResult,
  GameScraperSlot,
  GameSessionResultMap,
  GameSearchResult,
  IdResolvedTarget,
  PersonScraperSlot,
  PersonSessionResultMap,
  PersonSearchResult,
  ScraperLookup
} from '../contributions/scrapers'
import type { ThemeContribution } from '../contributions/themes'
import type { Locale, SerializableRecord, SerializableValue, UiCallbackResult } from '../shared'
import type { RpcMethodDefinition, RpcNoPayload } from './core'
import type { ContributionScopedRpcParams, ExtensionScopedRpcParams } from './lifecycle'

export type MenuContributionRegistration = {
  [TDomain in MenuDomain]: {
    [TScope in MenuScope<TDomain>]: {
      id: string
      domain: TDomain
      scope: TScope
      order?: number
    }
  }[MenuScope<TDomain>]
}[MenuDomain]

export interface SettingsContributionRegistration {
  id: string
  title: string
  description?: string
  order?: number
}

export interface DeeplinkContributionRegistration {
  id: string
  path: string
  url: string
}

export interface GameScraperProviderRegistration {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ('search' | GameScraperSlot)[]
}

export interface PersonScraperProviderRegistration {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ('search' | PersonScraperSlot)[]
}

export interface CompanyScraperProviderRegistration {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ('search' | CompanyScraperSlot)[]
}

export interface CharacterScraperProviderRegistration {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ('search' | CharacterScraperSlot)[]
}

export type CommandContributionRegistrationRpcInput = Omit<CommandContribution, 'execute'>

export interface CommandRegisterRequest extends ExtensionScopedRpcParams {
  command: CommandContributionRegistrationRpcInput
}

export interface CommandUnregisterRequest extends ExtensionScopedRpcParams {
  commandId: string
}

export interface MenuResolveRequest extends ContributionScopedRpcParams {
  sessionId: string
  input: MenuInput
}

export interface MenuResolveResult {
  nodes: readonly SerializableRecord[]
}

export interface MenuInvokeRequest extends ContributionScopedRpcParams {
  sessionId: string
  nodePath: readonly string[]
  input: MenuInput
  value?: boolean | string
}

export interface MenuReleaseRequest {
  sessionId: string
}

export interface MenuRefreshRequestedNotification extends ExtensionScopedRpcParams {
  contributionId: string
  reason?: MenuRefreshReason
}

export type SettingsRpcSurface = 'root' | 'dialog' | 'popover'
export type SettingsRpcScope = SettingsRpcSurface | 'all'

export interface SettingsDraftSnapshot {
  values: SerializableRecord
  dirtyNodeIds: readonly string[]
}

export type SettingsParentRef = { surface: 'root' } | { surface: 'dialog'; dialogId: string }

export interface SettingsSessionRef extends ContributionScopedRpcParams {
  sessionId: string
}

export type SettingsOpenRequest =
  | (ContributionScopedRpcParams & {
      surface: 'root'
      sessionId: string
      reason?: SettingsRefreshReason
    })
  | (SettingsSessionRef & {
      surface: 'dialog'
      dialogId: string
      params?: SerializableRecord
      parentDraft: SettingsDraftSnapshot
      revision: number
    })
  | (SettingsSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: SettingsParentRef
      params?: SerializableRecord
      parentDraft: SettingsDraftSnapshot
      anchorNodeKey: string
      revision: number
    })

export type SettingsRefreshRequest =
  | (SettingsSessionRef & {
      surface: 'root'
      draft: SettingsDraftSnapshot
      reason?: SettingsRefreshReason
      revision: number
    })
  | (SettingsSessionRef & {
      surface: 'dialog'
      dialogId: string
      draft: SettingsDraftSnapshot
      parentDraft: SettingsDraftSnapshot
      reason?: SettingsRefreshReason
      revision: number
    })
  | (SettingsSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: SettingsParentRef
      draft: SettingsDraftSnapshot
      parentDraft: SettingsDraftSnapshot
      reason?: SettingsRefreshReason
      revision: number
    })
  | (SettingsSessionRef & {
      surface: 'all'
      rootDraft: SettingsDraftSnapshot
      activeDialog?: {
        dialogId: string
        draft: SettingsDraftSnapshot
      }
      reason?: SettingsRefreshReason
      revision: number
    })

export type SettingsSubmitRequest =
  | (SettingsSessionRef & {
      surface: 'root'
      draft: SettingsDraftSnapshot
      revision: number
    })
  | (SettingsSessionRef & {
      surface: 'dialog'
      dialogId: string
      draft: SettingsDraftSnapshot
      parentDraft: SettingsDraftSnapshot
      revision: number
    })

export interface SettingsInvokeBase extends SettingsSessionRef {
  callbackId: string
  fieldId: string
  nodeId: string
  value?: SerializableValue
  requestId: string
  revision: number
}

export type SettingsInvokeRequest =
  | (SettingsInvokeBase & {
      surface: 'root'
      draft: SettingsDraftSnapshot
    })
  | (SettingsInvokeBase & {
      surface: 'dialog'
      dialogId: string
      draft: SettingsDraftSnapshot
      parentDraft: SettingsDraftSnapshot
    })
  | (SettingsInvokeBase & {
      surface: 'popover'
      popoverId: string
      parent: SettingsParentRef
      draft: SettingsDraftSnapshot
      parentDraft: SettingsDraftSnapshot
    })

export type SettingsReleaseRequest =
  | (SettingsSessionRef & { surface: 'root' | 'all' })
  | (SettingsSessionRef & { surface: 'dialog'; dialogId: string })
  | (SettingsSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: SettingsParentRef
    })

export type SettingsResolvedSurfacePayload = SerializableRecord

export type SettingsOpenResult =
  | {
      surface: 'root'
      sessionId: string
      view: SettingsResolvedSurfacePayload
    }
  | {
      surface: 'dialog'
      dialog: SettingsResolvedSurfacePayload
    }
  | {
      surface: 'popover'
      popover: SettingsResolvedSurfacePayload
    }

export type SettingsRefreshResult =
  | SettingsOpenResult
  | {
      surface: 'all'
      sessionId: string
      view: SettingsResolvedSurfacePayload
      activeDialog?: {
        dialogId: string
        dialog: SettingsResolvedSurfacePayload
      }
    }

export type SettingsCallbackResult =
  | SettingsRootCommitResult
  | SettingsDialogCommitResult
  | SettingsPopoverActionResult
  | SettingsRootButtonResult
  | SettingsDialogButtonResult
  | SettingsRootSubmitResult
  | SettingsDialogSubmitResult

export interface SettingsCallbackResponse {
  result: SettingsCallbackResult
}

export interface SettingsRefreshRequestedNotification extends ExtensionScopedRpcParams {
  contributionId: string
  reason?: SettingsRefreshReason
}

export interface DeeplinkHandleRequest extends ContributionScopedRpcParams {
  input: DeeplinkRequest
}

export interface CommandExecuteRequest extends ExtensionScopedRpcParams {
  commandId: string
  executionId: string
  args: SerializableRecord
  source: CommandExecutionSource
}

export interface CommandExecuteResult {
  output?: SerializableValue
}

export interface ScraperProviderScopedRpcParams extends ExtensionScopedRpcParams {
  providerId: string
}

export interface ScraperSearchRequest extends ScraperProviderScopedRpcParams {
  query: string
  locale?: Locale
}

export interface ScraperResolveRequest extends ScraperProviderScopedRpcParams {
  lookup: ScraperLookup
  locale: Locale
}

export interface ScraperSessionOpenRequest extends ScraperProviderScopedRpcParams {
  target: IdResolvedTarget
  locale: Locale
}

export interface ScraperSessionGetRequest<
  TSlot extends string
> extends ScraperProviderScopedRpcParams {
  sessionId: string
  slots: readonly TSlot[]
}

export interface ScraperSessionCloseRequest extends ScraperProviderScopedRpcParams {
  sessionId: string
}

export type ScraperProviderRpcRequestMap<
  TPrefix extends string,
  TSearchResult,
  TSlot extends string,
  TResultMap
> = {
  [K in `${TPrefix}.search`]: RpcMethodDefinition<
    ScraperSearchRequest,
    { results: readonly TSearchResult[] }
  >
} & {
  [K in `${TPrefix}.resolve`]: RpcMethodDefinition<
    ScraperResolveRequest,
    { target: IdResolvedTarget | null }
  >
} & {
  [K in `${TPrefix}.session.open`]: RpcMethodDefinition<
    ScraperSessionOpenRequest,
    { sessionId: string }
  >
} & {
  [K in `${TPrefix}.session.get`]: RpcMethodDefinition<
    ScraperSessionGetRequest<TSlot>,
    { results: Partial<TResultMap> }
  >
} & {
  [K in `${TPrefix}.session.close`]: RpcMethodDefinition<ScraperSessionCloseRequest, RpcNoPayload>
}

export interface MainToHostContributionRpcRequestMap
  extends
    ScraperProviderRpcRequestMap<
      'contributions.scrapers.games',
      GameSearchResult,
      GameScraperSlot,
      GameSessionResultMap
    >,
    ScraperProviderRpcRequestMap<
      'contributions.scrapers.persons',
      PersonSearchResult,
      PersonScraperSlot,
      PersonSessionResultMap
    >,
    ScraperProviderRpcRequestMap<
      'contributions.scrapers.companies',
      CompanySearchResult,
      CompanyScraperSlot,
      CompanySessionResultMap
    >,
    ScraperProviderRpcRequestMap<
      'contributions.scrapers.characters',
      CharacterSearchResult,
      CharacterScraperSlot,
      CharacterSessionResultMap
    > {
  'contributions.menus.resolve': RpcMethodDefinition<MenuResolveRequest, MenuResolveResult>
  'contributions.menus.invoke': RpcMethodDefinition<MenuInvokeRequest, UiCallbackResult>
  'contributions.menus.release': RpcMethodDefinition<MenuReleaseRequest, RpcNoPayload>
  'contributions.settings.open': RpcMethodDefinition<SettingsOpenRequest, SettingsOpenResult>
  'contributions.settings.refresh': RpcMethodDefinition<
    SettingsRefreshRequest,
    SettingsRefreshResult
  >
  'contributions.settings.submit': RpcMethodDefinition<
    SettingsSubmitRequest,
    SettingsCallbackResponse
  >
  'contributions.settings.invoke': RpcMethodDefinition<
    SettingsInvokeRequest,
    SettingsCallbackResponse
  >
  'contributions.settings.release': RpcMethodDefinition<SettingsReleaseRequest, RpcNoPayload>
  'contributions.deeplinks.handle': RpcMethodDefinition<DeeplinkHandleRequest, DeeplinkResponse>
  'contributions.commands.execute': RpcMethodDefinition<CommandExecuteRequest, CommandExecuteResult>
}

export type HostToMainContributionRpcRequestMap = {
  'contributions.menus.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: MenuContributionRegistration },
    RpcNoPayload
  >
  'contributions.menus.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
    RpcNoPayload
  >
  'contributions.menus.refreshRequested': RpcMethodDefinition<
    MenuRefreshRequestedNotification,
    RpcNoPayload
  >
  'contributions.settings.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: SettingsContributionRegistration },
    RpcNoPayload
  >
  'contributions.settings.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
    RpcNoPayload
  >
  'contributions.settings.refreshRequested': RpcMethodDefinition<
    SettingsRefreshRequestedNotification,
    RpcNoPayload
  >
  'contributions.scrapers.games.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: GameScraperProviderRegistration },
    RpcNoPayload
  >
  'contributions.scrapers.games.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'contributions.scrapers.persons.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: PersonScraperProviderRegistration },
    RpcNoPayload
  >
  'contributions.scrapers.persons.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'contributions.scrapers.companies.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: CompanyScraperProviderRegistration },
    RpcNoPayload
  >
  'contributions.scrapers.companies.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'contributions.scrapers.characters.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: CharacterScraperProviderRegistration },
    RpcNoPayload
  >
  'contributions.scrapers.characters.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'contributions.deeplinks.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: DeeplinkContributionRegistration },
    RpcNoPayload
  >
  'contributions.deeplinks.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
    RpcNoPayload
  >
  'contributions.themes.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { theme: ThemeContribution },
    RpcNoPayload
  >
  'contributions.themes.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { themeId: string },
    RpcNoPayload
  >
  'contributions.commands.register': RpcMethodDefinition<CommandRegisterRequest, RpcNoPayload>
  'contributions.commands.unregister': RpcMethodDefinition<CommandUnregisterRequest, RpcNoPayload>
}
