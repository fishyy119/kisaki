import { randomUUID } from 'node:crypto'
import {
  RPC_ABORT_EVENT,
  RpcTimeoutError,
  createExtensionError,
  createUnavailableError,
  fromRpcErrorPayload,
  toRpcErrorPayload,
  type RpcMessage
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

interface PendingRpcRequest {
  cleanupAbort?: () => void
  reject: (error: Error) => void
  resolve: (value: unknown) => void
  timeoutId?: NodeJS.Timeout
}

export class RpcMessageChannel {
  private readonly requestHandlers = new Map<string, RpcRequestHandler>()
  private readonly eventListeners = new Map<string, Set<RpcEventListener>>()
  private readonly pendingRequests = new Map<string, PendingRpcRequest>()
  private readonly activeRequests = new Map<string, AbortController>()

  constructor(private sendMessage: (message: RpcMessage) => void) {}

  setSender(sender: (message: RpcMessage) => void): void {
    this.sendMessage = sender
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
    this.sendMessage({
      kind: 'event',
      name,
      payload
    } as RpcMessage)
  }

  request<TResult = unknown>(
    method: string,
    params: unknown,
    options: RpcRequestOptions = {}
  ): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      const id = randomUUID()

      if (options.signal?.aborted) {
        reject(createRpcAbortError(method, 'before dispatch'))
        return
      }

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
      this.sendMessage({
        kind: 'request',
        id,
        method,
        params
      } as RpcMessage)
    })
  }

  async receive(message: unknown): Promise<void> {
    if (!isRpcEnvelope(message)) {
      return
    }

    if (message.kind === 'response') {
      this.handleResponse(message)
      return
    }

    if (message.kind === 'event') {
      await this.handleEvent(message.name, message.payload)
      return
    }

    await this.handleRequest(message.id, message.method, message.params)
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

  private handleResponse(message: Extract<RpcMessage, { kind: 'response' }>): void {
    const pending = this.pendingRequests.get(message.id)
    if (!pending) {
      return
    }

    this.pendingRequests.delete(message.id)
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId)
    }
    pending.cleanupAbort?.()

    if (message.ok) {
      pending.resolve(message.result)
      return
    }

    pending.reject(fromRpcErrorPayload(message.error))
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
      this.sendMessage({
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

      this.sendMessage({
        kind: 'response',
        id,
        ok: true,
        result: result ?? {}
      } as RpcMessage)
    } catch (error) {
      this.sendMessage({
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

function isRpcEnvelope(message: unknown): message is RpcMessage {
  if (!isPlainRecord(message) || typeof message.kind !== 'string') {
    return false
  }

  if (message.kind === 'request') {
    return (
      typeof message.id === 'string' && typeof message.method === 'string' && 'params' in message
    )
  }

  if (message.kind === 'response') {
    if (typeof message.id !== 'string' || typeof message.ok !== 'boolean') {
      return false
    }

    return message.ok ? 'result' in message : isPlainRecord(message.error)
  }

  if (message.kind === 'event') {
    return typeof message.name === 'string' && 'payload' in message
  }

  return false
}

function isAbortPayload(payload: unknown): payload is { requestId: string } {
  return isPlainRecord(payload) && typeof payload.requestId === 'string'
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
