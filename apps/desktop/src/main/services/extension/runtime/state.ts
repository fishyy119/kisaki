import type {
  ExtensionRuntimeChangeCause,
  ExtensionRuntimeHandle,
  ExtensionRuntimeMetadata,
  ExtensionUnloadReason
} from '@kisaki/extension-api'

export type ExtensionRuntimeStatus = 'running' | 'failed' | 'stopped'

export interface ExtensionRuntimeState {
  status: ExtensionRuntimeStatus
  error: string | null
  updatedAt: string
}

export interface LoadedExtensionState {
  metadata: ExtensionRuntimeMetadata
  runtimeHandle: ExtensionRuntimeHandle
  generation: number
}

export function createRuntimeRunningState(): ExtensionRuntimeState {
  return {
    status: 'running',
    error: null,
    updatedAt: new Date().toISOString()
  }
}

export function createRuntimeFailureState(error: string): ExtensionRuntimeState {
  return {
    status: 'failed',
    error,
    updatedAt: new Date().toISOString()
  }
}

export function createRuntimeStoppedState(): ExtensionRuntimeState {
  return {
    status: 'stopped',
    error: null,
    updatedAt: new Date().toISOString()
  }
}

export function mapLoadedMetadata(
  loadedExtensions: ReadonlyMap<string, LoadedExtensionState>
): ReadonlyMap<string, ExtensionRuntimeMetadata> {
  const result = new Map<string, ExtensionRuntimeMetadata>()
  for (const [extensionId, state] of loadedExtensions) {
    result.set(extensionId, state.metadata)
  }
  return result
}

export function toChangeCause(reason: ExtensionUnloadReason): ExtensionRuntimeChangeCause {
  switch (reason) {
    case 'disable':
      return 'disable'
    case 'update':
      return 'package-update'
    case 'reload':
      return 'user'
    case 'shutdown':
      return 'user'
  }
}

export function isSameRuntimeMetadata(
  left: ExtensionRuntimeMetadata,
  right: ExtensionRuntimeMetadata
): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.version === right.version &&
    left.manifestPath === right.manifestPath &&
    left.extensionPath === right.extensionPath &&
    left.dataPath === right.dataPath &&
    left.tempPath === right.tempPath &&
    left.mode === right.mode
  )
}
