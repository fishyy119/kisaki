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
  type ValidationIssue,
  validateCharacterScraperProviderShape,
  validateCompanyScraperProviderShape,
  validateGameScraperProviderShape,
  validatePersonScraperProviderShape
} from '@kisaki/extension-api'
import {
  createContributionDisposable,
  requireRuntimeByScope,
  throwValidationIssues,
  type ContributionDisposable,
  type HostContributionDomainOptions,
  type HostContributionScope
} from './types'
import type { LoadedExtensionRuntime } from '../extension-registry'

type ScraperKind = 'games' | 'persons' | 'companies' | 'characters'

interface ScraperSessionLike<TSlot extends string> {
  get(slots: readonly TSlot[]): Promise<unknown>
  dispose?(): Promise<void> | void
}

interface ScraperProviderLike<TSlot extends string, TSession extends ScraperSessionLike<TSlot>> {
  readonly id: string
  readonly name: string
  readonly capabilities: readonly unknown[]
  search(
    query: ScraperSearchRequest['query'],
    locale?: ScraperSearchRequest['locale']
  ): Promise<readonly unknown[]>
  resolve(
    lookup: ScraperResolveRequest['lookup'],
    locale: ScraperResolveRequest['locale']
  ): Promise<ScraperSessionOpenRequest['target'] | null>
  openSession(
    target: ScraperSessionOpenRequest['target'],
    locale: ScraperSessionOpenRequest['locale']
  ): Promise<TSession>
}

interface ScraperSessionRecord<TSession extends { dispose?(): Promise<void> | void }> {
  runtimeHandle: string
  providerId: string
  session: TSession
}

interface ScraperDomain<
  TSlot extends string,
  TSession extends ScraperSessionLike<TSlot>,
  TProvider extends ScraperProviderLike<TSlot, TSession>
> {
  kind: ScraperKind
  label: string
  sessions: Map<string, ScraperSessionRecord<TSession>>
  getProviders(runtime: LoadedExtensionRuntime): Map<string, TProvider>
  validate(provider: TProvider): readonly ValidationIssue[]
  register(scope: HostContributionScope, provider: TProvider): void
  unregister(scope: HostContributionScope, providerId: string): void
}

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
    GameScraperSlot,
    GameScraperSession,
    GameScraperProvider
  >
  private readonly personDomain: ScraperDomain<
    PersonScraperSlot,
    PersonScraperSession,
    PersonScraperProvider
  >
  private readonly companyDomain: ScraperDomain<
    CompanyScraperSlot,
    CompanyScraperSession,
    CompanyScraperProvider
  >
  private readonly characterDomain: ScraperDomain<
    CharacterScraperSlot,
    CharacterScraperSession,
    CharacterScraperProvider
  >

  constructor(options: HostContributionDomainOptions) {
    this.options = options
    this.gameDomain = {
      kind: 'games',
      label: 'Game',
      sessions: this.gameSessions,
      getProviders: (runtime) => runtime.gameScrapers,
      validate: validateGameScraperProviderShape,
      register: (scope, provider) =>
        this.options.registry.registerGameScraper(scope.extensionId, provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterGameScraper(scope.extensionId, providerId)
    }
    this.personDomain = {
      kind: 'persons',
      label: 'Person',
      sessions: this.personSessions,
      getProviders: (runtime) => runtime.personScrapers,
      validate: validatePersonScraperProviderShape,
      register: (scope, provider) =>
        this.options.registry.registerPersonScraper(scope.extensionId, provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterPersonScraper(scope.extensionId, providerId)
    }
    this.companyDomain = {
      kind: 'companies',
      label: 'Company',
      sessions: this.companySessions,
      getProviders: (runtime) => runtime.companyScrapers,
      validate: validateCompanyScraperProviderShape,
      register: (scope, provider) =>
        this.options.registry.registerCompanyScraper(scope.extensionId, provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterCompanyScraper(scope.extensionId, providerId)
    }
    this.characterDomain = {
      kind: 'characters',
      label: 'Character',
      sessions: this.characterSessions,
      getProviders: (runtime) => runtime.characterScrapers,
      validate: validateCharacterScraperProviderShape,
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

  releaseRuntime(runtimeHandle: string): void {
    this.deleteRuntimeSessions(this.gameSessions, runtimeHandle)
    this.deleteRuntimeSessions(this.personSessions, runtimeHandle)
    this.deleteRuntimeSessions(this.companySessions, runtimeHandle)
    this.deleteRuntimeSessions(this.characterSessions, runtimeHandle)
  }

  releaseAll(): void {
    this.gameSessions.clear()
    this.personSessions.clear()
    this.companySessions.clear()
    this.characterSessions.clear()
  }

  private registerProvider<
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    scope: HostContributionScope,
    provider: TProvider,
    domain: ScraperDomain<TSlot, TSession, TProvider>
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
        `bridge.scrapers.${domain.kind}.register` as never,
        {
          runtimeHandle: scope.runtimeHandle,
          provider: {
            id: provider.id,
            name: provider.name,
            capabilities: provider.capabilities as readonly ('search' | TSlot)[]
          }
        } as never,
        this.options.getRequestOptions(scope)
      )
    )

    return createContributionDisposable(async () => {
      await this.unregisterProvider(scope, provider.id, true, domain)
    })
  }

  private async unregisterProvider<
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    scope: HostContributionScope,
    providerId: string,
    notifyMain: boolean,
    domain: ScraperDomain<TSlot, TSession, TProvider>
  ): Promise<void> {
    await this.closeProviderSessions(domain.sessions, scope.runtimeHandle, providerId)
    domain.unregister(scope, providerId)
    await this.notifyProviderUnregistered(scope, domain.kind, providerId, notifyMain)
  }

  private async searchProvider<
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TSlot, TSession, TProvider>,
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

    return {
      results: results as Awaited<ReturnType<TProvider['search']>>
    }
  }

  private async resolveProvider<
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TSlot, TSession, TProvider>,
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

    return {
      target: target as Awaited<ReturnType<TProvider['resolve']>>
    }
  }

  private async openProviderSession<
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TSlot, TSession, TProvider>,
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
    const sessionId = randomUUID()
    domain.sessions.set(sessionId, {
      runtimeHandle: request.runtimeHandle,
      providerId: request.providerId,
      session
    })

    return { sessionId }
  }

  private async getProviderSession<
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TSlot, TSession, TProvider>,
    request: ScraperSessionGetRequest<TSlot>
  ): Promise<{ results: Awaited<ReturnType<TSession['get']>> }> {
    const record = this.requireSession(domain.sessions, request)

    return {
      results: (await record.session.get(request.slots)) as Awaited<ReturnType<TSession['get']>>
    }
  }

  private async closeProviderSession<
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TSlot, TSession, TProvider>,
    request: ScraperSessionCloseRequest
  ): Promise<void> {
    await this.closeSession(domain.sessions, request.sessionId)
  }

  private requireProvider<
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TSlot, TSession, TProvider>,
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
    await record.session.dispose?.()
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

  private deleteRuntimeSessions<TSession extends { dispose?(): Promise<void> | void }>(
    sessions: Map<string, ScraperSessionRecord<TSession>>,
    runtimeHandle: string
  ): void {
    for (const [sessionId, record] of [...sessions]) {
      if (record.runtimeHandle === runtimeHandle) {
        sessions.delete(sessionId)
      }
    }
  }

  private async notifyProviderUnregistered(
    scope: HostContributionScope,
    kind: ScraperKind,
    providerId: string,
    notifyMain: boolean
  ): Promise<void> {
    if (!notifyMain) {
      return
    }

    await this.options.rpc.requestMain(
      `bridge.scrapers.${kind}.unregister` as never,
      {
        runtimeHandle: scope.runtimeHandle,
        providerId
      } as never,
      this.options.getCleanupRequestOptions(scope)
    )
  }
}
