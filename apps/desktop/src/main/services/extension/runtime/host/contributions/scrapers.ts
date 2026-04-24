import { randomUUID } from 'node:crypto'
import {
  type CharacterScraperProvider,
  type CharacterScraperSession,
  type CompanyScraperProvider,
  type CompanyScraperSession,
  type CompanyScraperSlot,
  type GameScraperProvider,
  type GameScraperSession,
  type GameScraperSlot,
  type PersonScraperProvider,
  type PersonScraperSession,
  type PersonScraperSlot,
  type CharacterScraperSlot,
  type ScraperSessionCloseRequest,
  type ScraperSessionGetRequest,
  type ScraperSessionOpenRequest,
  type ScraperSearchRequest,
  type ScraperResolveRequest,
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

type ScraperKind = 'games' | 'persons' | 'companies' | 'characters'

interface ScraperSessionRecord<TSession extends { dispose?(): Promise<void> | void }> {
  runtimeHandle: string
  providerId: string
  session: TSession
}

export class HostScraperContributions {
  private readonly gameSessions = new Map<string, ScraperSessionRecord<GameScraperSession>>()
  private readonly personSessions = new Map<string, ScraperSessionRecord<PersonScraperSession>>()
  private readonly companySessions = new Map<string, ScraperSessionRecord<CompanyScraperSession>>()
  private readonly characterSessions = new Map<
    string,
    ScraperSessionRecord<CharacterScraperSession>
  >()

  constructor(private readonly options: HostContributionDomainOptions) {}

  registerGameProvider(
    scope: HostContributionScope,
    provider: GameScraperProvider
  ): ContributionDisposable {
    const issues = validateGameScraperProviderShape(provider)
    if (issues.length > 0) {
      throwValidationIssues('Game scraper provider', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.gameScrapers.has(provider.id)) {
      throw new Error(`Game scraper provider "${provider.id}" is already registered.`)
    }

    this.options.registry.registerGameScraper(scope.extensionId, provider)
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        'bridge.scrapers.games.register',
        {
          runtimeHandle: scope.runtimeHandle,
          provider: {
            id: provider.id,
            name: provider.name,
            capabilities: provider.capabilities as readonly ('search' | GameScraperSlot)[]
          }
        },
        this.options.getRequestOptions(scope)
      )
    )

    return createContributionDisposable(async () => {
      await this.unregisterGameProvider(scope, provider.id, true)
    })
  }

  registerPersonProvider(
    scope: HostContributionScope,
    provider: PersonScraperProvider
  ): ContributionDisposable {
    const issues = validatePersonScraperProviderShape(provider)
    if (issues.length > 0) {
      throwValidationIssues('Person scraper provider', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.personScrapers.has(provider.id)) {
      throw new Error(`Person scraper provider "${provider.id}" is already registered.`)
    }

    this.options.registry.registerPersonScraper(scope.extensionId, provider)
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        'bridge.scrapers.persons.register',
        {
          runtimeHandle: scope.runtimeHandle,
          provider: {
            id: provider.id,
            name: provider.name,
            capabilities: provider.capabilities as readonly ('search' | PersonScraperSlot)[]
          }
        },
        this.options.getRequestOptions(scope)
      )
    )

    return createContributionDisposable(async () => {
      await this.unregisterPersonProvider(scope, provider.id, true)
    })
  }

  registerCompanyProvider(
    scope: HostContributionScope,
    provider: CompanyScraperProvider
  ): ContributionDisposable {
    const issues = validateCompanyScraperProviderShape(provider)
    if (issues.length > 0) {
      throwValidationIssues('Company scraper provider', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.companyScrapers.has(provider.id)) {
      throw new Error(`Company scraper provider "${provider.id}" is already registered.`)
    }

    this.options.registry.registerCompanyScraper(scope.extensionId, provider)
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        'bridge.scrapers.companies.register',
        {
          runtimeHandle: scope.runtimeHandle,
          provider: {
            id: provider.id,
            name: provider.name,
            capabilities: provider.capabilities as readonly ('search' | CompanyScraperSlot)[]
          }
        },
        this.options.getRequestOptions(scope)
      )
    )

    return createContributionDisposable(async () => {
      await this.unregisterCompanyProvider(scope, provider.id, true)
    })
  }

  registerCharacterProvider(
    scope: HostContributionScope,
    provider: CharacterScraperProvider
  ): ContributionDisposable {
    const issues = validateCharacterScraperProviderShape(provider)
    if (issues.length > 0) {
      throwValidationIssues('Character scraper provider', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.characterScrapers.has(provider.id)) {
      throw new Error(`Character scraper provider "${provider.id}" is already registered.`)
    }

    this.options.registry.registerCharacterScraper(scope.extensionId, provider)
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        'bridge.scrapers.characters.register',
        {
          runtimeHandle: scope.runtimeHandle,
          provider: {
            id: provider.id,
            name: provider.name,
            capabilities: provider.capabilities as readonly ('search' | CharacterScraperSlot)[]
          }
        },
        this.options.getRequestOptions(scope)
      )
    )

    return createContributionDisposable(async () => {
      await this.unregisterCharacterProvider(scope, provider.id, true)
    })
  }

  async unregisterGameProvider(
    scope: HostContributionScope,
    providerId: string,
    notifyMain: boolean
  ): Promise<void> {
    await this.closeProviderSessions(this.gameSessions, scope.runtimeHandle, providerId)
    this.options.registry.unregisterGameScraper(scope.extensionId, providerId)
    await this.notifyProviderUnregistered(scope, 'games', providerId, notifyMain)
  }

  async unregisterPersonProvider(
    scope: HostContributionScope,
    providerId: string,
    notifyMain: boolean
  ): Promise<void> {
    await this.closeProviderSessions(this.personSessions, scope.runtimeHandle, providerId)
    this.options.registry.unregisterPersonScraper(scope.extensionId, providerId)
    await this.notifyProviderUnregistered(scope, 'persons', providerId, notifyMain)
  }

  async unregisterCompanyProvider(
    scope: HostContributionScope,
    providerId: string,
    notifyMain: boolean
  ): Promise<void> {
    await this.closeProviderSessions(this.companySessions, scope.runtimeHandle, providerId)
    this.options.registry.unregisterCompanyScraper(scope.extensionId, providerId)
    await this.notifyProviderUnregistered(scope, 'companies', providerId, notifyMain)
  }

  async unregisterCharacterProvider(
    scope: HostContributionScope,
    providerId: string,
    notifyMain: boolean
  ): Promise<void> {
    await this.closeProviderSessions(this.characterSessions, scope.runtimeHandle, providerId)
    this.options.registry.unregisterCharacterScraper(scope.extensionId, providerId)
    await this.notifyProviderUnregistered(scope, 'characters', providerId, notifyMain)
  }

  async searchGames(request: ScraperSearchRequest) {
    const { runtime, provider } = this.requireGameProvider(
      request.runtimeHandle,
      request.providerId
    )
    return {
      results: await this.options.runInExtensionContext(runtime, () =>
        provider.search(request.query, request.locale)
      )
    }
  }

  async resolveGame(request: ScraperResolveRequest) {
    const { runtime, provider } = this.requireGameProvider(
      request.runtimeHandle,
      request.providerId
    )
    return {
      target: await this.options.runInExtensionContext(runtime, () =>
        provider.resolve(request.lookup, request.locale)
      )
    }
  }

  async openGameSession(request: ScraperSessionOpenRequest) {
    const { runtime, provider } = this.requireGameProvider(
      request.runtimeHandle,
      request.providerId
    )
    const session = await this.options.runInExtensionContext(runtime, () =>
      provider.openSession(request.target, request.locale)
    )
    const sessionId = randomUUID()
    this.gameSessions.set(sessionId, {
      runtimeHandle: request.runtimeHandle,
      providerId: request.providerId,
      session
    })
    return { sessionId }
  }

  async getGameSession(request: ScraperSessionGetRequest<string>) {
    const record = this.requireSession(this.gameSessions, request)
    return {
      results: await record.session.get(request.slots as never)
    }
  }

  async closeGameSession(request: ScraperSessionCloseRequest): Promise<void> {
    await this.closeSession(this.gameSessions, request.sessionId)
  }

  async searchPersons(request: ScraperSearchRequest) {
    const { runtime, provider } = this.requirePersonProvider(
      request.runtimeHandle,
      request.providerId
    )
    return {
      results: await this.options.runInExtensionContext(runtime, () =>
        provider.search(request.query, request.locale)
      )
    }
  }

  async resolvePerson(request: ScraperResolveRequest) {
    const { runtime, provider } = this.requirePersonProvider(
      request.runtimeHandle,
      request.providerId
    )
    return {
      target: await this.options.runInExtensionContext(runtime, () =>
        provider.resolve(request.lookup, request.locale)
      )
    }
  }

  async openPersonSession(request: ScraperSessionOpenRequest) {
    const { runtime, provider } = this.requirePersonProvider(
      request.runtimeHandle,
      request.providerId
    )
    const session = await this.options.runInExtensionContext(runtime, () =>
      provider.openSession(request.target, request.locale)
    )
    const sessionId = randomUUID()
    this.personSessions.set(sessionId, {
      runtimeHandle: request.runtimeHandle,
      providerId: request.providerId,
      session
    })
    return { sessionId }
  }

  async getPersonSession(request: ScraperSessionGetRequest<string>) {
    const record = this.requireSession(this.personSessions, request)
    return {
      results: await record.session.get(request.slots as never)
    }
  }

  async closePersonSession(request: ScraperSessionCloseRequest): Promise<void> {
    await this.closeSession(this.personSessions, request.sessionId)
  }

  async searchCompanies(request: ScraperSearchRequest) {
    const { runtime, provider } = this.requireCompanyProvider(
      request.runtimeHandle,
      request.providerId
    )
    return {
      results: await this.options.runInExtensionContext(runtime, () =>
        provider.search(request.query, request.locale)
      )
    }
  }

  async resolveCompany(request: ScraperResolveRequest) {
    const { runtime, provider } = this.requireCompanyProvider(
      request.runtimeHandle,
      request.providerId
    )
    return {
      target: await this.options.runInExtensionContext(runtime, () =>
        provider.resolve(request.lookup, request.locale)
      )
    }
  }

  async openCompanySession(request: ScraperSessionOpenRequest) {
    const { runtime, provider } = this.requireCompanyProvider(
      request.runtimeHandle,
      request.providerId
    )
    const session = await this.options.runInExtensionContext(runtime, () =>
      provider.openSession(request.target, request.locale)
    )
    const sessionId = randomUUID()
    this.companySessions.set(sessionId, {
      runtimeHandle: request.runtimeHandle,
      providerId: request.providerId,
      session
    })
    return { sessionId }
  }

  async getCompanySession(request: ScraperSessionGetRequest<string>) {
    const record = this.requireSession(this.companySessions, request)
    return {
      results: await record.session.get(request.slots as never)
    }
  }

  async closeCompanySession(request: ScraperSessionCloseRequest): Promise<void> {
    await this.closeSession(this.companySessions, request.sessionId)
  }

  async searchCharacters(request: ScraperSearchRequest) {
    const { runtime, provider } = this.requireCharacterProvider(
      request.runtimeHandle,
      request.providerId
    )
    return {
      results: await this.options.runInExtensionContext(runtime, () =>
        provider.search(request.query, request.locale)
      )
    }
  }

  async resolveCharacter(request: ScraperResolveRequest) {
    const { runtime, provider } = this.requireCharacterProvider(
      request.runtimeHandle,
      request.providerId
    )
    return {
      target: await this.options.runInExtensionContext(runtime, () =>
        provider.resolve(request.lookup, request.locale)
      )
    }
  }

  async openCharacterSession(request: ScraperSessionOpenRequest) {
    const { runtime, provider } = this.requireCharacterProvider(
      request.runtimeHandle,
      request.providerId
    )
    const session = await this.options.runInExtensionContext(runtime, () =>
      provider.openSession(request.target, request.locale)
    )
    const sessionId = randomUUID()
    this.characterSessions.set(sessionId, {
      runtimeHandle: request.runtimeHandle,
      providerId: request.providerId,
      session
    })
    return { sessionId }
  }

  async getCharacterSession(request: ScraperSessionGetRequest<string>) {
    const record = this.requireSession(this.characterSessions, request)
    return {
      results: await record.session.get(request.slots as never)
    }
  }

  async closeCharacterSession(request: ScraperSessionCloseRequest): Promise<void> {
    await this.closeSession(this.characterSessions, request.sessionId)
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

  private requireGameProvider(runtimeHandle: string, providerId: string) {
    const runtime = this.requireRuntime(runtimeHandle)
    const provider = runtime.gameScrapers.get(providerId)
    if (!provider) {
      throw new Error(`Game scraper provider "${providerId}" is not registered.`)
    }
    return { runtime, provider }
  }

  private requirePersonProvider(runtimeHandle: string, providerId: string) {
    const runtime = this.requireRuntime(runtimeHandle)
    const provider = runtime.personScrapers.get(providerId)
    if (!provider) {
      throw new Error(`Person scraper provider "${providerId}" is not registered.`)
    }
    return { runtime, provider }
  }

  private requireCompanyProvider(runtimeHandle: string, providerId: string) {
    const runtime = this.requireRuntime(runtimeHandle)
    const provider = runtime.companyScrapers.get(providerId)
    if (!provider) {
      throw new Error(`Company scraper provider "${providerId}" is not registered.`)
    }
    return { runtime, provider }
  }

  private requireCharacterProvider(runtimeHandle: string, providerId: string) {
    const runtime = this.requireRuntime(runtimeHandle)
    const provider = runtime.characterScrapers.get(providerId)
    if (!provider) {
      throw new Error(`Character scraper provider "${providerId}" is not registered.`)
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
