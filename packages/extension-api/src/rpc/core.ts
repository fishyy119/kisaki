import type { JsonPrimitive, JsonObject } from '../shared'
import type { ExtensionErrorShape } from '../shared/errors'
import { createExtensionError, readErrorCode, readErrorDetails } from '../shared/errors'

export interface RpcErrorPayload extends ExtensionErrorShape {
  stack?: string
}

export class RpcTimeoutError extends Error {
  readonly code = 'timeout'
  readonly details: JsonObject

  constructor(
    readonly method: string,
    readonly timeoutMs: number
  ) {
    super(`RPC request "${method}" timed out after ${timeoutMs}ms`)
    this.name = 'RpcTimeoutError'
    this.details = {
      method,
      timeoutMs
    }
  }
}

export function toRpcErrorPayload(error: unknown): RpcErrorPayload {
  if (error instanceof Error) {
    const payload: RpcErrorPayload = {
      message: error.message
    }
    const code = readErrorCode(error)
    const details = readErrorDetails(error)
    const shouldExposeStack =
      'exposeStack' in error && (error as Error & { exposeStack?: boolean }).exposeStack === true

    if (code) {
      payload.code = code
    }

    if (details) {
      payload.details = details
    }

    if (error.stack && shouldExposeStack) {
      payload.stack = error.stack
    }

    return payload
  }

  return {
    message: typeof error === 'string' ? error : 'Unknown RPC error'
  }
}

export function fromRpcErrorPayload(payload: RpcErrorPayload): Error {
  const options = {
    ...(payload.code === undefined ? {} : { code: payload.code }),
    ...(payload.details === undefined ? {} : { details: payload.details }),
    exposeStack: Boolean(payload.stack)
  }
  const error = createExtensionError(payload.message, options)

  if (payload.stack) {
    error.stack = payload.stack
  }

  return error
}

export type RpcBinary = Uint8Array

export type RpcPrimitive = JsonPrimitive

export type RpcValue =
  | RpcPrimitive
  | RpcBinary
  | readonly RpcValue[]
  | { readonly [key: string]: RpcValue }

export interface RpcRecord {
  readonly [key: string]: RpcValue
}

export type RpcMethod = string

export type RpcEventTopic = string

export const EXTENSION_RPC_PROTOCOL_VERSION = '1'

export const RPC_HANDSHAKE_METHOD = '$/handshake'

export const RPC_ABORT_EVENT = 'rpc.abort'

export interface RpcHandshakeRequest {
  protocolVersion: string
  peerVersion?: string
  metadata?: JsonObject
}

export interface RpcHandshakeResponse {
  protocolVersion: string
  accepted: boolean
  error?: RpcErrorPayload
  metadata?: JsonObject
}

export interface RpcRequestEnvelope<TMethod extends RpcMethod = RpcMethod, TParams = RpcValue> {
  kind: 'request'
  id: string
  method: TMethod
  params: TParams
}

export interface RpcSuccessResponseEnvelope<TResult = RpcValue> {
  kind: 'response'
  id: string
  ok: true
  result: TResult
}

export interface RpcErrorResponseEnvelope {
  kind: 'response'
  id: string
  ok: false
  error: RpcErrorPayload
}

export interface RpcEventEnvelope<
  TName extends RpcEventTopic = RpcEventTopic,
  TPayload = RpcValue
> {
  kind: 'event'
  name: TName
  payload: TPayload
}

export type RpcResponseEnvelope<TResult = RpcValue> =
  | RpcSuccessResponseEnvelope<TResult>
  | RpcErrorResponseEnvelope

export type RpcEnvelope<
  TMethod extends RpcMethod = RpcMethod,
  TParams = RpcValue,
  TResult = RpcValue,
  TEventName extends RpcEventTopic = RpcEventTopic,
  TEventPayload = RpcValue
> =
  | RpcRequestEnvelope<TMethod, TParams>
  | RpcResponseEnvelope<TResult>
  | RpcEventEnvelope<TEventName, TEventPayload>

export interface RpcNoPayload {
  readonly [key: string]: never
}

export interface RpcMethodDefinition<TParams = RpcNoPayload, TResult = RpcNoPayload> {
  params: TParams
  result: TResult
}

export type RpcRequestMap = object

export type RpcEventMap = object

export type RpcMethodName<TMap extends RpcRequestMap = RpcRequestMap> = Extract<keyof TMap, string>

export type RpcEventName<TMap extends RpcEventMap = RpcEventMap> = Extract<keyof TMap, string>

export type RpcParams<TMap extends RpcRequestMap, TMethod extends RpcMethodName<TMap>> =
  TMap[TMethod] extends RpcMethodDefinition<infer TParams, unknown> ? TParams : never

export type RpcResult<TMap extends RpcRequestMap, TMethod extends RpcMethodName<TMap>> =
  TMap[TMethod] extends RpcMethodDefinition<unknown, infer TResult> ? TResult : never

export type RpcPayload<TMap extends RpcEventMap, TEvent extends RpcEventName<TMap>> = TMap[TEvent]

export type RpcTypedRequestEnvelope<
  TMap extends RpcRequestMap,
  TMethod extends RpcMethodName<TMap> = RpcMethodName<TMap>
> = RpcRequestEnvelope<TMethod, RpcParams<TMap, TMethod>>

export type RpcTypedResponseEnvelope<
  TMap extends RpcRequestMap,
  TMethod extends RpcMethodName<TMap> = RpcMethodName<TMap>
> = RpcResponseEnvelope<RpcResult<TMap, TMethod>>

export type RpcTypedEventEnvelope<
  TMap extends RpcEventMap,
  TEvent extends RpcEventName<TMap> = RpcEventName<TMap>
> = RpcEventEnvelope<TEvent, RpcPayload<TMap, TEvent>>
