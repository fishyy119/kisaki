import type { ExtensionSecrets, JsonValue } from '@kisaki3/extension-api'
import type { ExtensionHostRpcServer } from '../rpc-server'
import type { ActiveExtensionScope } from './types'
import { toJsonValue } from './utils/serialization'

interface ExtensionSecretsOptions {
  scope: ActiveExtensionScope
  rpc: ExtensionHostRpcServer
  getRequestOptions(scope: ActiveExtensionScope): { signal?: AbortSignal } | undefined
}

/**
 * Creates the extension-scoped secure storage SDK facade.
 */
export function createExtensionSecrets(options: ExtensionSecretsOptions): ExtensionSecrets {
  const getRequestOptions = () => options.getRequestOptions(options.scope)

  return {
    get: async <T extends JsonValue = JsonValue>(key: string): Promise<T | undefined> => {
      const result = await options.rpc.requestMain(
        'runtime.secrets.get',
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
        'runtime.secrets.set',
        {
          runtimeHandle: options.scope.runtimeHandle,
          key,
          value: toJsonValue(value, 'secrets value')
        },
        getRequestOptions()
      )
    },
    delete: async (key: string): Promise<void> => {
      await options.rpc.requestMain(
        'runtime.secrets.delete',
        {
          runtimeHandle: options.scope.runtimeHandle,
          key
        },
        getRequestOptions()
      )
    },
    listKeys: async (prefix?: string): Promise<readonly string[]> => {
      const result = await options.rpc.requestMain(
        'runtime.secrets.listKeys',
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
