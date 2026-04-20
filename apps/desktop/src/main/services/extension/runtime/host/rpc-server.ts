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
  type RpcHandshakeRequest,
  type RpcHandshakeResponse,
  type RpcMessage,
  type RpcParams,
  type RpcResult
} from '@kisaki/extension-api'
import { RpcMessageChannel, type RpcRequestContext, type RpcRequestOptions } from '../rpc-core'

export class ExtensionHostRpcServer {
  private readonly channel: RpcMessageChannel

  constructor(sender: (message: RpcMessage) => void) {
    this.channel = new RpcMessageChannel(sender)
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

  handle<K extends MainToHostRpcMethod>(
    method: K,
    handler: (
      params: RpcParams<MainToHostRpcRequestMap, K>,
      context: RpcRequestContext
    ) => Promise<RpcResult<MainToHostRpcRequestMap, K>> | RpcResult<MainToHostRpcRequestMap, K>
  ): void {
    this.channel.handle(method, (params, context) =>
      handler(params as RpcParams<MainToHostRpcRequestMap, K>, context)
    )
  }

  requestMain<K extends HostToMainRpcMethod>(
    method: K,
    params: RpcParams<HostToMainRpcRequestMap, K>,
    options?: RpcRequestOptions
  ): Promise<RpcResult<HostToMainRpcRequestMap, K>> {
    return this.channel.request<RpcResult<HostToMainRpcRequestMap, K>>(method, params, options)
  }

  sendEvent<K extends HostToMainRpcEvent>(name: K, payload: HostToMainRpcEventMap[K]): void {
    this.channel.sendEvent(name, payload)
  }

  onMainEvent<K extends MainToHostRpcEvent>(
    name: K,
    listener: (payload: MainToHostRpcEventMap[K]) => Promise<void> | void
  ): () => void {
    return this.channel.onEvent(name, listener as (payload: unknown) => Promise<void> | void)
  }
}
