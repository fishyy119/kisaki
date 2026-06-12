import type {
  ExtensionRuntimeHandle,
  ExtensionRuntimeMetadata,
  MainToHostRpcMethod,
  MainToHostRpcRequestMap,
  RpcParams,
  RpcResult
} from '@kisaki3/extension-api'
import type { ExtensionEntityMenuRefreshRequestedEvent } from '@shared/extension'
import type { DeeplinkService } from '@main/services/deeplink'
import type { CommandService } from '@main/services/command'
import type { ScraperService } from '@main/services/scraper'
import type { RpcRequestOptions } from '../runtime'

export interface ExtensionContributionDomainOptions {
  command?: CommandService
  deeplink?: DeeplinkService
  scraper?: ScraperService
  onDidChange?: () => void
  onEntityMenusRefreshRequested?: (event: ExtensionEntityMenuRefreshRequestedEvent) => void
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

export interface ExtensionContributionReleaseDiagnostic {
  domain: string
  detail: string
}

export function requireContributionOwner(
  options: ExtensionContributionDomainOptions,
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
