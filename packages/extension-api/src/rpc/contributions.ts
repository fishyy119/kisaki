import type { CommandInvocationSource } from '../capabilities/commands'
import type { CardActionContribution } from '../contributions/card-actions'
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
  AnimeScraperLookup,
  AnimeScraperSlot,
  AnimeSessionResultMap,
  AnimeSearchResult,
  CharacterScraperSlot,
  CharacterSessionResultMap,
  CharacterSearchResult,
  ComicScraperLookup,
  ComicScraperSlot,
  ComicSessionResultMap,
  ComicSearchResult,
  CompanyScraperSlot,
  CompanySessionResultMap,
  CompanySearchResult,
  GameScraperLookup,
  GameScraperSlot,
  GameSessionResultMap,
  GameSearchResult,
  IdResolvedTarget,
  NovelScraperLookup,
  NovelScraperSlot,
  NovelSessionResultMap,
  NovelSearchResult,
  PersonScraperSlot,
  PersonSessionResultMap,
  PersonSearchResult,
  ScraperCapability,
  ScraperLookup,
  ScraperEntityType,
  ScraperSessionResult
} from '../contributions/scraper-providers'
import type { ThemeContribution } from '../contributions/themes'
import type { WebviewDialogContribution, WebviewPageContribution } from '../contributions/webviews'
import type { ExtensionHookPointId } from '../contributions/hooks'
import type { ContentLocale, JsonObject, JsonValue, UiCallbackResult } from '../shared'
import type { RpcMethodDefinition, RpcNoPayload } from './core'
import type { ContributionScopedRpcParams, ExtensionScopedRpcParams } from './lifecycle'

export type EntityMenuRegistrationInfo = {
  [TDomain in EntityMenuDomain]: {
    [TScope in EntityMenuScope<TDomain>]: {
      id: string
      domain: TDomain
      scope: TScope
      order?: number | undefined
    }
  }[EntityMenuScope<TDomain>]
}[EntityMenuDomain]

export interface EntityMenuScopedRpcParams extends ExtensionScopedRpcParams {
  contributionId: string
  domain: EntityMenuDomain
  scope: EntityMenuRegistrationInfo['scope']
}

export type CardActionRegistrationInfo = Omit<CardActionContribution, 'run'>

export interface DeeplinkRouteRegistrationInfo {
  id: string
  path: string
  urlPattern: string
  /** Whether a matching deeplink surfaces the main window before handling. */
  focus: boolean
}

export interface GameScraperProviderRegistrationInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ScraperCapability<GameScraperSlot>[]
}

export interface AnimeScraperProviderRegistrationInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ScraperCapability<AnimeScraperSlot>[]
}

export interface ComicScraperProviderRegistrationInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ScraperCapability<ComicScraperSlot>[]
}

export interface NovelScraperProviderRegistrationInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ScraperCapability<NovelScraperSlot>[]
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
  nodes: readonly JsonObject[]
}

export type EntityMenuInvokeRequest = EntityMenuScopedRpcParams & {
  sessionId: string
  nodePath: readonly string[]
  input: EntityMenuInput
  value?: boolean | string | undefined
}

export interface EntityMenuReleaseRequest {
  sessionId: string
}

export type EntityMenuRefreshRequestedNotification = EntityMenuScopedRpcParams & {
  reason?: EntityMenuRefreshReason | undefined
}

export interface DeeplinkRouteHandleRequest extends ContributionScopedRpcParams {
  event: DeeplinkRouteHandleEvent
}

export type DeeplinkRouteHandleResponse = DeeplinkRouteHandleResult

export interface CommandExecuteRequest extends ExtensionScopedRpcParams {
  commandId: string
  args: JsonObject
  source: CommandInvocationSource
}

export interface CommandExecuteResponse {
  output?: Exclude<CommandContributionExecuteResult, void> | undefined
}

type ScraperProviderScopedRpcParamsFor<TEntityType extends ScraperEntityType> =
  ExtensionScopedRpcParams & {
    entityType: TEntityType
    providerId: string
  }

export type ScraperProviderScopedRpcParams =
  | ScraperProviderScopedRpcParamsFor<'game'>
  | ScraperProviderScopedRpcParamsFor<'anime'>
  | ScraperProviderScopedRpcParamsFor<'comic'>
  | ScraperProviderScopedRpcParamsFor<'novel'>
  | ScraperProviderScopedRpcParamsFor<'person'>
  | ScraperProviderScopedRpcParamsFor<'company'>
  | ScraperProviderScopedRpcParamsFor<'character'>

export type ScraperProviderRegisterRequest =
  | (ExtensionScopedRpcParams & {
      entityType: 'game'
      provider: GameScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      entityType: 'anime'
      provider: AnimeScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      entityType: 'comic'
      provider: ComicScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      entityType: 'novel'
      provider: NovelScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      entityType: 'person'
      provider: PersonScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      entityType: 'company'
      provider: CompanyScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      entityType: 'character'
      provider: CharacterScraperProviderRegistrationInfo
    })

export type ScraperProviderUnregisterRequest = ScraperProviderScopedRpcParams

export type ScraperProviderSearchRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      query: string
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'anime'> & {
      query: string
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'comic'> & {
      query: string
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'novel'> & {
      query: string
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'person'> & {
      query: string
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'company'> & {
      query: string
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'character'> & {
      query: string
      locale: ContentLocale
    })

export type ScraperProviderSearchResponse =
  | { entityType: 'game'; results: readonly GameSearchResult[] }
  | { entityType: 'anime'; results: readonly AnimeSearchResult[] }
  | { entityType: 'comic'; results: readonly ComicSearchResult[] }
  | { entityType: 'novel'; results: readonly NovelSearchResult[] }
  | { entityType: 'person'; results: readonly PersonSearchResult[] }
  | { entityType: 'company'; results: readonly CompanySearchResult[] }
  | { entityType: 'character'; results: readonly CharacterSearchResult[] }

export type ScraperProviderResolveRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      lookup: GameScraperLookup
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'anime'> & {
      lookup: AnimeScraperLookup
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'comic'> & {
      lookup: ComicScraperLookup
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'novel'> & {
      lookup: NovelScraperLookup
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'person'> & {
      lookup: ScraperLookup
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'company'> & {
      lookup: ScraperLookup
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'character'> & {
      lookup: ScraperLookup
      locale: ContentLocale
    })

export type ScraperProviderResolveResponse =
  | { entityType: 'game'; target: IdResolvedTarget | null }
  | { entityType: 'anime'; target: IdResolvedTarget | null }
  | { entityType: 'comic'; target: IdResolvedTarget | null }
  | { entityType: 'novel'; target: IdResolvedTarget | null }
  | { entityType: 'person'; target: IdResolvedTarget | null }
  | { entityType: 'company'; target: IdResolvedTarget | null }
  | { entityType: 'character'; target: IdResolvedTarget | null }

export type ScraperProviderSessionOpenRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      target: IdResolvedTarget
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'anime'> & {
      target: IdResolvedTarget
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'comic'> & {
      target: IdResolvedTarget
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'novel'> & {
      target: IdResolvedTarget
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'person'> & {
      target: IdResolvedTarget
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'company'> & {
      target: IdResolvedTarget
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'character'> & {
      target: IdResolvedTarget
      locale: ContentLocale
    })

export type ScraperProviderSessionOpenResponse =
  | { entityType: 'game'; sessionId: string }
  | { entityType: 'anime'; sessionId: string }
  | { entityType: 'comic'; sessionId: string }
  | { entityType: 'novel'; sessionId: string }
  | { entityType: 'person'; sessionId: string }
  | { entityType: 'company'; sessionId: string }
  | { entityType: 'character'; sessionId: string }

export type ScraperProviderSessionGetRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      sessionId: string
      slots: readonly GameScraperSlot[]
    })
  | (ScraperProviderScopedRpcParamsFor<'anime'> & {
      sessionId: string
      slots: readonly AnimeScraperSlot[]
    })
  | (ScraperProviderScopedRpcParamsFor<'comic'> & {
      sessionId: string
      slots: readonly ComicScraperSlot[]
    })
  | (ScraperProviderScopedRpcParamsFor<'novel'> & {
      sessionId: string
      slots: readonly NovelScraperSlot[]
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
  | { entityType: 'game'; result: ScraperSessionResult<GameSessionResultMap> }
  | { entityType: 'anime'; result: ScraperSessionResult<AnimeSessionResultMap> }
  | { entityType: 'comic'; result: ScraperSessionResult<ComicSessionResultMap> }
  | { entityType: 'novel'; result: ScraperSessionResult<NovelSessionResultMap> }
  | { entityType: 'person'; result: ScraperSessionResult<PersonSessionResultMap> }
  | { entityType: 'company'; result: ScraperSessionResult<CompanySessionResultMap> }
  | { entityType: 'character'; result: ScraperSessionResult<CharacterSessionResultMap> }

export type ScraperProviderSessionCloseRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'anime'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'comic'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'novel'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'person'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'company'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'character'> & { sessionId: string })

export interface HookRegistrationInfo {
  registrationId: string
  pointId: ExtensionHookPointId
  priority?: number | undefined
}

export interface HookRegisterRequest extends ExtensionScopedRpcParams {
  hook: HookRegistrationInfo
}

export interface HookUnregisterRequest extends ExtensionScopedRpcParams {
  registrationId: string
}

/** Main -> host round trip for waterfall, veto, and awaited notify points. */
export interface HookInvokeRequest extends ExtensionScopedRpcParams {
  registrationId: string
  pointId: ExtensionHookPointId
  payload: JsonValue
}

export interface HookInvokeResponse {
  /**
   * Waterfall: the transformed value. Veto: the veto result or null.
   * Awaited notify: null.
   */
  result: JsonValue | null
}

/** Main -> host one-way delivery for pure notify points. */
export interface HookNotifyEvent {
  runtimeHandle: string
  registrationId: string
  pointId: ExtensionHookPointId
  payload: JsonValue
}

export interface MainToHostContributionRpcRequestMap {
  'contributions.entityMenus.resolve': RpcMethodDefinition<
    EntityMenuResolveRequest,
    EntityMenuResolveResponse
  >
  'contributions.entityMenus.invoke': RpcMethodDefinition<EntityMenuInvokeRequest, UiCallbackResult>
  'contributions.entityMenus.release': RpcMethodDefinition<EntityMenuReleaseRequest, RpcNoPayload>
  'contributions.cardActions.run': RpcMethodDefinition<ContributionScopedRpcParams, RpcNoPayload>
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
  'contributions.hooks.invoke': RpcMethodDefinition<HookInvokeRequest, HookInvokeResponse>
}

export interface MainToHostContributionRpcEventMap {
  'contributions.hooks.notify': HookNotifyEvent
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
  'contributions.cardActions.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { action: CardActionRegistrationInfo },
    RpcNoPayload
  >
  'contributions.cardActions.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
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
  'contributions.webviews.registerPage': RpcMethodDefinition<
    ExtensionScopedRpcParams & { page: WebviewPageContribution },
    RpcNoPayload
  >
  'contributions.webviews.unregisterPage': RpcMethodDefinition<
    ExtensionScopedRpcParams & { pageId: string },
    RpcNoPayload
  >
  'contributions.webviews.registerDialog': RpcMethodDefinition<
    ExtensionScopedRpcParams & { dialog: WebviewDialogContribution },
    RpcNoPayload
  >
  'contributions.webviews.unregisterDialog': RpcMethodDefinition<
    ExtensionScopedRpcParams & { dialogId: string },
    RpcNoPayload
  >
  'contributions.hooks.register': RpcMethodDefinition<HookRegisterRequest, RpcNoPayload>
  'contributions.hooks.unregister': RpcMethodDefinition<HookUnregisterRequest, RpcNoPayload>
}
