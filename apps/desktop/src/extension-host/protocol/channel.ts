/**
 * Extension host wire protocol: the bidirectional RPC channel and the wire
 * value normalizer that guards it.
 *
 * Both processes speak this module. It is the only part of the host program the
 * main process may import, and it stays free of Electron and `@main` so the
 * host bundle keeps its own dependency floor.
 */

import { newId } from '@shared/id'
import {
  RPC_ABORT_EVENT,
  RpcTimeoutError,
  createCancellationError,
  createExtensionError,
  fromRpcErrorPayload,
  toRpcErrorPayload,
  type RpcEnvelope,
  type RpcValue
} from '@kisaki3/extension-api'

export interface RpcRequestOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

export interface RpcRequestContext {
  requestId: string
  signal: AbortSignal
}

type RpcRequestHandler = (params: unknown, context: RpcRequestContext) => Promise<unknown> | unknown

type RpcEventListener = (payload: unknown) => Promise<void> | void

export interface RpcChannelOptions {
  /** Receives event listener failures, attributed to the event name. */
  reportEventListenerError?: (eventName: string, error: unknown) => void
}

interface PendingRpcRequest {
  cleanupAbort?: () => void
  reject: (error: Error) => void
  resolve: (value: unknown) => void
  timeoutId?: NodeJS.Timeout
}

/**
 * Bidirectional RPC channel speaking {@link RpcEnvelope} over a
 * structured-clone transport.
 * @remarks The channel is the single enforcement point of the wire value
 * domain: every outgoing params, event payload, and handler result is
 * normalized through {@link toRpcValue}, so callers never serialize manually
 * and non-wire values fail fast at the boundary they attempt to cross.
 */
export class RpcChannel {
  private readonly requestHandlers = new Map<string, RpcRequestHandler>()
  private readonly eventListeners = new Map<string, Set<RpcEventListener>>()
  private readonly pendingRequests = new Map<string, PendingRpcRequest>()
  private readonly activeRequests = new Map<string, AbortController>()

  constructor(
    private sendEnvelope: (envelope: RpcEnvelope) => void,
    private readonly options: RpcChannelOptions = {}
  ) {}

  setSender(sender: (envelope: RpcEnvelope) => void): void {
    this.sendEnvelope = sender
  }

  handle(method: string, handler: RpcRequestHandler): void {
    this.requestHandlers.set(method, handler)
  }

  onEvent(name: string, listener: RpcEventListener): () => void {
    let listeners = this.eventListeners.get(name)
    if (!listeners) {
      listeners = new Set<RpcEventListener>()
      this.eventListeners.set(name, listeners)
    }

    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.eventListeners.delete(name)
      }
    }
  }

  sendEvent(name: string, payload: unknown): void {
    this.sendEnvelope({
      kind: 'event',
      name,
      payload: toRpcValue(payload, `RPC event "${name}" payload`)
    })
  }

  request<TResult = unknown>(
    method: string,
    params: unknown,
    options: RpcRequestOptions = {}
  ): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(createRpcAbortError(method, 'before dispatch'))
        return
      }

      let wireParams: RpcValue
      try {
        wireParams = toRpcValue(params, `RPC request "${method}" params`)
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
        return
      }

      const id = newId()
      const pending: PendingRpcRequest = {
        resolve: (value) => resolve(value as TResult),
        reject
      }

      if (options.timeoutMs && options.timeoutMs > 0) {
        pending.timeoutId = setTimeout(() => {
          this.pendingRequests.delete(id)
          pending.cleanupAbort?.()
          this.trySendAbort(id)
          reject(new RpcTimeoutError(method, options.timeoutMs!))
        }, options.timeoutMs)
      }

      if (options.signal) {
        const onAbort = () => {
          this.pendingRequests.delete(id)
          if (pending.timeoutId) {
            clearTimeout(pending.timeoutId)
          }
          pending.cleanupAbort?.()
          this.trySendAbort(id)
          reject(createRpcAbortError(method, 'while pending'))
        }

        options.signal.addEventListener('abort', onAbort, { once: true })
        pending.cleanupAbort = () => {
          options.signal?.removeEventListener('abort', onAbort)
        }
      }

      this.pendingRequests.set(id, pending)
      try {
        this.sendEnvelope({
          kind: 'request',
          id,
          method,
          params: wireParams
        })
      } catch (error) {
        this.pendingRequests.delete(id)
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId)
        }
        pending.cleanupAbort?.()
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  async receive(envelope: unknown): Promise<void> {
    if (!isRpcEnvelope(envelope)) {
      return
    }

    if (envelope.kind === 'response') {
      this.handleResponse(envelope)
      return
    }

    if (envelope.kind === 'event') {
      this.handleEvent(envelope.name, envelope.payload)
      return
    }

    await this.handleRequest(envelope.id, envelope.method, envelope.params)
  }

  dispose(reason = 'RPC channel disposed'): void {
    for (const [id, pending] of this.pendingRequests) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId)
      }

      pending.cleanupAbort?.()
      pending.reject(new Error(reason))
      this.pendingRequests.delete(id)
    }

    for (const controller of this.activeRequests.values()) {
      controller.abort()
    }
    this.activeRequests.clear()
    this.requestHandlers.clear()
    this.eventListeners.clear()
  }

  private handleResponse(envelope: Extract<RpcEnvelope, { kind: 'response' }>): void {
    const pending = this.pendingRequests.get(envelope.id)
    if (!pending) {
      return
    }

    this.pendingRequests.delete(envelope.id)
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId)
    }
    pending.cleanupAbort?.()

    if (envelope.ok) {
      pending.resolve(envelope.result)
      return
    }

    pending.reject(fromRpcErrorPayload(envelope.error))
  }

  /**
   * Events are notifications: listeners are dispatched without awaiting, so a
   * slow listener never delays its peers, and each listener's failure — thrown
   * or rejected — is isolated and reported against the event name.
   */
  private handleEvent(name: string, payload: unknown): void {
    if (name === RPC_ABORT_EVENT && isAbortPayload(payload)) {
      this.activeRequests.get(payload.requestId)?.abort()
      return
    }

    const listeners = this.eventListeners.get(name)
    if (!listeners || listeners.size === 0) {
      return
    }

    for (const listener of [...listeners]) {
      try {
        const result = listener(payload)
        if (result && typeof result.then === 'function') {
          result.then(undefined, (error: unknown) => this.reportEventListenerError(name, error))
        }
      } catch (error) {
        this.reportEventListenerError(name, error)
      }
    }
  }

  private reportEventListenerError(name: string, error: unknown): void {
    if (this.options.reportEventListenerError) {
      this.options.reportEventListenerError(name, error)
      return
    }

    console.error(`[RpcChannel] Event "${name}" listener failed:`, error)
  }

  private async handleRequest(id: string, method: string, params: unknown): Promise<void> {
    const handler = this.requestHandlers.get(method)
    if (!handler) {
      this.sendEnvelope({
        kind: 'response',
        id,
        ok: false,
        error: toRpcErrorPayload(
          createExtensionError(`No RPC handler registered for "${method}".`, {
            code: 'method_not_found'
          })
        )
      })
      return
    }

    const controller = new AbortController()
    this.activeRequests.set(id, controller)

    try {
      const result = await handler(params, {
        requestId: id,
        signal: controller.signal
      })

      this.sendEnvelope({
        kind: 'response',
        id,
        ok: true,
        // Void handler results map to the RpcNoPayload empty object.
        result:
          result === undefined ? {} : toRpcValue(result, `RPC response for "${method}" result`)
      })
    } catch (error) {
      this.sendEnvelope({
        kind: 'response',
        id,
        ok: false,
        error: toRpcErrorPayload(error)
      })
    } finally {
      this.activeRequests.delete(id)
    }
  }

  private trySendAbort(requestId: string): void {
    try {
      this.sendEvent(RPC_ABORT_EVENT, { requestId })
    } catch {
      // The peer may already be gone; the local request is already settled.
    }
  }
}

function createRpcAbortError(method: string, phase: string): Error {
  return createCancellationError(`RPC request "${method}" was cancelled ${phase}.`, {
    method,
    phase
  })
}

function isRpcEnvelope(envelope: unknown): envelope is RpcEnvelope {
  if (!isPlainRecord(envelope) || typeof envelope.kind !== 'string') {
    return false
  }

  if (envelope.kind === 'request') {
    return (
      typeof envelope.id === 'string' && typeof envelope.method === 'string' && 'params' in envelope
    )
  }

  if (envelope.kind === 'response') {
    if (typeof envelope.id !== 'string' || typeof envelope.ok !== 'boolean') {
      return false
    }

    return envelope.ok ? 'result' in envelope : isPlainRecord(envelope.error)
  }

  if (envelope.kind === 'event') {
    return typeof envelope.name === 'string' && 'payload' in envelope
  }

  return false
}

function isAbortPayload(payload: unknown): payload is { requestId: string } {
  return isPlainRecord(payload) && typeof payload.requestId === 'string'
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RpcSerializationState {
  readonly label: string
  readonly seen: Set<object>
}

/**
 * Normalizes an untrusted value into the RPC wire value domain (strict JSON
 * plus binary), the runtime companion of the compile-time `WireSafe` check.
 * @remarks Mirrors `toJsonValue` semantics — deep-copies onto null-prototype
 * records, drops `undefined` object properties, converts array holes and
 * `undefined` entries to `null`, and rejects non-finite numbers, circular
 * references, and non-plain values (Date, Map, Set, class instances,
 * functions; `toJSON` is not honored) — with one addition: `Uint8Array`
 * leaves pass through by reference, since the structured-clone transport
 * copies them at send time.
 * @param label - Prefix used in error messages to locate the offending path.
 * @throws Error when the value cannot be represented on the wire.
 */
export function toRpcValue(value: unknown, label = 'value'): RpcValue {
  return serializeRpcValue(value, '', {
    label,
    seen: new Set<object>()
  })
}

function serializeRpcValue(value: unknown, path: string, state: RpcSerializationState): RpcValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${formatLocation(state.label, path)} number values must be finite.`)
    }

    return value
  }

  if (value instanceof Uint8Array) {
    return value
  }

  if (Array.isArray(value)) {
    if (state.seen.has(value)) {
      throw new Error(`${formatLocation(state.label, path)} must not contain circular references.`)
    }

    state.seen.add(value)
    try {
      const items: RpcValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index) || value[index] === undefined) {
          items.push(null)
          continue
        }

        items.push(serializeRpcValue(value[index], `${path}[${index}]`, state))
      }
      return items
    } finally {
      state.seen.delete(value)
    }
  }

  if (isWireRecord(value)) {
    if (state.seen.has(value)) {
      throw new Error(`${formatLocation(state.label, path)} must not contain circular references.`)
    }

    state.seen.add(value)
    try {
      const record = Object.create(null) as Record<string, RpcValue>
      for (const [key, entry] of Object.entries(value)) {
        if (entry === undefined) {
          continue
        }

        record[key] = serializeRpcValue(entry, joinPath(path, key), state)
      }
      return record
    } finally {
      state.seen.delete(value)
    }
  }

  if (value === undefined) {
    throw new Error(`${formatLocation(state.label, path)} must not be undefined.`)
  }

  throw new Error(`${formatLocation(state.label, path)} must be a JSON value or binary.`)
}

/**
 * Wire records must be prototype-plain; class instances carry behavior that
 * structured clone would silently drop.
 */
function isWireRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function joinPath(path: string, key: string): string {
  const segment = /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`
  return `${path}${segment}`
}

function formatLocation(label: string, path: string): string {
  return path ? `${label}${path}` : label
}
