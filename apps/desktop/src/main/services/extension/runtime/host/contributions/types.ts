import type { ExtensionRuntimeHandle, ValidationIssue } from '@kisaki/extension-api'
import { createValidationError } from '@kisaki/extension-api'
import type { RpcRequestOptions } from '../../rpc-core'
import type { ExtensionRegistry, LoadedExtensionRuntime } from '../extension-registry'
import type { ExtensionHostRpcServer } from '../rpc-server'

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
}

export interface ContributionDisposable {
  dispose(): Promise<void> | void
}

export function createContributionDisposable(
  dispose: () => Promise<void> | void
): ContributionDisposable {
  return { dispose }
}

export function requireRuntimeByScope(
  registry: ExtensionRegistry,
  scope: HostContributionScope
): LoadedExtensionRuntime {
  const runtime = registry.getByRuntimeHandle(scope.runtimeHandle)
  if (!runtime || runtime.metadata.id !== scope.extensionId) {
    throw new Error(`Extension runtime "${scope.runtimeHandle}" is not active.`)
  }

  return runtime
}

export function formatValidationIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}

export function throwValidationIssues(label: string, issues: readonly ValidationIssue[]): never {
  throw createValidationError(`${label} is invalid:\n${formatValidationIssues(issues)}`, {
    issues: issues.map((issue) => ({
      path: issue.path,
      message: issue.message
    }))
  })
}
