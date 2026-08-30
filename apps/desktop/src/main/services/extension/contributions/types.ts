import type {
  ExtensionRuntimeHandle,
  ExtensionRuntimeMetadata,
  MainToHostRpcMethod,
  MainToHostRpcRequestMap,
  RpcParams,
  RpcResult,
  UndefinedTolerant
} from '@kisaki3/extension-api'
import type { RpcRequestOptions } from '@extension-host/protocol'

/**
 * Dependencies every contribution point needs. Domain-specific services and
 * callbacks belong on the owning point's own options type.
 */
export interface ExtensionContributionPointOptions {
  resolveRuntimeHandle(runtimeHandle: ExtensionRuntimeHandle): ExtensionRuntimeMetadata | null
  requestHost<K extends MainToHostRpcMethod>(
    method: K,
    params: UndefinedTolerant<RpcParams<MainToHostRpcRequestMap, K>>,
    options?: RpcRequestOptions
  ): Promise<RpcResult<MainToHostRpcRequestMap, K>>
}

export interface RuntimeContributionOwner {
  runtimeHandle: ExtensionRuntimeHandle
  extension: ExtensionRuntimeMetadata
}

export interface ExtensionContributionReleaseDiagnostic {
  domain: string
  detail: string
}

export function requireContributionOwner(
  options: ExtensionContributionPointOptions,
  runtimeHandle: ExtensionRuntimeHandle
): RuntimeContributionOwner {
  const extension = options.resolveRuntimeHandle(runtimeHandle)
  if (!extension) {
    throw new Error(`Runtime handle "${runtimeHandle}" is not active.`)
  }

  return {
    runtimeHandle,
    extension
  }
}

export function toContributionOwnerInfo(owner: RuntimeContributionOwner) {
  return {
    extensionId: owner.extension.id,
    extensionName: owner.extension.name,
    extensionVersion: owner.extension.version
  }
}

export function getRuntimeContributionKey(
  runtimeHandle: ExtensionRuntimeHandle,
  contributionId: string
): string {
  return `${runtimeHandle}:${contributionId}`
}
