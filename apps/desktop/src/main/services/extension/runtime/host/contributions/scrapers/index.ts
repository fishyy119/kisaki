import { randomUUID } from 'node:crypto'
import {
  type CharacterScraperProvider,
  type CharacterScraperSession,
  type CharacterScraperSlot,
  type CompanyScraperProvider,
  type CompanyScraperSession,
  type CompanyScraperSlot,
  type GameScraperProvider,
  type GameScraperSession,
  type GameScraperSlot,
  type PersonScraperProvider,
  type PersonScraperSession,
  type PersonScraperSlot,
  type ScraperSessionCloseRequest,
  type ScraperSessionGetRequest,
  type ScraperSessionOpenRequest,
  type ScraperSearchRequest,
  type ScraperResolveRequest,
  validateCharacterScraperProviderShape,
  validateCharacterScraperSearchResults,
  validateCharacterScraperSessionResults,
  validateCompanyScraperProviderShape,
  validateCompanyScraperSearchResults,
  validateCompanyScraperSessionResults,
  validateGameScraperProviderShape,
  validateGameScraperSearchResults,
  validateGameScraperSessionResults,
  validatePersonScraperProviderShape,
  validatePersonScraperSearchResults,
  validatePersonScraperSessionResults,
  validateScraperResolvedTarget,
  validateScraperSessionShape
} from '@kisaki/extension-api'
import {
  createContributionDisposable,
  requireRuntimeByScope,
  throwValidationIssues,
  type ContributionDisposable,
  type HostContributionDomainOptions,
  type HostContributionScope
} from '../types'
import type { LoadedExtensionRuntime } from '../../extension-registry'
import { HOST_TO_MAIN_SCRAPER_RPC, type ScraperRpcKind } from './descriptors'
import type {
  ScraperDomain,
  ScraperProviderLike,
  ScraperSessionLike,
  ScraperSessionRecord
} from './domain'
import { toScraperProviderRegistration } from './registrations'

export { MAIN_TO_HOST_SCRAPER_RPC, type ScraperRpcKind } from './descriptors'

export class HostScraperContributions {
  private readonly options: HostContributionDomainOptions
  private readonly gameSessions = new Map<string, ScraperSessionRecord<GameScraperSession>>()
  private readonly personSessions = new Map<string, ScraperSessionRecord<PersonScraperSession>>()
  private readonly companySessions = new Map<string, ScraperSessionRecord<CompanyScraperSession>>()
  private readonly characterSessions = new Map<
    string,
    ScraperSessionRecord<CharacterScraperSession>
  >()
  private readonly gameDomain: ScraperDomain<
    'games',
    GameScraperSlot,
    GameScraperSession,
    GameScraperProvider
  >
  private readonly personDomain: ScraperDomain<
    'persons',
    PersonScraperSlot,
    PersonScraperSession,
    PersonScraperProvider
  >
  private readonly companyDomain: ScraperDomain<
    'companies',
    CompanyScraperSlot,
    CompanyScraperSession,
    CompanyScraperProvider
  >
  private readonly characterDomain: ScraperDomain<
    'characters',
    CharacterScraperSlot,
    CharacterScraperSession,
    CharacterScraperProvider
  >

  constructor(options: HostContributionDomainOptions) {
    this.options = options
    this.gameDomain = {
      kind: 'games',
      mediaType: 'game',
      label: 'Game',
      rpc: HOST_TO_MAIN_SCRAPER_RPC.games,
      sessions: this.gameSessions,
      getProviders: (runtime) => runtime.gameScrapers,
      validate: validateGameScraperProviderShape,
      validateSearchResults: validateGameScraperSearchResults,
      validateResolvedTarget: validateScraperResolvedTarget,
      validateSession: validateScraperSessionShape,
      validateSessionResults: validateGameScraperSessionResults,
      toRegistration: (scope, provider) => ({
        runtimeHandle: scope.runtimeHandle,
        provider: toScraperProviderRegistration(provider, HOST_TO_MAIN_SCRAPER_RPC.games.slots)
      }),
      toUnregistration: (scope, providerId) => ({
        runtimeHandle: scope.runtimeHandle,
        providerId
      }),
      register: (scope, provider) =>
        this.options.registry.registerGameScraper(scope.extensionId, provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterGameScraper(scope.extensionId, providerId)
    }
    this.personDomain = {
      kind: 'persons',
      mediaType: 'person',
      label: 'Person',
      rpc: HOST_TO_MAIN_SCRAPER_RPC.persons,
      sessions: this.personSessions,
      getProviders: (runtime) => runtime.personScrapers,
      validate: validatePersonScraperProviderShape,
      validateSearchResults: validatePersonScraperSearchResults,
      validateResolvedTarget: validateScraperResolvedTarget,
      validateSession: validateScraperSessionShape,
      validateSessionResults: validatePersonScraperSessionResults,
      toRegistration: (scope, provider) => ({
        runtimeHandle: scope.runtimeHandle,
        provider: toScraperProviderRegistration(provider, HOST_TO_MAIN_SCRAPER_RPC.persons.slots)
      }),
      toUnregistration: (scope, providerId) => ({
        runtimeHandle: scope.runtimeHandle,
        providerId
      }),
      register: (scope, provider) =>
        this.options.registry.registerPersonScraper(scope.extensionId, provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterPersonScraper(scope.extensionId, providerId)
    }
    this.companyDomain = {
      kind: 'companies',
      mediaType: 'company',
      label: 'Company',
      rpc: HOST_TO_MAIN_SCRAPER_RPC.companies,
      sessions: this.companySessions,
      getProviders: (runtime) => runtime.companyScrapers,
      validate: validateCompanyScraperProviderShape,
      validateSearchResults: validateCompanyScraperSearchResults,
      validateResolvedTarget: validateScraperResolvedTarget,
      validateSession: validateScraperSessionShape,
      validateSessionResults: validateCompanyScraperSessionResults,
      toRegistration: (scope, provider) => ({
        runtimeHandle: scope.runtimeHandle,
        provider: toScraperProviderRegistration(provider, HOST_TO_MAIN_SCRAPER_RPC.companies.slots)
      }),
      toUnregistration: (scope, providerId) => ({
        runtimeHandle: scope.runtimeHandle,
        providerId
      }),
      register: (scope, provider) =>
        this.options.registry.registerCompanyScraper(scope.extensionId, provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterCompanyScraper(scope.extensionId, providerId)
    }
    this.characterDomain = {
      kind: 'characters',
      mediaType: 'character',
      label: 'Character',
      rpc: HOST_TO_MAIN_SCRAPER_RPC.characters,
      sessions: this.characterSessions,
      getProviders: (runtime) => runtime.characterScrapers,
      validate: validateCharacterScraperProviderShape,
      validateSearchResults: validateCharacterScraperSearchResults,
      validateResolvedTarget: validateScraperResolvedTarget,
      validateSession: validateScraperSessionShape,
      validateSessionResults: validateCharacterScraperSessionResults,
      toRegistration: (scope, provider) => ({
        runtimeHandle: scope.runtimeHandle,
        provider: toScraperProviderRegistration(provider, HOST_TO_MAIN_SCRAPER_RPC.characters.slots)
      }),
      toUnregistration: (scope, providerId) => ({
        runtimeHandle: scope.runtimeHandle,
        providerId
      }),
      register: (scope, provider) =>
        this.options.registry.registerCharacterScraper(scope.extensionId, provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterCharacterScraper(scope.extensionId, providerId)
    }
  }

  registerGameProvider(
    scope: HostContributionScope,
    provider: GameScraperProvider
  ): ContributionDisposable {
    return this.registerProvider(scope, provider, this.gameDomain)
  }

  registerPersonProvider(
    scope: HostContributionScope,
    provider: PersonScraperProvider
  ): ContributionDisposable {
    return this.registerProvider(scope, provider, this.personDomain)
  }

  registerCompanyProvider(
    scope: HostContributionScope,
    provider: CompanyScraperProvider
  ): ContributionDisposable {
    return this.registerProvider(scope, provider, this.companyDomain)
  }

  registerCharacterProvider(
    scope: HostContributionScope,
    provider: CharacterScraperProvider
  ): ContributionDisposable {
    return this.registerProvider(scope, provider, this.characterDomain)
  }

  async unregisterGameProvider(
    scope: HostContributionScope,
    providerId: string,
    notifyMain: boolean
  ): Promise<void> {
    await this.unregisterProvider(scope, providerId, notifyMain, this.gameDomain)
  }

  async unregisterPersonProvider(
    scope: HostContributionScope,
    providerId: string,
    notifyMain: boolean
  ): Promise<void> {
    await this.unregisterProvider(scope, providerId, notifyMain, this.personDomain)
  }

  async unregisterCompanyProvider(
    scope: HostContributionScope,
    providerId: string,
    notifyMain: boolean
  ): Promise<void> {
    await this.unregisterProvider(scope, providerId, notifyMain, this.companyDomain)
  }

  async unregisterCharacterProvider(
    scope: HostContributionScope,
    providerId: string,
    notifyMain: boolean
  ): Promise<void> {
    await this.unregisterProvider(scope, providerId, notifyMain, this.characterDomain)
  }

  async searchGames(request: ScraperSearchRequest) {
    return this.searchProvider(this.gameDomain, request)
  }

  async resolveGame(request: ScraperResolveRequest) {
    return this.resolveProvider(this.gameDomain, request)
  }

  async openGameSession(request: ScraperSessionOpenRequest) {
    return this.openProviderSession(this.gameDomain, request)
  }

  async getGameSession(request: ScraperSessionGetRequest<GameScraperSlot>) {
    return this.getProviderSession(this.gameDomain, request)
  }

  async closeGameSession(request: ScraperSessionCloseRequest): Promise<void> {
    await this.closeProviderSession(this.gameDomain, request)
  }

  async searchPersons(request: ScraperSearchRequest) {
    return this.searchProvider(this.personDomain, request)
  }

  async resolvePerson(request: ScraperResolveRequest) {
    return this.resolveProvider(this.personDomain, request)
  }

  async openPersonSession(request: ScraperSessionOpenRequest) {
    return this.openProviderSession(this.personDomain, request)
  }

  async getPersonSession(request: ScraperSessionGetRequest<PersonScraperSlot>) {
    return this.getProviderSession(this.personDomain, request)
  }

  async closePersonSession(request: ScraperSessionCloseRequest): Promise<void> {
    await this.closeProviderSession(this.personDomain, request)
  }

  async searchCompanies(request: ScraperSearchRequest) {
    return this.searchProvider(this.companyDomain, request)
  }

  async resolveCompany(request: ScraperResolveRequest) {
    return this.resolveProvider(this.companyDomain, request)
  }

  async openCompanySession(request: ScraperSessionOpenRequest) {
    return this.openProviderSession(this.companyDomain, request)
  }

  async getCompanySession(request: ScraperSessionGetRequest<CompanyScraperSlot>) {
    return this.getProviderSession(this.companyDomain, request)
  }

  async closeCompanySession(request: ScraperSessionCloseRequest): Promise<void> {
    await this.closeProviderSession(this.companyDomain, request)
  }

  async searchCharacters(request: ScraperSearchRequest) {
    return this.searchProvider(this.characterDomain, request)
  }

  async resolveCharacter(request: ScraperResolveRequest) {
    return this.resolveProvider(this.characterDomain, request)
  }

  async openCharacterSession(request: ScraperSessionOpenRequest) {
    return this.openProviderSession(this.characterDomain, request)
  }

  async getCharacterSession(request: ScraperSessionGetRequest<CharacterScraperSlot>) {
    return this.getProviderSession(this.characterDomain, request)
  }

  async closeCharacterSession(request: ScraperSessionCloseRequest): Promise<void> {
    await this.closeProviderSession(this.characterDomain, request)
  }

  async releaseRuntime(runtimeHandle: string): Promise<void> {
    await Promise.all([
      this.closeRuntimeSessions(this.gameSessions, runtimeHandle, 'Game'),
      this.closeRuntimeSessions(this.personSessions, runtimeHandle, 'Person'),
      this.closeRuntimeSessions(this.companySessions, runtimeHandle, 'Company'),
      this.closeRuntimeSessions(this.characterSessions, runtimeHandle, 'Character')
    ])
  }

  async releaseAll(): Promise<void> {
    await Promise.all([
      this.closeAllSessions(this.gameSessions, 'Game'),
      this.closeAllSessions(this.personSessions, 'Person'),
      this.closeAllSessions(this.companySessions, 'Company'),
      this.closeAllSessions(this.characterSessions, 'Character')
    ])
  }

  private registerProvider<
    TKind extends ScraperRpcKind,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    scope: HostContributionScope,
    provider: TProvider,
    domain: ScraperDomain<TKind, TSlot, TSession, TProvider>
  ): ContributionDisposable {
    const issues = domain.validate(provider)
    if (issues.length > 0) {
      throwValidationIssues(`${domain.label} scraper provider`, issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (domain.getProviders(runtime).has(provider.id)) {
      throw new Error(`${domain.label} scraper provider "${provider.id}" is already registered.`)
    }

    domain.register(scope, provider)
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        domain.rpc.methods.register,
        domain.toRegistration(scope, provider),
        this.options.getRequestOptions(scope)
      )
    )

    return createContributionDisposable(async () => {
      await this.unregisterProvider(scope, provider.id, true, domain)
    })
  }

  private async unregisterProvider<
    TKind extends ScraperRpcKind,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    scope: HostContributionScope,
    providerId: string,
    notifyMain: boolean,
    domain: ScraperDomain<TKind, TSlot, TSession, TProvider>
  ): Promise<void> {
    await this.closeProviderSessions(domain.sessions, scope.runtimeHandle, providerId)
    domain.unregister(scope, providerId)
    await this.notifyProviderUnregistered(scope, domain, providerId, notifyMain)
  }

  private async searchProvider<
    TKind extends ScraperRpcKind,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TKind, TSlot, TSession, TProvider>,
    request: ScraperSearchRequest
  ): Promise<{ results: Awaited<ReturnType<TProvider['search']>> }> {
    const { runtime, provider } = this.requireProvider(
      domain,
      request.runtimeHandle,
      request.providerId
    )
    const results = await this.options.runInExtensionContext(runtime, () =>
      provider.search(request.query, request.locale)
    )
    this.assertValidProviderOutput(
      domain,
      runtime,
      request.providerId,
      'search results',
      domain.validateSearchResults(results)
    )

    return {
      results: results as Awaited<ReturnType<TProvider['search']>>
    }
  }

  private async resolveProvider<
    TKind extends ScraperRpcKind,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TKind, TSlot, TSession, TProvider>,
    request: ScraperResolveRequest
  ): Promise<{ target: Awaited<ReturnType<TProvider['resolve']>> }> {
    const { runtime, provider } = this.requireProvider(
      domain,
      request.runtimeHandle,
      request.providerId
    )
    const target = await this.options.runInExtensionContext(runtime, () =>
      provider.resolve(request.lookup, request.locale)
    )
    this.assertValidProviderOutput(
      domain,
      runtime,
      request.providerId,
      'resolve target',
      domain.validateResolvedTarget(target)
    )

    return {
      target: target as Awaited<ReturnType<TProvider['resolve']>>
    }
  }

  private async openProviderSession<
    TKind extends ScraperRpcKind,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TKind, TSlot, TSession, TProvider>,
    request: ScraperSessionOpenRequest
  ): Promise<{ sessionId: string }> {
    const { runtime, provider } = this.requireProvider(
      domain,
      request.runtimeHandle,
      request.providerId
    )
    const session = await this.options.runInExtensionContext(runtime, () =>
      provider.openSession(request.target, request.locale)
    )
    this.assertValidProviderOutput(
      domain,
      runtime,
      request.providerId,
      'session',
      domain.validateSession(session)
    )
    const sessionId = randomUUID()
    domain.sessions.set(sessionId, {
      runtimeHandle: request.runtimeHandle,
      providerId: request.providerId,
      session
    })

    return { sessionId }
  }

  private async getProviderSession<
    TKind extends ScraperRpcKind,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TKind, TSlot, TSession, TProvider>,
    request: ScraperSessionGetRequest<TSlot>
  ): Promise<{ results: Awaited<ReturnType<TSession['get']>> }> {
    const record = this.requireSession(domain.sessions, request)
    const runtime = this.requireRuntime(record.runtimeHandle)
    const results = await this.options.runInExtensionContext(runtime, () =>
      record.session.get(request.slots)
    )
    this.assertValidProviderOutput(
      domain,
      runtime,
      request.providerId,
      'session results',
      domain.validateSessionResults(results)
    )

    return {
      results: results as Awaited<ReturnType<TSession['get']>>
    }
  }

  private async closeProviderSession<
    TKind extends ScraperRpcKind,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TKind, TSlot, TSession, TProvider>,
    request: ScraperSessionCloseRequest
  ): Promise<void> {
    await this.closeSession(domain.sessions, request.sessionId)
  }

  private requireProvider<
    TKind extends ScraperRpcKind,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TKind, TSlot, TSession, TProvider>,
    runtimeHandle: string,
    providerId: string
  ): { runtime: LoadedExtensionRuntime; provider: TProvider } {
    const runtime = this.requireRuntime(runtimeHandle)
    const provider = domain.getProviders(runtime).get(providerId)
    if (!provider) {
      throw new Error(`${domain.label} scraper provider "${providerId}" is not registered.`)
    }

    return { runtime, provider }
  }

  private assertValidProviderOutput<
    TKind extends ScraperRpcKind,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TKind, TSlot, TSession, TProvider>,
    runtime: LoadedExtensionRuntime,
    providerId: string,
    operation: string,
    issues: readonly { path: string; message: string }[]
  ): void {
    if (issues.length === 0) {
      return
    }

    throwValidationIssues(
      `Extension "${runtime.metadata.id}" ${domain.label.toLowerCase()} scraper provider "${providerId}" ${operation}`,
      issues
    )
  }

  private requireRuntime(runtimeHandle: string) {
    const runtime = this.options.registry.getByRuntimeHandle(runtimeHandle)
    if (!runtime) {
      throw new Error(`Extension runtime "${runtimeHandle}" is not active.`)
    }
    return runtime
  }

  private requireSession<TSession extends { dispose?(): Promise<void> | void }>(
    sessions: Map<string, ScraperSessionRecord<TSession>>,
    request: ScraperSessionGetRequest<string>
  ): ScraperSessionRecord<TSession> {
    const record = sessions.get(request.sessionId)
    if (
      !record ||
      record.runtimeHandle !== request.runtimeHandle ||
      record.providerId !== request.providerId
    ) {
      throw new Error(`Scraper session "${request.sessionId}" is not active.`)
    }

    return record
  }

  private async closeSession<TSession extends { dispose?(): Promise<void> | void }>(
    sessions: Map<string, ScraperSessionRecord<TSession>>,
    sessionId: string
  ): Promise<void> {
    const record = sessions.get(sessionId)
    if (!record) {
      return
    }

    sessions.delete(sessionId)
    await this.disposeSession(record)
  }

  private async closeProviderSessions<TSession extends { dispose?(): Promise<void> | void }>(
    sessions: Map<string, ScraperSessionRecord<TSession>>,
    runtimeHandle: string,
    providerId: string
  ): Promise<void> {
    for (const [sessionId, record] of [...sessions]) {
      if (record.runtimeHandle === runtimeHandle && record.providerId === providerId) {
        await this.closeSession(sessions, sessionId)
      }
    }
  }

  private async closeRuntimeSessions<TSession extends { dispose?(): Promise<void> | void }>(
    sessions: Map<string, ScraperSessionRecord<TSession>>,
    runtimeHandle: string,
    label: string
  ): Promise<void> {
    for (const [sessionId, record] of [...sessions]) {
      if (record.runtimeHandle === runtimeHandle) {
        sessions.delete(sessionId)
        await this.disposeSession(record).catch((error) => {
          console.warn(
            `[ExtensionHost] Failed to dispose ${label.toLowerCase()} scraper session "${sessionId}" during runtime cleanup:`,
            error
          )
        })
      }
    }
  }

  private async closeAllSessions<TSession extends { dispose?(): Promise<void> | void }>(
    sessions: Map<string, ScraperSessionRecord<TSession>>,
    label: string
  ): Promise<void> {
    for (const [sessionId, record] of [...sessions]) {
      sessions.delete(sessionId)
      await this.disposeSession(record).catch((error) => {
        console.warn(
          `[ExtensionHost] Failed to dispose ${label.toLowerCase()} scraper session "${sessionId}" during host cleanup:`,
          error
        )
      })
    }
  }

  private async disposeSession<TSession extends { dispose?(): Promise<void> | void }>(
    record: ScraperSessionRecord<TSession>
  ): Promise<void> {
    if (!record.session.dispose) {
      return
    }

    const runtime = this.requireRuntime(record.runtimeHandle)
    await this.options.runInExtensionContext(runtime, () => record.session.dispose?.())
  }

  private async notifyProviderUnregistered<
    TKind extends ScraperRpcKind,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    scope: HostContributionScope,
    domain: ScraperDomain<TKind, TSlot, TSession, TProvider>,
    providerId: string,
    notifyMain: boolean
  ): Promise<void> {
    if (!notifyMain) {
      return
    }

    await this.options.rpc.requestMain(
      domain.rpc.methods.unregister,
      domain.toUnregistration(scope, providerId),
      this.options.getCleanupRequestOptions(scope)
    )
  }
}
