import type { ExtensionRuntimeMetadata } from '../context'
import type { RpcErrorPayload, RpcMethodDefinition, RpcNoPayload } from './core'

export type ExtensionUnloadReason = 'shutdown' | 'disable' | 'reload' | 'update'

export type ExtensionRuntimeChangeCause =
  | 'startup'
  | 'install'
  | 'enable'
  | 'disable'
  | 'uninstall'
  | 'package-update'
  | 'metadata-change'
  | 'development-file-change'
  | 'user'
  | 'crash-recovery'
  | 'host-timeout'

export type ExtensionRuntimeHandle = string

export interface ExtensionLoadRequest {
  extension: ExtensionRuntimeMetadata
  runtimeHandle: ExtensionRuntimeHandle
  generation: number
  cause?: ExtensionRuntimeChangeCause
}

export interface ExtensionUnloadRequest {
  extensionId: string
  runtimeHandle?: ExtensionRuntimeHandle
  reason?: ExtensionUnloadReason
}

export interface ExtensionUnloadResult {
  unloaded: boolean
  deactivateError?: RpcErrorPayload
  cleanupError?: RpcErrorPayload
}

export interface ExtensionScopedRpcParams {
  runtimeHandle: ExtensionRuntimeHandle
}

export interface ContributionScopedRpcParams extends ExtensionScopedRpcParams {
  contributionId: string
}

export interface MainToHostLifecycleRpcRequestMap {
  'extensions.load': RpcMethodDefinition<ExtensionLoadRequest, RpcNoPayload>
  'extensions.unload': RpcMethodDefinition<ExtensionUnloadRequest, ExtensionUnloadResult>
}
