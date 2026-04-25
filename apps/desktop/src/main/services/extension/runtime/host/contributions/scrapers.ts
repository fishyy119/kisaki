import { randomUUID } from 'node:crypto'
import {
  CHARACTER_SCRAPER_SLOTS,
  type CharacterScraperProvider,
  type CharacterScraperSession,
  type CharacterScraperSlot,
  COMPANY_SCRAPER_SLOTS,
  type CompanyScraperProvider,
  type CompanyScraperSession,
  type CompanyScraperSlot,
  GAME_SCRAPER_SLOTS,
  type GameScraperProvider,
  type GameScraperSession,
  type GameScraperSlot,
  type HostToMainRpcMethod,
  type HostToMainRpcRequestMap,
  type MainToHostRpcMethod,
  PERSON_SCRAPER_SLOTS,
  type PersonScraperProvider,
  type PersonScraperSession,
  type PersonScraperSlot,
  type RpcParams,
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

export type ScraperRpcKind = 'games' | 'persons' | 'companies' | 'characters'

export type MainToHostScraperRpcMethods<TKind extends ScraperRpcKind = ScraperRpcKind> = {
  search: Extract<MainToHostRpcMethod, `scrapers.${TKind}.search`>
  resolve: Extract<MainToHostRpcMethod, `scrapers.${TKind}.resolve`>
  open: Extract<MainToHostRpcMethod, `scrapers.${TKind}.session.open`>
  get: Extract<MainToHostRpcMethod, `scrapers.${TKind}.session.get`>
  close: Extract<MainToHostRpcMethod, `scrapers.${TKind}.session.close`>
}

export interface MainToHostScraperRpcDescriptor<TKind extends ScraperRpcKind = ScraperRpcKind> {
  kind: TKind
  methods: MainToHostScraperRpcMethods<TKind>
}

export type HostToMainScraperRpcMethods<TKind extends ScraperRpcKind = ScraperRpcKind> = {
  register: Extract<HostToMainRpcMethod, `bridge.scrapers.${TKind}.register`>
  unregister: Extract<HostToMainRpcMethod, `bridge.scrapers.${TKind}.unregister`>
}

export interface HostToMainScraperRpcDescriptor<TKind extends ScraperRpcKind = ScraperRpcKind> {
  kind: TKind
  slots: readonly string[]
  methods: HostToMainScraperRpcMethods<TKind>
}

export const MAIN_TO_HOST_SCRAPER_RPC = {
  games: {
    kind: 'games',
    methods: {
      search: 'scrapers.games.search',
      resolve: 'scrapers.games.resolve',
      open: 'scrapers.games.session.open',
      get: 'scrapers.games.session.get',
      close: 'scrapers.games.session.close'
    }
  },
  persons: {
    kind: 'persons',
    methods: {
      search: 'scrapers.persons.search',
      resolve: 'scrapers.persons.resolve',
      open: 'scrapers.persons.session.open',
      get: 'scrapers.persons.session.get',
      close: 'scrapers.persons.session.close'
    }
  },
  companies: {
    kind: 'companies',
    methods: {
      search: 'scrapers.companies.search',
      resolve: 'scrapers.companies.resolve',
      open: 'scrapers.companies.session.open',
      get: 'scrapers.companies.session.get',
      close: 'scrapers.companies.session.close'
    }
  },
  characters: {
    kind: 'characters',
    methods: {
      search: 'scrapers.characters.search',
      resolve: 'scrapers.characters.resolve',
      open: 'scrapers.characters.session.open',
      get: 'scrapers.characters.session.get',
      close: 'scrapers.characters.session.close'
    }
  }
} as const satisfies {
  [K in ScraperRpcKind]: MainToHostScraperRpcDescriptor<K>
}

const HOST_TO_MAIN_SCRAPER_RPC = {
  games: {
    kind: 'games',
    slots: GAME_SCRAPER_SLOTS,
    methods: {
      register: 'bridge.scrapers.games.register',
      unregister: 'bridge.scrapers.games.unregister'
    }
  },
  persons: {
    kind: 'persons',
    slots: PERSON_SCRAPER_SLOTS,
    methods: {
      register: 'bridge.scrapers.persons.register',
      unregister: 'bridge.scrapers.persons.unregister'
    }
  },
  companies: {
    kind: 'companies',
    slots: COMPANY_SCRAPER_SLOTS,
    methods: {
      register: 'bridge.scrapers.companies.register',
      unregister: 'bridge.scrapers.companies.unregister'
    }
  },
  characters: {
    kind: 'characters',
    slots: CHARACTER_SCRAPER_SLOTS,
    methods: {
      register: 'bridge.scrapers.characters.register',
      unregister: 'bridge.scrapers.characters.unregister'
    }
  }
} as const satisfies {
  [K in ScraperRpcKind]: HostToMainScraperRpcDescriptor<K>
}

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

function toScraperProviderRegistration<TSlot extends string>(
  provider: {
    readonly id: string
    readonly name: string
    readonly capabilities: readonly unknown[]
  },
  allowedSlots: readonly TSlot[]
): {
  id: string
  name: string
  capabilities: readonly ('search' | TSlot)[]
} {
  return {
    id: provider.id,
    name: provider.name,
    capabilities: normalizeScraperCapabilities(provider.capabilities, allowedSlots)
  }
}

function normalizeScraperCapabilities<TSlot extends string>(
  capabilities: readonly unknown[],
  allowedSlots: readonly TSlot[]
): readonly ('search' | TSlot)[] {
  const allowedCapabilities = new Set<string>(['search', ...allowedSlots])
  return capabilities.filter(
    (capability): capability is 'search' | TSlot =>
      typeof capability === 'string' && allowedCapabilities.has(capability)
  )
}

interface ScraperSessionRecord<TSession extends { dispose?(): Promise<void> | void }> {
  runtimeHandle: string
  providerId: string
  session: TSession
}

interface ScraperDomain<
  TKind extends ScraperRpcKind,
  TSlot extends string,
  TSession extends ScraperSessionLike<TSlot>,
  TProvider extends ScraperProviderLike<TSlot, TSession>,
  TRegisterMethod extends HostToMainRpcMethod =
    HostToMainScraperRpcDescriptor<TKind>['methods']['register'],
  TUnregisterMethod extends HostToMainRpcMethod =
    HostToMainScraperRpcDescriptor<TKind>['methods']['unregister']
> {
  kind: TKind
  label: string
  rpc: HostToMainScraperRpcDescriptor<TKind> & {
    methods: {
      register: TRegisterMethod
      unregister: TUnregisterMethod
    }
  }
  sessions: Map<string, ScraperSessionRecord<TSession>>
  getProviders(runtime: LoadedExtensionRuntime): Map<string, TProvider>
  validate(provider: TProvider): readonly ValidationIssue[]
  toRegistration(
    scope: HostContributionScope,
    provider: TProvider
  ): RpcParams<HostToMainRpcRequestMap, TRegisterMethod>
  toUnregistration(
    scope: HostContributionScope,
    providerId: string
  ): RpcParams<HostToMainRpcRequestMap, TUnregisterMethod>
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
      label: 'Game',
      rpc: HOST_TO_MAIN_SCRAPER_RPC.games,
      sessions: this.gameSessions,
      getProviders: (runtime) => runtime.gameScrapers,
      validate: validateGameScraperProviderShape,
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
      label: 'Person',
      rpc: HOST_TO_MAIN_SCRAPER_RPC.persons,
      sessions: this.personSessions,
      getProviders: (runtime) => runtime.personScrapers,
      validate: validatePersonScraperProviderShape,
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
      label: 'Company',
      rpc: HOST_TO_MAIN_SCRAPER_RPC.companies,
      sessions: this.companySessions,
      getProviders: (runtime) => runtime.companyScrapers,
      validate: validateCompanyScraperProviderShape,
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
      label: 'Character',
      rpc: HOST_TO_MAIN_SCRAPER_RPC.characters,
      sessions: this.characterSessions,
      getProviders: (runtime) => runtime.characterScrapers,
      validate: validateCharacterScraperProviderShape,
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

  releaseAll(): void {
    this.gameSessions.clear()
    this.personSessions.clear()
    this.companySessions.clear()
    this.characterSessions.clear()
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
