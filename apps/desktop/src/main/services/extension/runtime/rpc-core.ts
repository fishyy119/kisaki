import { randomUUID } from 'node:crypto'
import {
  RPC_ABORT_EVENT,
  RpcTimeoutError,
  createExtensionError,
  createUnavailableError,
  fromRpcErrorPayload,
  toRpcErrorPayload,
  type RpcEnvelope,
  type RpcValue
} from '@kisaki3/extension-api'
import { toRpcValue } from './rpc-value'

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

  constructor(private sendEnvelope: (envelope: RpcEnvelope) => void) {}

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

      const id = randomUUID()
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
      await this.handleEvent(envelope.name, envelope.payload)
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

  private async handleEvent(name: string, payload: unknown): Promise<void> {
    if (name === RPC_ABORT_EVENT && isAbortPayload(payload)) {
      this.activeRequests.get(payload.requestId)?.abort()
      return
    }

    const listeners = this.eventListeners.get(name)
    if (!listeners || listeners.size === 0) {
      return
    }

    for (const listener of [...listeners]) {
      await Promise.resolve(listener(payload))
    }
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
  return createUnavailableError(`RPC request "${method}" was aborted ${phase}.`, {
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
