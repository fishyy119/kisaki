import type { ExtensionRuntimeDiagnostic, ExtensionRuntimeHandle } from '@kisaki3/extension-api'
import type { RpcRequestOptions } from '../protocol'
import type { ExtensionRegistry, LoadedExtensionRuntime } from '../registry'
import type { ExtensionHostRpcServer } from '../rpc-server'

export type HostContributionDiagnosticInput = Omit<ExtensionRuntimeDiagnostic, 'createdAt'>

export interface HostContributionScope {
  extensionId: string
  runtimeHandle: ExtensionRuntimeHandle
  signal?: AbortSignal | undefined
}

export interface HostContributionDomainOptions {
  registry: ExtensionRegistry
  rpc: ExtensionHostRpcServer
  getRequestOptions(scope: HostContributionScope): RpcRequestOptions | undefined
  getCleanupRequestOptions(scope: HostContributionScope): RpcRequestOptions | undefined
  runInExtensionContext<T>(
    runtimeOrScope: LoadedExtensionRuntime | HostContributionScope,
    callback: () => Promise<T> | T,
    signal?: AbortSignal
  ): Promise<T> | T
  trackMainRequest(scope: HostContributionScope, request: Promise<unknown>): void
  reportDiagnostic(scope: HostContributionScope, diagnostic: HostContributionDiagnosticInput): void
}
