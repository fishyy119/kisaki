import type { ExtensionLogger, ExtensionRuntimeMetadata } from '@kisaki/extension-api'
import type { ExtensionHostRpcServer } from '../rpc-server'
import type { ActiveExtensionScope } from './types'
import { toRpcValue } from './utils/serialization'

interface ExtensionLoggerOptions {
  scope: ActiveExtensionScope
  extension: ExtensionRuntimeMetadata
  rpc: ExtensionHostRpcServer
  getRequestOptions(scope: ActiveExtensionScope): { signal?: AbortSignal } | undefined
}

/**
 * Creates an SDK logger that forwards extension logs to the main process.
 */
export function createExtensionLogger(options: ExtensionLoggerOptions): ExtensionLogger {
  const logWithLevel = (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    args: unknown[]
  ) => {
    void options.rpc
      .requestMain(
        'bridge.logger.log',
        {
          runtimeHandle: options.scope.runtimeHandle,
          level,
          message,
          args: args.map((value) => toRpcValue(value))
        },
        options.getRequestOptions(options.scope)
      )
      .catch((error) => {
        console.warn(
          `[ExtensionHost][${options.extension.id}] Failed to forward ${level} log:`,
          error
        )
      })
  }

  return {
    debug: (message, ...args) => logWithLevel('debug', message, args),
    info: (message, ...args) => logWithLevel('info', message, args),
    warn: (message, ...args) => logWithLevel('warn', message, args),
    error: (message, ...args) => logWithLevel('error', message, args)
  }
}
