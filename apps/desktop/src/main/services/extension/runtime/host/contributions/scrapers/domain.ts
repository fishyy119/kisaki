import type {
  HostToMainRpcMethod,
  HostToMainRpcRequestMap,
  RpcParams,
  ScraperResolveRequest,
  ScraperSearchRequest,
  ScraperSessionOpenRequest,
  ValidationIssue
} from '@kisaki/extension-api'
import type { HostContributionScope } from '../types'
import type { LoadedExtensionRuntime } from '../../extension-registry'
import type { HostToMainScraperRpcDescriptor, ScraperRpcKind } from './descriptors'
import type { ScraperMediaType } from '@shared/scraper'

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

export interface ScraperSessionRecord<TSession extends { dispose?(): Promise<void> | void }> {
  runtimeHandle: string
  providerId: string
  session: TSession
}

export interface ScraperDomain<
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
  mediaType: ScraperMediaType
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
  validateSearchResults(results: unknown): readonly ValidationIssue[]
  validateResolvedTarget(target: unknown): readonly ValidationIssue[]
  validateSession(session: unknown): readonly ValidationIssue[]
  validateSessionResults(results: unknown): readonly ValidationIssue[]
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
