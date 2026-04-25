import type { ExtensionStorage } from '@kisaki/extension-api'
import type { ExtensionHostRpcServer } from '../rpc-server'
import type { ActiveExtensionScope } from './types'
import { toSerializableValue } from './utils/serialization'

interface ExtensionStorageOptions {
  scope: ActiveExtensionScope
  rpc: ExtensionHostRpcServer
  getRequestOptions(scope: ActiveExtensionScope): { signal?: AbortSignal } | undefined
}

/**
 * Creates the extension-scoped persistent storage SDK facade.
 */
export function createExtensionStorage(options: ExtensionStorageOptions): ExtensionStorage {
  const getRequestOptions = () => options.getRequestOptions(options.scope)

  return {
    get: async <T>(key: string, fallback: T): Promise<T> => {
      const result = await options.rpc.requestMain(
        'bridge.storage.get',
        {
          runtimeHandle: options.scope.runtimeHandle,
          key,
          fallback: toSerializableValue(fallback, 'storage fallback')
        },
        getRequestOptions()
      )

      return result.value as T
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      await options.rpc.requestMain(
        'bridge.storage.set',
        {
          runtimeHandle: options.scope.runtimeHandle,
          key,
          value: toSerializableValue(value, 'storage value')
        },
        getRequestOptions()
      )
    },
    delete: async (key: string): Promise<void> => {
      await options.rpc.requestMain(
        'bridge.storage.delete',
        {
          runtimeHandle: options.scope.runtimeHandle,
          key
        },
        getRequestOptions()
      )
    },
    listKeys: async (prefix?: string): Promise<readonly string[]> => {
      const result = await options.rpc.requestMain(
        'bridge.storage.listKeys',
        {
          runtimeHandle: options.scope.runtimeHandle,
          prefix
        },
        getRequestOptions()
      )

      return result.keys
    }
  }
}
