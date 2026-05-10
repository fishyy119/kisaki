import type { ExtensionRuntimeDiagnostic, ExtensionRuntimeHandle } from '@kisaki/extension-api'
import type { RpcRequestOptions } from '../../rpc-core'
import type { ExtensionRegistry, LoadedExtensionRuntime } from '../extension-registry'
import type { ExtensionHostRpcServer } from '../rpc-server'

export type HostContributionDiagnosticInput = Omit<ExtensionRuntimeDiagnostic, 'createdAt'>

export interface HostContributionScope {
  extensionId: string
  runtimeHandle: ExtensionRuntimeHandle
}

export interface HostContributionDomainOptions {
  registry: ExtensionRegistry
  rpc: ExtensionHostRpcServer
  getRequestOptions(scope: HostContributionScope): RpcRequestOptions | undefined
  getCleanupRequestOptions(scope: HostContributionScope): RpcRequestOptions | undefined
  runInExtensionContext<T>(
    runtimeOrScope: LoadedExtensionRuntime | HostContributionScope,
    callback: () => Promise<T> | T
  ): Promise<T> | T
  trackMainRequest(scope: HostContributionScope, request: Promise<unknown>): void
  reportDiagnostic(scope: HostContributionScope, diagnostic: HostContributionDiagnosticInput): void
}
