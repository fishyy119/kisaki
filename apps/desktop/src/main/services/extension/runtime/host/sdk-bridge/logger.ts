import type { ExtensionLogger, ExtensionRuntimeMetadata, RpcValue } from '@kisaki3/extension-api'
import { toJsonValue } from '@kisaki3/extension-api'
import type { ExtensionHostRpcServer } from '../rpc-server'
import type { ActiveExtensionScope } from './types'

interface ExtensionLoggerOptions {
  scope: ActiveExtensionScope
  extension: ExtensionRuntimeMetadata
  rpc: ExtensionHostRpcServer
  getRequestOptions(scope: ActiveExtensionScope): { signal?: AbortSignal } | undefined
  trackRequest(request: Promise<unknown>): void
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
    const request = options.rpc.requestMain(
      'runtime.logger.log',
      {
        runtimeHandle: options.scope.runtimeHandle,
        level,
        message,
        args: args.map((value) => toLogRpcValue(value))
      },
      options.getRequestOptions(options.scope)
    )

    options.trackRequest(request)
    void request.catch((error) => {
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

/**
 * Converts an arbitrary log argument into an RPC-safe value.
 * @remarks Log-only policy: binary passes through, errors serialize with their
 * stack for diagnostics, and values that are not JSON degrade to their string
 * form instead of failing the log call.
 */
function toLogRpcValue(value: unknown): RpcValue {
  if (value instanceof Uint8Array) {
    return value
  }

  if (value instanceof Error) {
    const serializedError: Record<string, string> = {
      name: value.name,
      message: value.message
    }

    if (value.stack) {
      serializedError.stack = value.stack
    }

    return serializedError
  }

  try {
    return toJsonValue(value, 'log argument')
  } catch {
    return String(value)
  }
}
