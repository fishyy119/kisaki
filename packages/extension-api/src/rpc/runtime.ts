import type { SerializableValue } from '../shared'
import { RPC_ABORT_EVENT, type RpcMethodDefinition, type RpcNoPayload, type RpcValue } from './core'
import type { ExtensionScopedRpcParams } from './lifecycle'

export interface ExtensionLogRequest extends ExtensionScopedRpcParams {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  args: readonly RpcValue[]
}

export type ExtensionRuntimeDiagnosticSeverity = 'info' | 'warning' | 'error'

export interface ExtensionRuntimeDiagnostic {
  severity: ExtensionRuntimeDiagnosticSeverity
  source: string
  code: string
  message: string
  details?: string
  createdAt: string
}

export interface ExtensionRuntimeDiagnosticReportRequest extends ExtensionScopedRpcParams {
  diagnostic: ExtensionRuntimeDiagnostic
}

export interface StorageGetRequest extends ExtensionScopedRpcParams {
  key: string
  fallback: SerializableValue
}

export interface StorageGetResult {
  value: SerializableValue
}

export interface StorageSetRequest extends ExtensionScopedRpcParams {
  key: string
  value: SerializableValue
}

export interface StorageDeleteRequest extends ExtensionScopedRpcParams {
  key: string
}

export interface StorageListKeysRequest extends ExtensionScopedRpcParams {
  prefix?: string
}

export interface StorageListKeysResult {
  keys: readonly string[]
}

export interface SecretsGetRequest extends ExtensionScopedRpcParams {
  key: string
}

export interface SecretsGetResult {
  value?: SerializableValue
}

export interface SecretsSetRequest extends ExtensionScopedRpcParams {
  key: string
  value: SerializableValue
}

export interface SecretsDeleteRequest extends ExtensionScopedRpcParams {
  key: string
}

export interface SecretsListKeysRequest extends ExtensionScopedRpcParams {
  prefix?: string
}

export interface SecretsListKeysResult {
  keys: readonly string[]
}

export type HostToMainRuntimeRpcRequestMap = {
  'runtime.logger.log': RpcMethodDefinition<ExtensionLogRequest, RpcNoPayload>
  'runtime.diagnostics.report': RpcMethodDefinition<
    ExtensionRuntimeDiagnosticReportRequest,
    RpcNoPayload
  >
  'runtime.storage.get': RpcMethodDefinition<StorageGetRequest, StorageGetResult>
  'runtime.storage.set': RpcMethodDefinition<StorageSetRequest, RpcNoPayload>
  'runtime.storage.delete': RpcMethodDefinition<StorageDeleteRequest, RpcNoPayload>
  'runtime.storage.listKeys': RpcMethodDefinition<StorageListKeysRequest, StorageListKeysResult>
  'runtime.secrets.get': RpcMethodDefinition<SecretsGetRequest, SecretsGetResult>
  'runtime.secrets.set': RpcMethodDefinition<SecretsSetRequest, RpcNoPayload>
  'runtime.secrets.delete': RpcMethodDefinition<SecretsDeleteRequest, RpcNoPayload>
  'runtime.secrets.listKeys': RpcMethodDefinition<SecretsListKeysRequest, SecretsListKeysResult>
}

export interface MainToHostRuntimeRpcEventMap {
  [RPC_ABORT_EVENT]: { requestId: string }
}
