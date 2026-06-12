import type { Disposable, ExtensionErrorShape, JsonValue } from '@kisaki3/extension-api'
import { createExtensionError, toJsonValue } from '@kisaki3/extension-api'

const RPC_CALL_KIND = 'kisaki-webview-rpc:call'
const RPC_RESULT_KIND = 'kisaki-webview-rpc:result'

/**
 * Message transport bridging one webview session. Satisfied by the host-side
 * `WebviewHandle` and the in-document `webview` client.
 */
export interface WebviewRpcTransport {
  readonly signal?: AbortSignal
  postMessage(message: JsonValue): void | Promise<void>
  onMessage(listener: (message: JsonValue) => void): Disposable
}

/**
 * Function map exposed over a webview RPC link. Arguments and return values
 * must stay JSON-serializable. Declared as `object` so plain interfaces
 * qualify; non-function members are dropped from the remote proxy type.
 */
export type WebviewRpcFunctions = object

export type WebviewRpcRemote<TRemote extends WebviewRpcFunctions> = {
  [K in keyof TRemote as TRemote[K] extends (...args: never[]) => unknown
    ? K
    : never]: TRemote[K] extends (...args: infer TArgs) => infer TReturn
    ? (...args: TArgs) => Promise<Awaited<TReturn>>
    : never
}

interface RpcCallEnvelope {
  readonly kind: typeof RPC_CALL_KIND
  readonly id: string
  readonly method: string
  readonly args: readonly JsonValue[]
}

interface RpcSuccessEnvelope {
  readonly kind: typeof RPC_RESULT_KIND
  readonly id: string
  readonly ok: true
  readonly value?: JsonValue
}

interface RpcErrorEnvelope {
  readonly kind: typeof RPC_RESULT_KIND
  readonly id: string
  readonly ok: false
  readonly error: ExtensionErrorShape
}

interface PendingCall {
  resolve(value: unknown): void
  reject(error: Error): void
}

function isRecord(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isRpcCallEnvelope(value: JsonValue): value is RpcCallEnvelope & JsonValue {
  return (
    isRecord(value) &&
    value.kind === RPC_CALL_KIND &&
    typeof value.id === 'string' &&
    typeof value.method === 'string' &&
    Array.isArray(value.args)
  )
}

function isRpcResultEnvelope(
  value: JsonValue
): value is (RpcSuccessEnvelope | RpcErrorEnvelope) & JsonValue {
  return (
    isRecord(value) &&
    value.kind === RPC_RESULT_KIND &&
    typeof value.id === 'string' &&
    typeof value.ok === 'boolean'
  )
}

function toErrorShape(error: unknown): ExtensionErrorShape {
  if (error instanceof Error) {
    const shape: ExtensionErrorShape = { message: error.message }
    const code = (error as Error & { code?: unknown }).code
    if (typeof code === 'string') {
      return { ...shape, code }
    }
    return shape
  }

  return { message: typeof error === 'string' ? error : 'Unknown webview RPC error' }
}

/**
 * Creates a typed bidirectional RPC link over one webview session.
 * @remarks Pure sugar over `postMessage`/`onMessage`: the app relays opaque
 * JSON and is unaware of the envelope. Both sides of one extension share the
 * function types directly, so no separate contract is needed. Raw message
 * listeners on the same transport should ignore envelopes whose `kind` starts
 * with `kisaki-webview-rpc:`.
 * @param transport - The `WebviewHandle` (extension host) or `webview` client (document).
 * @param functions - Local functions exposed to the other side.
 * @returns A proxy whose methods call the other side and resolve with its results.
 */
export function createWebviewRpc<
  TRemote extends WebviewRpcFunctions,
  TLocal extends WebviewRpcFunctions = Record<never, never>
>(transport: WebviewRpcTransport, functions?: TLocal): WebviewRpcRemote<TRemote> {
  const pending = new Map<string, PendingCall>()

  const rejectAll = (error: Error): void => {
    for (const call of pending.values()) {
      call.reject(error)
    }
    pending.clear()
  }

  if (transport.signal) {
    if (transport.signal.aborted) {
      rejectAll(createExtensionError('The webview session is closed.', { code: 'unavailable' }))
    } else {
      transport.signal.addEventListener(
        'abort',
        () => {
          rejectAll(
            createExtensionError('The webview session was closed.', { code: 'unavailable' })
          )
        },
        { once: true }
      )
    }
  }

  const respond = (envelope: RpcSuccessEnvelope | RpcErrorEnvelope): void => {
    void transport.postMessage(toJsonValue(envelope, 'webview RPC result'))
  }

  const handleCall = async (envelope: RpcCallEnvelope): Promise<void> => {
    const fn = (functions as Record<string, unknown> | undefined)?.[envelope.method]
    if (typeof fn !== 'function') {
      respond({
        kind: RPC_RESULT_KIND,
        id: envelope.id,
        ok: false,
        error: {
          message: `Webview RPC method "${envelope.method}" is not exposed by the other side.`,
          code: 'method_not_found'
        }
      })
      return
    }

    try {
      const value: unknown = await (fn as (...args: unknown[]) => unknown)(...envelope.args)
      respond({
        kind: RPC_RESULT_KIND,
        id: envelope.id,
        ok: true,
        ...(value === undefined ? {} : { value: toJsonValue(value, 'webview RPC result') })
      })
    } catch (error) {
      respond({
        kind: RPC_RESULT_KIND,
        id: envelope.id,
        ok: false,
        error: toErrorShape(error)
      })
    }
  }

  const handleResult = (envelope: RpcSuccessEnvelope | RpcErrorEnvelope): void => {
    const call = pending.get(envelope.id)
    if (!call) {
      return
    }

    pending.delete(envelope.id)
    if (envelope.ok) {
      call.resolve(envelope.value)
    } else {
      call.reject(
        createExtensionError(envelope.error.message, {
          ...(envelope.error.code === undefined ? {} : { code: envelope.error.code }),
          ...(envelope.error.details === undefined ? {} : { details: envelope.error.details })
        })
      )
    }
  }

  transport.onMessage((message) => {
    if (isRpcCallEnvelope(message)) {
      void handleCall(message)
      return
    }

    if (isRpcResultEnvelope(message)) {
      handleResult(message)
    }
  })

  const callRemote = (method: string, args: readonly unknown[]): Promise<unknown> => {
    if (transport.signal?.aborted) {
      return Promise.reject(
        createExtensionError('The webview session is closed.', { code: 'unavailable' })
      )
    }

    const id = crypto.randomUUID()
    const envelope: RpcCallEnvelope = {
      kind: RPC_CALL_KIND,
      id,
      method,
      args: args.map((arg, index) => toJsonValue(arg, `webview RPC argument ${index}`))
    }

    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      Promise.resolve(transport.postMessage(toJsonValue(envelope, 'webview RPC call'))).catch(
        (error: unknown) => {
          if (pending.delete(id)) {
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        }
      )
    })
  }

  return new Proxy({} as WebviewRpcRemote<TRemote>, {
    get(_target, property) {
      if (typeof property !== 'string' || property === 'then') {
        return undefined
      }

      return (...args: unknown[]) => callRemote(property, args)
    }
  })
}
