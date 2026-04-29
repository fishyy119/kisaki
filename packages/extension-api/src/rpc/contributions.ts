import type { DeeplinkRequest, DeeplinkResponse } from '../contributions/deeplinks'
import type {
  EntityMenuItem,
  EntityMenuResolveInput,
  EntityMenuTarget
} from '../contributions/entity-menus'
import type {
  SettingsDialogTarget,
  SettingsInteractionResult,
  SettingsResolvedScreenModel
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
import type { Locale, SerializableValue, UiCallbackResult } from '../shared'
import type { RpcMethodDefinition, RpcNoPayload } from './core'
import type { ContributionScopedRpcParams, ExtensionScopedRpcParams } from './lifecycle'

export interface EntityMenuContributionRegistration {
  id: string
  target: EntityMenuTarget
  order?: number
}

export interface SettingsContributionRegistration {
  id: string
  title: string
  description?: string
  order?: number
  rootScreenId: string
}

export interface DeeplinkContributionRegistration {
  id: string
  route: string
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

export interface EntityMenuResolveRequest extends ContributionScopedRpcParams {
  sessionId: string
  input: EntityMenuResolveInput
}

export interface EntityMenuResolveResult {
  items: readonly EntityMenuItem[]
}

export interface EntityMenuInvokeRequest extends ContributionScopedRpcParams {
  sessionId: string
  callbackId: string
  input: EntityMenuResolveInput
  value?: boolean | string
}

export interface EntityMenuSessionReleaseRequest extends ContributionScopedRpcParams {
  sessionId: string
}

export interface SettingsSessionOpenRequest extends ExtensionScopedRpcParams {
  contributionId: string
  sessionId: string
}

export interface SettingsFrameOpenRequest extends ExtensionScopedRpcParams {
  contributionId: string
  sessionId: string
  target: SettingsDialogTarget
}

export interface SettingsFrameRefreshRequest extends ExtensionScopedRpcParams {
  contributionId: string
  sessionId: string
  frameId: string
}

export interface SettingsFrameResult {
  frameId: string
  screenId: string
  params: Record<string, SerializableValue>
  screen: SettingsResolvedScreenModel
}

export interface SettingsFrameSubmitRequest extends ExtensionScopedRpcParams {
  contributionId: string
  sessionId: string
  frameId: string
  values: Record<string, SerializableValue>
}

export interface SettingsFrameInvokeRequest extends ExtensionScopedRpcParams {
  contributionId: string
  sessionId: string
  frameId: string
  callbackId: string
  value?: SerializableValue
}

export interface SettingsInteractionResponse {
  result: SettingsInteractionResult
}

export interface SettingsFrameReleaseRequest extends ExtensionScopedRpcParams {
  contributionId: string
  sessionId: string
  frameId: string
}

export interface SettingsSessionReleaseRequest extends ExtensionScopedRpcParams {
  contributionId: string
  sessionId: string
}

export interface DeeplinkHandleRequest extends ContributionScopedRpcParams {
  input: DeeplinkRequest
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
      'scrapers.games',
      GameSearchResult,
      GameScraperSlot,
      GameSessionResultMap
    >,
    ScraperProviderRpcRequestMap<
      'scrapers.persons',
      PersonSearchResult,
      PersonScraperSlot,
      PersonSessionResultMap
    >,
    ScraperProviderRpcRequestMap<
      'scrapers.companies',
      CompanySearchResult,
      CompanyScraperSlot,
      CompanySessionResultMap
    >,
    ScraperProviderRpcRequestMap<
      'scrapers.characters',
      CharacterSearchResult,
      CharacterScraperSlot,
      CharacterSessionResultMap
    > {
  'entityMenus.resolve': RpcMethodDefinition<EntityMenuResolveRequest, EntityMenuResolveResult>
  'entityMenus.invoke': RpcMethodDefinition<EntityMenuInvokeRequest, UiCallbackResult>
  'entityMenus.session.release': RpcMethodDefinition<EntityMenuSessionReleaseRequest, RpcNoPayload>
  'settings.open': RpcMethodDefinition<SettingsSessionOpenRequest, SettingsFrameResult>
  'settings.frame.open': RpcMethodDefinition<SettingsFrameOpenRequest, SettingsFrameResult>
  'settings.frame.refresh': RpcMethodDefinition<SettingsFrameRefreshRequest, SettingsFrameResult>
  'settings.submit': RpcMethodDefinition<SettingsFrameSubmitRequest, SettingsInteractionResponse>
  'settings.invoke': RpcMethodDefinition<SettingsFrameInvokeRequest, SettingsInteractionResponse>
  'settings.frame.release': RpcMethodDefinition<SettingsFrameReleaseRequest, RpcNoPayload>
  'settings.session.release': RpcMethodDefinition<SettingsSessionReleaseRequest, RpcNoPayload>
  'deeplinks.handle': RpcMethodDefinition<DeeplinkHandleRequest, DeeplinkResponse>
}

export type HostToMainContributionRpcRequestMap = {
  'bridge.entityMenus.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: EntityMenuContributionRegistration },
    RpcNoPayload
  >
  'bridge.entityMenus.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
    RpcNoPayload
  >
  'bridge.settings.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: SettingsContributionRegistration },
    RpcNoPayload
  >
  'bridge.settings.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
    RpcNoPayload
  >
  'bridge.scrapers.games.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: GameScraperProviderRegistration },
    RpcNoPayload
  >
  'bridge.scrapers.games.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'bridge.scrapers.persons.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: PersonScraperProviderRegistration },
    RpcNoPayload
  >
  'bridge.scrapers.persons.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'bridge.scrapers.companies.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: CompanyScraperProviderRegistration },
    RpcNoPayload
  >
  'bridge.scrapers.companies.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'bridge.scrapers.characters.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { provider: CharacterScraperProviderRegistration },
    RpcNoPayload
  >
  'bridge.scrapers.characters.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { providerId: string },
    RpcNoPayload
  >
  'bridge.deeplinks.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: DeeplinkContributionRegistration },
    RpcNoPayload
  >
  'bridge.deeplinks.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
    RpcNoPayload
  >
  'bridge.themes.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { theme: ThemeContribution },
    RpcNoPayload
  >
  'bridge.themes.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { themeId: string },
    RpcNoPayload
  >
}
