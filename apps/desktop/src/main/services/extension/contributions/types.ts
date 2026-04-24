import type {
  ExtensionRuntimeHandle,
  ExtensionRuntimeMetadata,
  MainToHostRpcMethod,
  MainToHostRpcRequestMap,
  RpcParams,
  RpcResult
} from '@kisaki/extension-api'
import type { RpcRequestOptions } from '../runtime/rpc-core'

export interface ExtensionContributionHostOptions {
  resolveRuntimeHandle(runtimeHandle: ExtensionRuntimeHandle): ExtensionRuntimeMetadata | null
  requestHost<K extends MainToHostRpcMethod>(
    method: K,
    params: RpcParams<MainToHostRpcRequestMap, K>,
    options?: RpcRequestOptions
  ): Promise<RpcResult<MainToHostRpcRequestMap, K>>
}

export interface RuntimeContributionOwner {
  runtimeHandle: ExtensionRuntimeHandle
  extension: ExtensionRuntimeMetadata
}

export function requireContributionOwner(
  options: ExtensionContributionHostOptions,
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
