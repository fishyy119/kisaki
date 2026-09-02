import type {
  HostToMainRpcRequestMap,
  RpcParams,
  ScraperProviderContext,
  ScraperProviderResolveRequest,
  ScraperProviderSearchRequest,
  ScraperProviderSessionOpenRequest,
  ValidationIssue
} from '@kisaki3/extension-api'
import type { ContentEntityType } from '@shared/entity-types'
import type { HostContributionScope } from '../types'
import type { LoadedExtensionRuntime } from '../../registry'
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
  /** Present if and only if `capabilities` declares `search`. */
  search?(
    query: ScraperProviderSearchRequest['query'],
    ctx: ScraperProviderContext
  ): Promise<readonly unknown[]>
  resolve(
    lookup: ScraperProviderResolveRequest['lookup'],
    ctx: ScraperProviderContext
  ): Promise<ScraperProviderSessionOpenRequest['target'] | null>
  openSession(
    target: ScraperProviderSessionOpenRequest['target'],
    ctx: ScraperProviderContext
  ): Promise<TSession>
}

export interface ScraperSessionRecord<TSession extends { dispose?(): Promise<void> | void }> {
  runtimeHandle: string
  providerId: string
  session: TSession
  /** Aborted when the session ends, so provider work tied to it stops. */
  controller: AbortController
}

export interface ScraperDomain<
  TEntityType extends ContentEntityType,
  TSlot extends string,
  TSession extends ScraperSessionLike<TSlot>,
  TProvider extends ScraperProviderLike<TSlot, TSession>
> {
  entityType: TEntityType
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
