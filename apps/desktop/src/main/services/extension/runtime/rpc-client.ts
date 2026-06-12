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
  type RpcResult
} from '@kisaki3/extension-api'
import { RpcChannel, type RpcRequestContext, type RpcRequestOptions } from './rpc-core'

export class ExtensionHostRpcClient {
  private readonly channel: RpcChannel

  constructor(sender: (envelope: RpcEnvelope) => void) {
    this.channel = new RpcChannel(sender)
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

  requestHost<K extends MainToHostRpcMethod>(
    method: K,
    params: RpcParams<MainToHostRpcRequestMap, K>,
    options?: RpcRequestOptions
  ): Promise<RpcResult<MainToHostRpcRequestMap, K>> {
    return this.channel.request<RpcResult<MainToHostRpcRequestMap, K>>(method, params, options)
  }

  handleHostRequest<K extends HostToMainRpcMethod>(
    method: K,
    handler: (
      params: RpcParams<HostToMainRpcRequestMap, K>,
      context: RpcRequestContext
    ) => Promise<RpcResult<HostToMainRpcRequestMap, K>> | RpcResult<HostToMainRpcRequestMap, K>
  ): void {
    this.channel.handle(method, (params, context) =>
      handler(params as RpcParams<HostToMainRpcRequestMap, K>, context)
    )
  }

  sendEventToHost<K extends MainToHostRpcEvent>(name: K, payload: MainToHostRpcEventMap[K]): void {
    this.channel.sendEvent(name, payload)
  }

  onHostEvent<K extends HostToMainRpcEvent>(
    name: K,
    listener: (payload: HostToMainRpcEventMap[K]) => Promise<void> | void
  ): () => void {
    return this.channel.onEvent(name, listener as (payload: unknown) => Promise<void> | void)
  }
}
