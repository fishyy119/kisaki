import type { ExtensionStorage, JsonValue } from '@kisaki3/extension-api'
import { toJsonValue } from '@kisaki3/extension-api'
import type { ExtensionHostRpcServer } from '../rpc-server'
import type { ActiveExtensionScope } from './types'

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
    get: async <T extends JsonValue = JsonValue>(key: string): Promise<T | undefined> => {
      const result = await options.rpc.requestMain(
        'runtime.storage.get',
        {
          runtimeHandle: options.scope.runtimeHandle,
          key
        },
        getRequestOptions()
      )

      return result.value as T | undefined
    },
    set: async (key: string, value: unknown): Promise<void> => {
      await options.rpc.requestMain(
        'runtime.storage.set',
        {
          runtimeHandle: options.scope.runtimeHandle,
          key,
          value: toJsonValue(value, 'storage value')
        },
        getRequestOptions()
      )
    },
    delete: async (key: string): Promise<void> => {
      await options.rpc.requestMain(
        'runtime.storage.delete',
        {
          runtimeHandle: options.scope.runtimeHandle,
          key
        },
        getRequestOptions()
      )
    },
    listKeys: async (prefix?: string): Promise<readonly string[]> => {
      const result = await options.rpc.requestMain(
        'runtime.storage.listKeys',
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
