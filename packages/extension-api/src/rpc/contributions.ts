import type { CommandExecutionSource } from '../capabilities/commands'
import type { CommandContribution } from '../contributions/commands'
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
import type { Locale, SerializableRecord, SerializableValue, UiCallbackResult } from '../shared'
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
  'contributions.entityMenus.resolve': RpcMethodDefinition<
    EntityMenuResolveRequest,
    EntityMenuResolveResult
  >
  'contributions.entityMenus.invoke': RpcMethodDefinition<EntityMenuInvokeRequest, UiCallbackResult>
  'contributions.entityMenus.session.release': RpcMethodDefinition<
    EntityMenuSessionReleaseRequest,
    RpcNoPayload
  >
  'contributions.settings.open': RpcMethodDefinition<
    SettingsSessionOpenRequest,
    SettingsFrameResult
  >
  'contributions.settings.frame.open': RpcMethodDefinition<
    SettingsFrameOpenRequest,
    SettingsFrameResult
  >
  'contributions.settings.frame.refresh': RpcMethodDefinition<
    SettingsFrameRefreshRequest,
    SettingsFrameResult
  >
  'contributions.settings.submit': RpcMethodDefinition<
    SettingsFrameSubmitRequest,
    SettingsInteractionResponse
  >
  'contributions.settings.invoke': RpcMethodDefinition<
    SettingsFrameInvokeRequest,
    SettingsInteractionResponse
  >
  'contributions.settings.frame.release': RpcMethodDefinition<
    SettingsFrameReleaseRequest,
    RpcNoPayload
  >
  'contributions.settings.session.release': RpcMethodDefinition<
    SettingsSessionReleaseRequest,
    RpcNoPayload
  >
  'contributions.deeplinks.handle': RpcMethodDefinition<DeeplinkHandleRequest, DeeplinkResponse>
  'contributions.commands.execute': RpcMethodDefinition<CommandExecuteRequest, CommandExecuteResult>
}

export type HostToMainContributionRpcRequestMap = {
  'contributions.entityMenus.register': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contribution: EntityMenuContributionRegistration },
    RpcNoPayload
  >
  'contributions.entityMenus.unregister': RpcMethodDefinition<
    ExtensionScopedRpcParams & { contributionId: string },
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
