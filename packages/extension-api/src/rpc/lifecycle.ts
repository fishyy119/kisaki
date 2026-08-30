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
  | 'user-reload'
  | 'crash-recovery'
  | 'host-timeout'

export type ExtensionRuntimeHandle = string

export interface ExtensionLoadRequest {
  extension: ExtensionRuntimeMetadata
  runtimeHandle: ExtensionRuntimeHandle
  generation: number
  cause?: ExtensionRuntimeChangeCause | undefined
}

export interface ExtensionUnloadRequest {
  extensionId: string
  runtimeHandle?: ExtensionRuntimeHandle | undefined
  reason?: ExtensionUnloadReason | undefined
}

export interface ExtensionUnloadResult {
  unloaded: boolean
  deactivateError?: RpcErrorPayload | undefined
  cleanupError?: RpcErrorPayload | undefined
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
