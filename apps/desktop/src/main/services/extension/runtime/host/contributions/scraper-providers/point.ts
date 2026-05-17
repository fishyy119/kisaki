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
  type ScraperMediaType,
  type ScraperProviderRegistration,
  type ScraperProviderResolveRequest,
  type ScraperProviderResolveResponse,
  type ScraperProviderSearchRequest,
  type ScraperProviderSearchResponse,
  type ScraperProviderSessionCloseRequest,
  type ScraperProviderSessionGetRequest,
  type ScraperProviderSessionGetResponse,
  type ScraperProviderSessionOpenRequest,
  type ScraperProviderSessionOpenResponse,
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
import { requireRuntimeByScope, throwValidationIssues } from '../shared'
import type { HostContributionDomainOptions, HostContributionScope } from '../types'
import { createContributionRegistration } from '../registration'
import type { LoadedExtensionRuntime } from '../../extension-registry'
import { HOST_TO_MAIN_SCRAPER_RPC, SCRAPER_PROVIDER_SLOTS } from './descriptors'
import type {
  ScraperDomain,
  ScraperProviderLike,
  ScraperSessionLike,
  ScraperSessionRecord
} from './domain'
import { toScraperProviderRegistration } from './registrations'

type ScraperProviderInput<TMediaType extends ScraperMediaType> = TMediaType extends 'game'
  ? GameScraperProvider
  : TMediaType extends 'person'
    ? PersonScraperProvider
    : TMediaType extends 'company'
      ? CompanyScraperProvider
      : CharacterScraperProvider

export class HostScraperProviderContributionPoint {
  private readonly options: HostContributionDomainOptions
  private readonly gameSessions = new Map<string, ScraperSessionRecord<GameScraperSession>>()
  private readonly personSessions = new Map<string, ScraperSessionRecord<PersonScraperSession>>()
  private readonly companySessions = new Map<string, ScraperSessionRecord<CompanyScraperSession>>()
  private readonly characterSessions = new Map<
    string,
    ScraperSessionRecord<CharacterScraperSession>
  >()
  private readonly gameDomain: ScraperDomain<
    'game',
    GameScraperSlot,
    GameScraperSession,
    GameScraperProvider
  >
  private readonly personDomain: ScraperDomain<
    'person',
    PersonScraperSlot,
    PersonScraperSession,
    PersonScraperProvider
  >
  private readonly companyDomain: ScraperDomain<
    'company',
    CompanyScraperSlot,
    CompanyScraperSession,
    CompanyScraperProvider
  >
  private readonly characterDomain: ScraperDomain<
    'character',
    CharacterScraperSlot,
    CharacterScraperSession,
    CharacterScraperProvider
  >

  constructor(options: HostContributionDomainOptions) {
    this.options = options
    this.gameDomain = {
      mediaType: 'game',
      label: 'Game',
      rpc: HOST_TO_MAIN_SCRAPER_RPC,
      slots: SCRAPER_PROVIDER_SLOTS.game,
      sessions: this.gameSessions,
      getProviders: (runtime) => runtime.scraperProviders.game,
      validate: validateGameScraperProviderShape,
      validateSearchResults: validateGameScraperSearchResults,
      validateResolvedTarget: validateScraperResolvedTarget,
      validateSession: validateScraperSessionShape,
      validateSessionResults: validateGameScraperSessionResults,
      toRegistration: (scope, provider) => ({
        runtimeHandle: scope.runtimeHandle,
        mediaType: 'game',
        provider: toScraperProviderRegistration(provider, SCRAPER_PROVIDER_SLOTS.game)
      }),
      toUnregistration: (scope, providerId) => ({
        runtimeHandle: scope.runtimeHandle,
        mediaType: 'game',
        providerId
      }),
      register: (scope, provider) =>
        this.options.registry.registerScraperProvider(scope.extensionId, 'game', provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterScraperProvider(scope.extensionId, 'game', providerId)
    }
    this.personDomain = {
      mediaType: 'person',
      label: 'Person',
      rpc: HOST_TO_MAIN_SCRAPER_RPC,
      slots: SCRAPER_PROVIDER_SLOTS.person,
      sessions: this.personSessions,
      getProviders: (runtime) => runtime.scraperProviders.person,
      validate: validatePersonScraperProviderShape,
      validateSearchResults: validatePersonScraperSearchResults,
      validateResolvedTarget: validateScraperResolvedTarget,
      validateSession: validateScraperSessionShape,
      validateSessionResults: validatePersonScraperSessionResults,
      toRegistration: (scope, provider) => ({
        runtimeHandle: scope.runtimeHandle,
        mediaType: 'person',
        provider: toScraperProviderRegistration(provider, SCRAPER_PROVIDER_SLOTS.person)
      }),
      toUnregistration: (scope, providerId) => ({
        runtimeHandle: scope.runtimeHandle,
        mediaType: 'person',
        providerId
      }),
      register: (scope, provider) =>
        this.options.registry.registerScraperProvider(scope.extensionId, 'person', provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterScraperProvider(scope.extensionId, 'person', providerId)
    }
    this.companyDomain = {
      mediaType: 'company',
      label: 'Company',
      rpc: HOST_TO_MAIN_SCRAPER_RPC,
      slots: SCRAPER_PROVIDER_SLOTS.company,
      sessions: this.companySessions,
      getProviders: (runtime) => runtime.scraperProviders.company,
      validate: validateCompanyScraperProviderShape,
      validateSearchResults: validateCompanyScraperSearchResults,
      validateResolvedTarget: validateScraperResolvedTarget,
      validateSession: validateScraperSessionShape,
      validateSessionResults: validateCompanyScraperSessionResults,
      toRegistration: (scope, provider) => ({
        runtimeHandle: scope.runtimeHandle,
        mediaType: 'company',
        provider: toScraperProviderRegistration(provider, SCRAPER_PROVIDER_SLOTS.company)
      }),
      toUnregistration: (scope, providerId) => ({
        runtimeHandle: scope.runtimeHandle,
        mediaType: 'company',
        providerId
      }),
      register: (scope, provider) =>
        this.options.registry.registerScraperProvider(scope.extensionId, 'company', provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterScraperProvider(scope.extensionId, 'company', providerId)
    }
    this.characterDomain = {
      mediaType: 'character',
      label: 'Character',
      rpc: HOST_TO_MAIN_SCRAPER_RPC,
      slots: SCRAPER_PROVIDER_SLOTS.character,
      sessions: this.characterSessions,
      getProviders: (runtime) => runtime.scraperProviders.character,
      validate: validateCharacterScraperProviderShape,
      validateSearchResults: validateCharacterScraperSearchResults,
      validateResolvedTarget: validateScraperResolvedTarget,
      validateSession: validateScraperSessionShape,
      validateSessionResults: validateCharacterScraperSessionResults,
      toRegistration: (scope, provider) => ({
        runtimeHandle: scope.runtimeHandle,
        mediaType: 'character',
        provider: toScraperProviderRegistration(provider, SCRAPER_PROVIDER_SLOTS.character)
      }),
      toUnregistration: (scope, providerId) => ({
        runtimeHandle: scope.runtimeHandle,
        mediaType: 'character',
        providerId
      }),
      register: (scope, provider) =>
        this.options.registry.registerScraperProvider(scope.extensionId, 'character', provider),
      unregister: (scope, providerId) =>
        this.options.registry.unregisterScraperProvider(scope.extensionId, 'character', providerId)
    }
  }

  registerScraperProvider(
    scope: HostContributionScope,
    mediaType: ScraperMediaType,
    provider: ScraperProviderInput<ScraperMediaType>
  ): ScraperProviderRegistration
  registerScraperProvider(
    scope: HostContributionScope,
    mediaType: 'game',
    provider: GameScraperProvider
  ): ScraperProviderRegistration
  registerScraperProvider(
    scope: HostContributionScope,
    mediaType: 'person',
    provider: PersonScraperProvider
  ): ScraperProviderRegistration
  registerScraperProvider(
    scope: HostContributionScope,
    mediaType: 'company',
    provider: CompanyScraperProvider
  ): ScraperProviderRegistration
  registerScraperProvider(
    scope: HostContributionScope,
    mediaType: 'character',
    provider: CharacterScraperProvider
  ): ScraperProviderRegistration
  registerScraperProvider(
    scope: HostContributionScope,
    mediaType: ScraperMediaType,
    provider:
      | GameScraperProvider
      | PersonScraperProvider
      | CompanyScraperProvider
      | CharacterScraperProvider
  ): ScraperProviderRegistration {
    switch (mediaType) {
      case 'game':
        return this.registerProvider(scope, provider as GameScraperProvider, this.gameDomain)
      case 'person':
        return this.registerProvider(scope, provider as PersonScraperProvider, this.personDomain)
      case 'company':
        return this.registerProvider(scope, provider as CompanyScraperProvider, this.companyDomain)
      case 'character':
        return this.registerProvider(
          scope,
          provider as CharacterScraperProvider,
          this.characterDomain
        )
    }
  }

  async search(request: ScraperProviderSearchRequest): Promise<ScraperProviderSearchResponse> {
    switch (request.mediaType) {
      case 'game':
        return this.searchProvider(this.gameDomain, request)
      case 'person':
        return this.searchProvider(this.personDomain, request)
      case 'company':
        return this.searchProvider(this.companyDomain, request)
      case 'character':
        return this.searchProvider(this.characterDomain, request)
    }
  }

  async resolve(request: ScraperProviderResolveRequest): Promise<ScraperProviderResolveResponse> {
    switch (request.mediaType) {
      case 'game':
        return this.resolveProvider(this.gameDomain, request)
      case 'person':
        return this.resolveProvider(this.personDomain, request)
      case 'company':
        return this.resolveProvider(this.companyDomain, request)
      case 'character':
        return this.resolveProvider(this.characterDomain, request)
    }
  }

  async openSession(
    request: ScraperProviderSessionOpenRequest
  ): Promise<ScraperProviderSessionOpenResponse> {
    switch (request.mediaType) {
      case 'game':
        return this.openProviderSession(this.gameDomain, request)
      case 'person':
        return this.openProviderSession(this.personDomain, request)
      case 'company':
        return this.openProviderSession(this.companyDomain, request)
      case 'character':
        return this.openProviderSession(this.characterDomain, request)
    }
  }

  async getSession(
    request: ScraperProviderSessionGetRequest
  ): Promise<ScraperProviderSessionGetResponse> {
    switch (request.mediaType) {
      case 'game':
        return this.getProviderSession(this.gameDomain, request)
      case 'person':
        return this.getProviderSession(this.personDomain, request)
      case 'company':
        return this.getProviderSession(this.companyDomain, request)
      case 'character':
        return this.getProviderSession(this.characterDomain, request)
    }
  }

  async closeSession(request: ScraperProviderSessionCloseRequest): Promise<void> {
    switch (request.mediaType) {
      case 'game':
        await this.closeProviderSession(this.gameDomain, request)
        return
      case 'person':
        await this.closeProviderSession(this.personDomain, request)
        return
      case 'company':
        await this.closeProviderSession(this.companyDomain, request)
        return
      case 'character':
        await this.closeProviderSession(this.characterDomain, request)
        return
    }
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
    TMediaType extends ScraperMediaType,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    scope: HostContributionScope,
    provider: TProvider,
    domain: ScraperDomain<TMediaType, TSlot, TSession, TProvider>
  ): ScraperProviderRegistration {
    const issues = domain.validate(provider)
    if (issues.length > 0) {
      throwValidationIssues(`${domain.label} scraper provider`, issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (domain.getProviders(runtime).has(provider.id)) {
      throw new Error(`${domain.label} scraper provider "${provider.id}" is already registered.`)
    }

    domain.register(scope, provider)
    const request = this.options.rpc.requestMain(
      domain.rpc.register,
      domain.toRegistration(scope, provider),
      this.options.getRequestOptions(scope)
    )

    const registration = createContributionRegistration({
      scope,
      label: `${domain.label} scraper provider "${provider.id}"`,
      mainRegistration: request,
      reportDiagnostic: (diagnostic) => this.options.reportDiagnostic(scope, diagnostic),
      disposeLocal: async () => {
        try {
          await this.closeProviderSessions(domain.sessions, scope.runtimeHandle, provider.id)
        } finally {
          domain.unregister(scope, provider.id)
        }
      },
      unregisterMain: () =>
        this.options.rpc.requestMain(
          domain.rpc.unregister,
          domain.toUnregistration(scope, provider.id),
          this.options.getCleanupRequestOptions(scope)
        ),
      invalidateLocal: async () => {
        try {
          await this.closeProviderSessions(domain.sessions, scope.runtimeHandle, provider.id)
        } finally {
          domain.unregister(scope, provider.id)
        }
      },
      onSyncFailure: (error) => {
        runtime.context.logger.error(
          `${domain.label} scraper provider "${provider.id}" was disabled because main registry synchronization failed.`,
          error
        )
      }
    })
    this.options.trackMainRequest(scope, registration.sync)
    return registration
  }

  private async searchProvider<
    TMediaType extends ScraperMediaType,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TMediaType, TSlot, TSession, TProvider>,
    request: Extract<ScraperProviderSearchRequest, { mediaType: TMediaType }>
  ): Promise<Extract<ScraperProviderSearchResponse, { mediaType: TMediaType }>> {
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
      mediaType: domain.mediaType,
      results: results as Awaited<ReturnType<TProvider['search']>>
    } as unknown as Extract<ScraperProviderSearchResponse, { mediaType: TMediaType }>
  }

  private async resolveProvider<
    TMediaType extends ScraperMediaType,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TMediaType, TSlot, TSession, TProvider>,
    request: Extract<ScraperProviderResolveRequest, { mediaType: TMediaType }>
  ): Promise<Extract<ScraperProviderResolveResponse, { mediaType: TMediaType }>> {
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
      mediaType: domain.mediaType,
      target: target as Awaited<ReturnType<TProvider['resolve']>>
    } as unknown as Extract<ScraperProviderResolveResponse, { mediaType: TMediaType }>
  }

  private async openProviderSession<
    TMediaType extends ScraperMediaType,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TMediaType, TSlot, TSession, TProvider>,
    request: Extract<ScraperProviderSessionOpenRequest, { mediaType: TMediaType }>
  ): Promise<Extract<ScraperProviderSessionOpenResponse, { mediaType: TMediaType }>> {
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

    return { mediaType: domain.mediaType, sessionId } as unknown as Extract<
      ScraperProviderSessionOpenResponse,
      { mediaType: TMediaType }
    >
  }

  private async getProviderSession<
    TMediaType extends ScraperMediaType,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TMediaType, TSlot, TSession, TProvider>,
    request: Extract<ScraperProviderSessionGetRequest, { mediaType: TMediaType }>
  ): Promise<Extract<ScraperProviderSessionGetResponse, { mediaType: TMediaType }>> {
    const record = this.requireSession(domain.sessions, request)
    const runtime = this.requireRuntime(record.runtimeHandle)
    const results = await this.options.runInExtensionContext(runtime, () =>
      record.session.get(request.slots as readonly TSlot[])
    )
    this.assertValidProviderOutput(
      domain,
      runtime,
      request.providerId,
      'session results',
      domain.validateSessionResults(results)
    )

    return {
      mediaType: domain.mediaType,
      results: results as Awaited<ReturnType<TSession['get']>>
    } as unknown as Extract<ScraperProviderSessionGetResponse, { mediaType: TMediaType }>
  }

  private async closeProviderSession<
    TMediaType extends ScraperMediaType,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TMediaType, TSlot, TSession, TProvider>,
    request: Extract<ScraperProviderSessionCloseRequest, { mediaType: TMediaType }>
  ): Promise<void> {
    await this.closeStoredSession(domain.sessions, request.sessionId)
  }

  private requireProvider<
    TMediaType extends ScraperMediaType,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TMediaType, TSlot, TSession, TProvider>,
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
    TMediaType extends ScraperMediaType,
    TSlot extends string,
    TSession extends ScraperSessionLike<TSlot>,
    TProvider extends ScraperProviderLike<TSlot, TSession>
  >(
    domain: ScraperDomain<TMediaType, TSlot, TSession, TProvider>,
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
    request: ScraperProviderSessionGetRequest
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

  private async closeStoredSession<TSession extends { dispose?(): Promise<void> | void }>(
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
        await this.closeStoredSession(sessions, sessionId)
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
}
