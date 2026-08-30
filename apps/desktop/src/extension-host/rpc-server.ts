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
import { RpcChannel, type RpcRequestContext, type RpcRequestOptions } from './protocol'

export class ExtensionHostRpcServer {
  private readonly channel: RpcChannel

  constructor(sender: (envelope: RpcEnvelope) => void) {
    this.channel = new RpcChannel(sender, {
      reportEventListenerError: (eventName, error) => {
        console.error(`[ExtensionHost] Event "${eventName}" listener failed:`, error)
      }
    })
  }

  onMessage(message: unknown): Promise<void> {
    return this.channel.receive(message)
  }

  dispose(reason?: string): void {
    this.channel.dispose(reason)
  }

  handleHandshake(
    handler: (
      request: RpcHandshakeRequest,
      context: RpcRequestContext
    ) => Promise<RpcHandshakeResponse> | RpcHandshakeResponse
  ): void {
    this.channel.handle(RPC_HANDSHAKE_METHOD, (params, context) =>
      handler(params as RpcHandshakeRequest, context)
    )
  }

  // Constructing sides go through UndefinedTolerant (the wire drops undefined
  // members); receiving sides keep the exact-optional shape the wire delivers.
  handle<K extends MainToHostRpcMethod>(
    method: K,
    handler: (
      params: RpcParams<MainToHostRpcRequestMap, K>,
      context: RpcRequestContext
    ) =>
      | Promise<UndefinedTolerant<RpcResult<MainToHostRpcRequestMap, K>>>
      | UndefinedTolerant<RpcResult<MainToHostRpcRequestMap, K>>
  ): void {
    this.channel.handle(method, (params, context) =>
      handler(params as RpcParams<MainToHostRpcRequestMap, K>, context)
    )
  }

  requestMain<K extends HostToMainRpcMethod>(
    method: K,
    params: UndefinedTolerant<RpcParams<HostToMainRpcRequestMap, K>>,
    options?: RpcRequestOptions
  ): Promise<RpcResult<HostToMainRpcRequestMap, K>> {
    return this.channel.request<RpcResult<HostToMainRpcRequestMap, K>>(method, params, options)
  }

  sendEvent<K extends HostToMainRpcEvent>(
    name: K,
    payload: UndefinedTolerant<HostToMainRpcEventMap[K]>
  ): void {
    this.channel.sendEvent(name, payload)
  }

  onMainEvent<K extends MainToHostRpcEvent>(
    name: K,
    listener: (payload: MainToHostRpcEventMap[K]) => Promise<void> | void
  ): () => void {
    return this.channel.onEvent(name, listener as (payload: unknown) => Promise<void> | void)
  }
}
