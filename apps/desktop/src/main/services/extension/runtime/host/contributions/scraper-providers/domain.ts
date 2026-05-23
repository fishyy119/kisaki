import type {
  HostToMainRpcRequestMap,
  RpcParams,
  ScraperMediaType,
  ScraperProviderResolveRequest,
  ScraperProviderSearchRequest,
  ScraperProviderSessionOpenRequest,
  ValidationIssue
} from '@kisaki3/extension-api'
import type { HostContributionScope } from '../types'
import type { LoadedExtensionRuntime } from '../../extension-registry'
import type { HostToMainScraperProviderRpcDescriptor } from './descriptors'

export interface ScraperSessionLike<TSlot extends string> {
  get(slots: readonly TSlot[]): Promise<unknown>
  dispose?(): Promise<void> | void
}

export interface ScraperProviderLike<
  TSlot extends string,
  TSession extends ScraperSessionLike<TSlot>
> {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly unknown[]
  search(
    query: ScraperProviderSearchRequest['query'],
    locale?: ScraperProviderSearchRequest['locale']
  ): Promise<readonly unknown[]>
  resolve(
    lookup: ScraperProviderResolveRequest['lookup'],
    locale: ScraperProviderResolveRequest['locale']
  ): Promise<ScraperProviderSessionOpenRequest['target'] | null>
  openSession(
    target: ScraperProviderSessionOpenRequest['target'],
    locale: ScraperProviderSessionOpenRequest['locale']
  ): Promise<TSession>
}

export interface ScraperSessionRecord<TSession extends { dispose?(): Promise<void> | void }> {
  runtimeHandle: string
  providerId: string
  session: TSession
}

export interface ScraperDomain<
  TMediaType extends ScraperMediaType,
  TSlot extends string,
  TSession extends ScraperSessionLike<TSlot>,
  TProvider extends ScraperProviderLike<TSlot, TSession>
> {
  mediaType: TMediaType
  label: string
  rpc: HostToMainScraperProviderRpcDescriptor
  slots: readonly TSlot[]
  sessions: Map<string, ScraperSessionRecord<TSession>>
  getProviders(runtime: LoadedExtensionRuntime): Map<string, TProvider>
  validate(provider: TProvider): readonly ValidationIssue[]
  validateSearchResults(results: unknown): readonly ValidationIssue[]
  validateResolvedTarget(target: unknown): readonly ValidationIssue[]
  validateSession(session: unknown): readonly ValidationIssue[]
  validateSessionResults(results: unknown): readonly ValidationIssue[]
  toRegistration(
    scope: HostContributionScope,
    provider: TProvider
  ): RpcParams<HostToMainRpcRequestMap, 'contributions.scraperProviders.register'>
  toUnregistration(
    scope: HostContributionScope,
    providerId: string
  ): RpcParams<HostToMainRpcRequestMap, 'contributions.scraperProviders.unregister'>
  register(scope: HostContributionScope, provider: TProvider): void
  unregister(scope: HostContributionScope, providerId: string): void
}
