import type {
  CommandExecutionProgressUpdate,
  CommandExecutionSource
} from '../capabilities/commands'
import type {
  CommandContribution,
  CommandContributionExecuteResult
} from '../contributions/commands'
import type {
  DeeplinkRouteHandleEvent,
  DeeplinkRouteHandleResult
} from '../contributions/deeplink-routes'
import type {
  EntityMenuDomain,
  EntityMenuInput,
  EntityMenuRefreshReason,
  EntityMenuScope
} from '../contributions/entity-menus'
import type {
  SettingsPanelDialogButtonResult,
  SettingsPanelDialogChangeResult,
  SettingsPanelDialogSize,
  SettingsPanelDialogSubmitResult,
  SettingsPanelPopoverActionResult,
  SettingsPanelRefreshReason,
  SettingsPanelRootButtonResult,
  SettingsPanelRootChangeResult,
  SettingsPanelRootSubmitResult
} from '../contributions/settings-panels'
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
  ScraperCapability,
  ScraperLookup,
  ScraperMediaType
} from '../contributions/scraper-providers'
import type { ThemeContribution } from '../contributions/themes'
import type { Locale, SerializableRecord, SerializableValue, UiCallbackResult } from '../shared'
import type { RpcMethodDefinition, RpcNoPayload } from './core'
import type { ContributionScopedRpcParams, ExtensionScopedRpcParams } from './lifecycle'

export type EntityMenuRegistrationInfo = {
  [TDomain in EntityMenuDomain]: {
    [TScope in EntityMenuScope<TDomain>]: {
      id: string
      domain: TDomain
      scope: TScope
      order?: number
    }
  }[EntityMenuScope<TDomain>]
}[EntityMenuDomain]

export interface EntityMenuScopedRpcParams extends ExtensionScopedRpcParams {
  contributionId: string
  domain: EntityMenuDomain
  scope: EntityMenuRegistrationInfo['scope']
}

export interface SettingsPanelRegistrationInfo {
  id: string
  title: string
  description?: string
  size?: SettingsPanelDialogSize
  order?: number
}

export interface DeeplinkRouteRegistrationInfo {
  id: string
  path: string
  urlPattern: string
}

export interface GameScraperProviderRegistrationInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ScraperCapability<GameScraperSlot>[]
}

export interface PersonScraperProviderRegistrationInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ScraperCapability<PersonScraperSlot>[]
}

export interface CompanyScraperProviderRegistrationInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ScraperCapability<CompanyScraperSlot>[]
}

export interface CharacterScraperProviderRegistrationInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ScraperCapability<CharacterScraperSlot>[]
}

export type CommandContributionRegistrationInfo = Omit<CommandContribution, 'execute'>

export interface CommandRegisterRequest extends ExtensionScopedRpcParams {
  command: CommandContributionRegistrationInfo
}

export interface CommandUnregisterRequest extends ExtensionScopedRpcParams {
  commandId: string
}

export type EntityMenuResolveRequest = EntityMenuScopedRpcParams & {
  sessionId: string
  input: EntityMenuInput
}

export interface EntityMenuResolveResponse {
  nodes: readonly SerializableRecord[]
}

export type EntityMenuInvokeRequest = EntityMenuScopedRpcParams & {
  sessionId: string
  nodePath: readonly string[]
  input: EntityMenuInput
  value?: boolean | string
}

export interface EntityMenuReleaseRequest {
  sessionId: string
}

export type EntityMenuRefreshRequestedNotification = EntityMenuScopedRpcParams & {
  reason?: EntityMenuRefreshReason
}

export type SettingsPanelRpcSurface = 'root' | 'dialog' | 'popover'
export type SettingsPanelRpcScope = SettingsPanelRpcSurface | 'all'

export interface SettingsPanelDraftSnapshot {
  values: SerializableRecord
  dirtyNodeIds: readonly string[]
}

export type SettingsPanelParentRef = { surface: 'root' } | { surface: 'dialog'; dialogId: string }

export interface SettingsPanelSessionRef extends ContributionScopedRpcParams {
  sessionId: string
}

export type SettingsPanelOpenRequest =
  | (ContributionScopedRpcParams & {
      surface: 'root'
      sessionId: string
      reason?: SettingsPanelRefreshReason
    })
  | (SettingsPanelSessionRef & {
      surface: 'dialog'
      dialogId: string
      params?: SerializableRecord
      parentDraft: SettingsPanelDraftSnapshot
      revision: number
    })
  | (SettingsPanelSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: SettingsPanelParentRef
      params?: SerializableRecord
      parentDraft: SettingsPanelDraftSnapshot
      anchorNodeKey: string
      revision: number
    })

export type SettingsPanelRefreshRequest =
  | (SettingsPanelSessionRef & {
      surface: 'root'
      draft: SettingsPanelDraftSnapshot
      reason?: SettingsPanelRefreshReason
      revision: number
    })
  | (SettingsPanelSessionRef & {
      surface: 'dialog'
      dialogId: string
      draft: SettingsPanelDraftSnapshot
      parentDraft: SettingsPanelDraftSnapshot
      reason?: SettingsPanelRefreshReason
      revision: number
    })
  | (SettingsPanelSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: SettingsPanelParentRef
      draft: SettingsPanelDraftSnapshot
      parentDraft: SettingsPanelDraftSnapshot
      reason?: SettingsPanelRefreshReason
      revision: number
    })
  | (SettingsPanelSessionRef & {
      surface: 'all'
      rootDraft: SettingsPanelDraftSnapshot
      activeDialog?: {
        dialogId: string
        draft: SettingsPanelDraftSnapshot
      }
      reason?: SettingsPanelRefreshReason
      revision: number
    })

export type SettingsPanelSubmitRequest =
  | (SettingsPanelSessionRef & {
      surface: 'root'
      draft: SettingsPanelDraftSnapshot
      revision: number
    })
  | (SettingsPanelSessionRef & {
      surface: 'dialog'
      dialogId: string
      draft: SettingsPanelDraftSnapshot
      parentDraft: SettingsPanelDraftSnapshot
      revision: number
    })

export interface SettingsPanelInvokeBase extends SettingsPanelSessionRef {
  callbackId: string
  fieldId: string
  nodeId: string
  value?: SerializableValue
  requestId: string
  revision: number
}

export type SettingsPanelInvokeRequest =
  | (SettingsPanelInvokeBase & {
      surface: 'root'
      draft: SettingsPanelDraftSnapshot
    })
  | (SettingsPanelInvokeBase & {
      surface: 'dialog'
      dialogId: string
      draft: SettingsPanelDraftSnapshot
      parentDraft: SettingsPanelDraftSnapshot
    })
  | (SettingsPanelInvokeBase & {
      surface: 'popover'
      popoverId: string
      parent: SettingsPanelParentRef
      draft: SettingsPanelDraftSnapshot
      parentDraft: SettingsPanelDraftSnapshot
    })

export type SettingsPanelReleaseRequest =
  | (SettingsPanelSessionRef & { surface: 'root' | 'all' })
  | (SettingsPanelSessionRef & { surface: 'dialog'; dialogId: string })
  | (SettingsPanelSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: SettingsPanelParentRef
    })

export type SettingsPanelResolvedSurfacePayload = SerializableRecord

export type SettingsPanelOpenResponse =
  | {
      surface: 'root'
      sessionId: string
      view: SettingsPanelResolvedSurfacePayload
    }
  | {
      surface: 'dialog'
      dialog: SettingsPanelResolvedSurfacePayload
    }
  | {
      surface: 'popover'
      popover: SettingsPanelResolvedSurfacePayload
    }

export type SettingsPanelRefreshResponse =
  | SettingsPanelOpenResponse
  | {
      surface: 'all'
      sessionId: string
      view: SettingsPanelResolvedSurfacePayload
      activeDialog?: {
        dialogId: string
        dialog: SettingsPanelResolvedSurfacePayload
      }
    }

export type SettingsPanelCallbackResult =
  | SettingsPanelRootChangeResult
  | SettingsPanelDialogChangeResult
  | SettingsPanelPopoverActionResult
  | SettingsPanelRootButtonResult
  | SettingsPanelDialogButtonResult
  | SettingsPanelRootSubmitResult
  | SettingsPanelDialogSubmitResult

export interface SettingsPanelCallbackResponse {
  result: SettingsPanelCallbackResult
}

export interface SettingsPanelRefreshRequestedNotification extends ExtensionScopedRpcParams {
  contributionId: string
  reason?: SettingsPanelRefreshReason
}

export interface DeeplinkRouteHandleRequest extends ContributionScopedRpcParams {
  event: DeeplinkRouteHandleEvent
}

export type DeeplinkRouteHandleResponse = DeeplinkRouteHandleResult

export interface CommandExecuteRequest extends ExtensionScopedRpcParams {
  commandId: string
  executionId: string
  args: SerializableRecord
  source: CommandExecutionSource
}

export interface CommandExecuteResponse {
  output?: Exclude<CommandContributionExecuteResult, void>
}

export interface CommandProgressReportRequest extends ExtensionScopedRpcParams {
  commandId: string
  executionId: string
  progress: CommandExecutionProgressUpdate
}

type ScraperProviderScopedRpcParamsFor<TMediaType extends ScraperMediaType> =
  ExtensionScopedRpcParams & {
    mediaType: TMediaType
    providerId: string
  }

export type ScraperProviderScopedRpcParams =
  | ScraperProviderScopedRpcParamsFor<'game'>
  | ScraperProviderScopedRpcParamsFor<'person'>
  | ScraperProviderScopedRpcParamsFor<'company'>
  | ScraperProviderScopedRpcParamsFor<'character'>

export type ScraperProviderRegisterRequest =
  | (ExtensionScopedRpcParams & {
      mediaType: 'game'
      provider: GameScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      mediaType: 'person'
      provider: PersonScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      mediaType: 'company'
      provider: CompanyScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      mediaType: 'character'
      provider: CharacterScraperProviderRegistrationInfo
    })

export type ScraperProviderUnregisterRequest = ScraperProviderScopedRpcParams

export type ScraperProviderSearchRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      query: string
      locale?: Locale
    })
  | (ScraperProviderScopedRpcParamsFor<'person'> & {
      query: string
      locale?: Locale
    })
  | (ScraperProviderScopedRpcParamsFor<'company'> & {
      query: string
      locale?: Locale
    })
  | (ScraperProviderScopedRpcParamsFor<'character'> & {
      query: string
      locale?: Locale
    })

export type ScraperProviderSearchResponse =
  | { mediaType: 'game'; results: readonly GameSearchResult[] }
  | { mediaType: 'person'; results: readonly PersonSearchResult[] }
  | { mediaType: 'company'; results: readonly CompanySearchResult[] }
  | { mediaType: 'character'; results: readonly CharacterSearchResult[] }

export type ScraperProviderResolveRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      lookup: ScraperLookup
      locale: Locale
    })
  | (ScraperProviderScopedRpcParamsFor<'person'> & {
      lookup: ScraperLookup
      locale: Locale
    })
  | (ScraperProviderScopedRpcParamsFor<'company'> & {
      lookup: ScraperLookup
      locale: Locale
    })
  | (ScraperProviderScopedRpcParamsFor<'character'> & {
      lookup: ScraperLookup
      locale: Locale
    })

export type ScraperProviderResolveResponse =
  | { mediaType: 'game'; target: IdResolvedTarget | null }
  | { mediaType: 'person'; target: IdResolvedTarget | null }
  | { mediaType: 'company'; target: IdResolvedTarget | null }
  | { mediaType: 'character'; target: IdResolvedTarget | null }

export type ScraperProviderSessionOpenRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      target: IdResolvedTarget
      locale: Locale
    })
  | (ScraperProviderScopedRpcParamsFor<'person'> & {
      target: IdResolvedTarget
      locale: Locale
    })
  | (ScraperProviderScopedRpcParamsFor<'company'> & {
      target: IdResolvedTarget
      locale: Locale
    })
  | (ScraperProviderScopedRpcParamsFor<'character'> & {
      target: IdResolvedTarget
      locale: Locale
    })

export type ScraperProviderSessionOpenResponse =
  | { mediaType: 'game'; sessionId: string }
  | { mediaType: 'person'; sessionId: string }
  | { mediaType: 'company'; sessionId: string }
  | { mediaType: 'character'; sessionId: string }

export type ScraperProviderSessionGetRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      sessionId: string
      slots: readonly GameScraperSlot[]
    })
  | (ScraperProviderScopedRpcParamsFor<'person'> & {
      sessionId: string
      slots: readonly PersonScraperSlot[]
    })
  | (ScraperProviderScopedRpcParamsFor<'company'> & {
      sessionId: string
      slots: readonly CompanyScraperSlot[]
    })
  | (ScraperProviderScopedRpcParamsFor<'character'> & {
      sessionId: string
      slots: readonly CharacterScraperSlot[]
    })

export type ScraperProviderSessionGetResponse =
  | { mediaType: 'game'; results: Partial<GameSessionResultMap> }
  | { mediaType: 'person'; results: Partial<PersonSessionResultMap> }
  | { mediaType: 'company'; results: Partial<CompanySessionResultMap> }
  | { mediaType: 'character'; results: Partial<CharacterSessionResultMap> }

export type ScraperProviderSessionCloseRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'person'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'company'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'character'> & { sessionId: string })

export interface MainToHostContributionRpcRequestMap {
  'contributions.entityMenus.resolve': RpcMethodDefinition<
    EntityMenuResolveRequest,
    EntityMenuResolveResponse
  >
  'contributions.entityMenus.invoke': RpcMethodDefinition<EntityMenuInvokeRequest, UiCallbackResult>
  'contributions.entityMenus.release': RpcMethodDefinition<EntityMenuReleaseRequest, RpcNoPayload>
  'contributions.settingsPanels.open': RpcMethodDefinition<
    SettingsPanelOpenRequest,
    SettingsPanelOpenResponse
  >
  'contributions.settingsPanels.refresh': RpcMethodDefinition<
    SettingsPanelRefreshRequest,
    SettingsPanelRefreshResponse
  >
  'contributions.settingsPanels.submit': RpcMethodDefinition<
    SettingsPanelSubmitRequest,
    SettingsPanelCallbackResponse
  >
  'contributions.settingsPanels.invoke': RpcMethodDefinition<
    SettingsPanelInvokeRequest,
    SettingsPanelCallbackResponse
  >
  'contributions.settingsPanels.release': RpcMethodDefinition<
    SettingsPanelReleaseRequest,
    RpcNoPayload
  >
  'contributions.scraperProviders.search': RpcMethodDefinition<
    ScraperProviderSearchRequest,
    ScraperProviderSearchResponse
  >
  'contributions.scraperProviders.resolve': RpcMethodDefinition<
    ScraperProviderResolveRequest,
    ScraperProviderResolveResponse
  >
  'contributions.scraperProviders.session.open': RpcMethodDefinition<
    ScraperProviderSessionOpenRequest,
    ScraperProviderSessionOpenResponse
  >
  'contributions.scraperProviders.session.get': RpcMethodDefinition<
    ScraperProviderSessionGetRequest,
    ScraperProviderSessionGetResponse
  >
  'contributions.scraperProviders.session.close': RpcMethodDefinition<
    ScraperProviderSessionCloseRequest,
    RpcNoPayload
  >
  'contributions.deeplinkRoutes.handle': RpcMethodDefinition<
    DeeplinkRouteHandleRequest,
    DeeplinkRouteHandleResponse
  >
  'contributions.commands.execute': RpcMethodDefinition<
    CommandExecuteRequest,
    CommandExecuteResponse
  >
}

export type HostToMainContributionRpcRequestMap = {
  'contributions.entityMenus.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { menu: EntityMenuRegistrationInfo },
    RpcNoPayload
  >
  'contributions.entityMenus.unregister': RpcMethodDefinition<
    EntityMenuScopedRpcParams,
    RpcNoPayload
  >
  'contributions.entityMenus.refreshRequested': RpcMethodDefinition<
    EntityMenuRefreshRequestedNotification,
    RpcNoPayload
  >
  'contributions.settingsPanels.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { panel: SettingsPanelRegistrationInfo },
    RpcNoPayload
  >
  'contributions.settingsPanels.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
    RpcNoPayload
  >
  'contributions.settingsPanels.refreshRequested': RpcMethodDefinition<
    SettingsPanelRefreshRequestedNotification,
    RpcNoPayload
  >
  'contributions.scraperProviders.register': RpcMethodDefinition<
    ScraperProviderRegisterRequest,
    RpcNoPayload
  >
  'contributions.scraperProviders.unregister': RpcMethodDefinition<
    ScraperProviderUnregisterRequest,
    RpcNoPayload
  >
  'contributions.deeplinkRoutes.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { route: DeeplinkRouteRegistrationInfo },
    RpcNoPayload
  >
  'contributions.deeplinkRoutes.unregister': RpcMethodDefinition<
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
  'contributions.commands.reportProgress': RpcMethodDefinition<
    CommandProgressReportRequest,
    RpcNoPayload
  >
}
