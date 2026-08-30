import {
  RPC_HANDSHAKE_METHOD,
  type HostToMainRpcEvent,
  type HostToMainRpcEventMap,
  type HostToMainRpcMethod,
  type HostToMainRpcRequestMap,
  type MainToHostRpcEvent,
  type MainToHostRpcEventMap,
  type MainToHostRpcMethod,
  type MainToHostRpcRequestMap,
  type RpcEnvelope,
  type RpcHandshakeRequest,
  type RpcHandshakeResponse,
  type RpcParams,
  type RpcResult,
  type UndefinedTolerant
} from '@kisaki3/extension-api'
import {
  RpcChannel,
  type RpcRequestContext,
  type RpcRequestOptions
} from '@extension-host/protocol'
import { createLogger } from '@main/log'
import { extensionDbActor, runAsDbActor } from '@main/services/db/actor'

const log = createLogger('Extension')

export interface ExtensionHostRpcClientOptions {
  /** Maps a runtime handle to the owning extension id, when still loaded. */
  resolveExtensionId?: (runtimeHandle: string) => string | null
}

export class ExtensionHostRpcClient {
  private readonly channel: RpcChannel

  constructor(
    sender: (envelope: RpcEnvelope) => void,
    private readonly options: ExtensionHostRpcClientOptions = {}
  ) {
    this.channel = new RpcChannel(sender, {
      reportEventListenerError: (eventName, error) => {
        log.error('RPC event listener failed.', error, { event: eventName })
      }
    })
  }

  setSender(sender: (envelope: RpcEnvelope) => void): void {
    this.channel.setSender(sender)
  }

  onMessage(message: unknown): Promise<void> {
    return this.channel.receive(message)
  }

  dispose(reason?: string): void {
    this.channel.dispose(reason)
  }

  handshake(
    request: RpcHandshakeRequest,
    options?: RpcRequestOptions
  ): Promise<RpcHandshakeResponse> {
    return this.channel.request<RpcHandshakeResponse>(RPC_HANDSHAKE_METHOD, request, options)
  }

  // Constructing sides go through UndefinedTolerant (the wire drops undefined
  // members); receiving sides keep the exact-optional shape the wire delivers.
  requestHost<K extends MainToHostRpcMethod>(
    method: K,
    params: UndefinedTolerant<RpcParams<MainToHostRpcRequestMap, K>>,
    options?: RpcRequestOptions
  ): Promise<RpcResult<MainToHostRpcRequestMap, K>> {
    return this.channel.request<RpcResult<MainToHostRpcRequestMap, K>>(method, params, options)
  }

  handleHostRequest<K extends HostToMainRpcMethod>(
    method: K,
    handler: (
      params: RpcParams<HostToMainRpcRequestMap, K>,
      context: RpcRequestContext
    ) =>
      | Promise<UndefinedTolerant<RpcResult<HostToMainRpcRequestMap, K>>>
      | UndefinedTolerant<RpcResult<HostToMainRpcRequestMap, K>>
  ): void {
    this.channel.handle(method, (params, context) => {
      const typed = params as RpcParams<HostToMainRpcRequestMap, K>
      // Database writes the handler causes are attributed to the requesting
      // extension; the async-local scope survives awaits inside the handler.
      const extensionId = this.resolveRequestExtensionId(typed)
      return extensionId
        ? runAsDbActor(extensionDbActor(extensionId), () => handler(typed, context))
        : handler(typed, context)
    })
  }

  private resolveRequestExtensionId(params: unknown): string | null {
    const runtimeHandle =
      typeof params === 'object' && params !== null
        ? (params as { runtimeHandle?: unknown }).runtimeHandle
        : undefined
    if (typeof runtimeHandle !== 'string' || runtimeHandle.length === 0) {
      return null
    }
    return this.options.resolveExtensionId?.(runtimeHandle) ?? null
  }

  sendEventToHost<K extends MainToHostRpcEvent>(
    name: K,
    payload: UndefinedTolerant<MainToHostRpcEventMap[K]>
  ): void {
    this.channel.sendEvent(name, payload)
  }

  onHostEvent<K extends HostToMainRpcEvent>(
    name: K,
    listener: (payload: HostToMainRpcEventMap[K]) => Promise<void> | void
  ): () => void {
    return this.channel.onEvent(name, listener as (payload: unknown) => Promise<void> | void)
  }
}
