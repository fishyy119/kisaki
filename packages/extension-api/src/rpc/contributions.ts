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
  CompanyScraperSlot,
  CompanySessionResultMap,
  CompanySearchResult,
  GameScraperLookup,
  GameScraperSlot,
  GameSessionResultMap,
  GameSearchResult,
  IdResolvedTarget,
  MovieScraperLookup,
  MovieScraperSlot,
  MovieSessionResultMap,
  MovieSearchResult,
  PersonScraperSlot,
  PersonSessionResultMap,
  PersonSearchResult,
  ScraperCapability,
  ScraperLookup,
  ScraperMediaType,
  ScraperSessionResult,
  TvScraperLookup,
  TvScraperSlot,
  TvSessionResultMap,
  TvSearchResult
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
      order?: number
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

export interface TvScraperProviderRegistrationInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ScraperCapability<TvScraperSlot>[]
}

export interface MovieScraperProviderRegistrationInfo {
  id: string
  name: string
  externalIdSource: string
  capabilities: readonly ScraperCapability<MovieScraperSlot>[]
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
  value?: boolean | string
}

export interface EntityMenuReleaseRequest {
  sessionId: string
}

export type EntityMenuRefreshRequestedNotification = EntityMenuScopedRpcParams & {
  reason?: EntityMenuRefreshReason
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
  output?: Exclude<CommandContributionExecuteResult, void>
}

type ScraperProviderScopedRpcParamsFor<TMediaType extends ScraperMediaType> =
  ExtensionScopedRpcParams & {
    mediaType: TMediaType
    providerId: string
  }

export type ScraperProviderScopedRpcParams =
  | ScraperProviderScopedRpcParamsFor<'game'>
  | ScraperProviderScopedRpcParamsFor<'anime'>
  | ScraperProviderScopedRpcParamsFor<'tv'>
  | ScraperProviderScopedRpcParamsFor<'movie'>
  | ScraperProviderScopedRpcParamsFor<'person'>
  | ScraperProviderScopedRpcParamsFor<'company'>
  | ScraperProviderScopedRpcParamsFor<'character'>

export type ScraperProviderRegisterRequest =
  | (ExtensionScopedRpcParams & {
      mediaType: 'game'
      provider: GameScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      mediaType: 'anime'
      provider: AnimeScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      mediaType: 'tv'
      provider: TvScraperProviderRegistrationInfo
    })
  | (ExtensionScopedRpcParams & {
      mediaType: 'movie'
      provider: MovieScraperProviderRegistrationInfo
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
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'anime'> & {
      query: string
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'tv'> & {
      query: string
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'movie'> & {
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
  | { mediaType: 'game'; results: readonly GameSearchResult[] }
  | { mediaType: 'anime'; results: readonly AnimeSearchResult[] }
  | { mediaType: 'tv'; results: readonly TvSearchResult[] }
  | { mediaType: 'movie'; results: readonly MovieSearchResult[] }
  | { mediaType: 'person'; results: readonly PersonSearchResult[] }
  | { mediaType: 'company'; results: readonly CompanySearchResult[] }
  | { mediaType: 'character'; results: readonly CharacterSearchResult[] }

export type ScraperProviderResolveRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      lookup: GameScraperLookup
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'anime'> & {
      lookup: AnimeScraperLookup
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'tv'> & {
      lookup: TvScraperLookup
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'movie'> & {
      lookup: MovieScraperLookup
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
  | { mediaType: 'game'; target: IdResolvedTarget | null }
  | { mediaType: 'anime'; target: IdResolvedTarget | null }
  | { mediaType: 'tv'; target: IdResolvedTarget | null }
  | { mediaType: 'movie'; target: IdResolvedTarget | null }
  | { mediaType: 'person'; target: IdResolvedTarget | null }
  | { mediaType: 'company'; target: IdResolvedTarget | null }
  | { mediaType: 'character'; target: IdResolvedTarget | null }

export type ScraperProviderSessionOpenRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      target: IdResolvedTarget
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'anime'> & {
      target: IdResolvedTarget
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'tv'> & {
      target: IdResolvedTarget
      locale: ContentLocale
    })
  | (ScraperProviderScopedRpcParamsFor<'movie'> & {
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
  | { mediaType: 'game'; sessionId: string }
  | { mediaType: 'anime'; sessionId: string }
  | { mediaType: 'tv'; sessionId: string }
  | { mediaType: 'movie'; sessionId: string }
  | { mediaType: 'person'; sessionId: string }
  | { mediaType: 'company'; sessionId: string }
  | { mediaType: 'character'; sessionId: string }

export type ScraperProviderSessionGetRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & {
      sessionId: string
      slots: readonly GameScraperSlot[]
    })
  | (ScraperProviderScopedRpcParamsFor<'anime'> & {
      sessionId: string
      slots: readonly AnimeScraperSlot[]
    })
  | (ScraperProviderScopedRpcParamsFor<'tv'> & {
      sessionId: string
      slots: readonly TvScraperSlot[]
    })
  | (ScraperProviderScopedRpcParamsFor<'movie'> & {
      sessionId: string
      slots: readonly MovieScraperSlot[]
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
  | { mediaType: 'game'; result: ScraperSessionResult<GameSessionResultMap> }
  | { mediaType: 'anime'; result: ScraperSessionResult<AnimeSessionResultMap> }
  | { mediaType: 'tv'; result: ScraperSessionResult<TvSessionResultMap> }
  | { mediaType: 'movie'; result: ScraperSessionResult<MovieSessionResultMap> }
  | { mediaType: 'person'; result: ScraperSessionResult<PersonSessionResultMap> }
  | { mediaType: 'company'; result: ScraperSessionResult<CompanySessionResultMap> }
  | { mediaType: 'character'; result: ScraperSessionResult<CharacterSessionResultMap> }

export type ScraperProviderSessionCloseRequest =
  | (ScraperProviderScopedRpcParamsFor<'game'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'anime'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'tv'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'movie'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'person'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'company'> & { sessionId: string })
  | (ScraperProviderScopedRpcParamsFor<'character'> & { sessionId: string })

export interface HookRegistrationInfo {
  registrationId: string
  pointId: ExtensionHookPointId
  priority?: number
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
