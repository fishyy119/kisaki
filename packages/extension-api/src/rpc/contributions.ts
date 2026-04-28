import type { DeeplinkRequest, DeeplinkResponse } from '../contributions/deeplinks'
import type {
  EntityMenuItem,
  EntityMenuResolveInput,
  EntityMenuTarget
} from '../contributions/entity-menus'
import type { SettingsPanelResolvedNode } from '../contributions/settings-panels'
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

export interface SettingsPanelContributionRegistration {
  id: string
  title: string
  description?: string
  order?: number
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

export interface SettingsPanelResolveRequest extends ExtensionScopedRpcParams {
  panelId: string
  sessionId: string
}

export interface SettingsPanelResolveResult {
  nodes: readonly SettingsPanelResolvedNode[]
}

export interface SettingsPanelSubmitRequest extends ExtensionScopedRpcParams {
  panelId: string
  sessionId: string
  values: Record<string, SerializableValue>
}

export interface SettingsPanelInvokeRequest extends ExtensionScopedRpcParams {
  panelId: string
  sessionId: string
  callbackId: string
  value?: SerializableValue
}

export interface SettingsPanelSessionReleaseRequest extends ExtensionScopedRpcParams {
  panelId: string
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
  'settingsPanels.resolve': RpcMethodDefinition<
    SettingsPanelResolveRequest,
    SettingsPanelResolveResult
  >
  'settingsPanels.submit': RpcMethodDefinition<SettingsPanelSubmitRequest, UiCallbackResult>
  'settingsPanels.invoke': RpcMethodDefinition<SettingsPanelInvokeRequest, UiCallbackResult>
  'settingsPanels.session.release': RpcMethodDefinition<
    SettingsPanelSessionReleaseRequest,
    RpcNoPayload
  >
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
  'bridge.settingsPanels.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: SettingsPanelContributionRegistration },
    RpcNoPayload
  >
  'bridge.settingsPanels.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { panelId: string },
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
