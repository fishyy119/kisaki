import type { JsonPrimitive } from '../shared'
import type {
  RpcBinary,
  RpcErrorPayload,
  RpcHandshakeRequest,
  RpcHandshakeResponse,
  RpcMethodDefinition
} from './core'
import type {
  HostToMainRpcEventMap,
  HostToMainRpcRequestMap,
  MainToHostRpcEventMap,
  MainToHostRpcRequestMap
} from './index'

/**
 * Maps a type onto the RPC wire value domain (strict JSON plus binary).
 * @remarks Functions and values outside the wire domain map to `never`, so a
 * type `T` is wire-safe exactly when `T` is assignable to `WireSafe<T>`.
 */
export type WireSafe<T> = T extends JsonPrimitive | RpcBinary | undefined
  ? T
  : T extends (...args: never) => unknown
    ? never
    : T extends readonly (infer TItem)[]
      ? readonly WireSafe<TItem>[]
      : T extends object
        ? { [K in keyof T]: WireSafe<T[K]> }
        : never

type UnsafeMethodsOf<TMap> = {
  [K in keyof TMap]: TMap[K] extends RpcMethodDefinition<infer TParams, infer TResult>
    ? [TParams, TResult] extends [WireSafe<TParams>, WireSafe<TResult>]
      ? never
      : K
    : K
}[keyof TMap]

type UnsafeEventsOf<TMap> = {
  [K in keyof TMap]: [TMap[K]] extends [WireSafe<TMap[K]>] ? never : K
}[keyof TMap]

type AssertNever<T extends never> = T

/**
 * Compile-time guarantees that every RPC method and event payload stays inside
 * the wire value domain. A non-wire-safe field surfaces here as a type error
 * naming the offending method or event.
 */
export type AssertMainToHostRequestsAreWireSafe = AssertNever<
  UnsafeMethodsOf<MainToHostRpcRequestMap>
>

export type AssertHostToMainRequestsAreWireSafe = AssertNever<
  UnsafeMethodsOf<HostToMainRpcRequestMap>
>

export type AssertMainToHostEventsAreWireSafe = AssertNever<UnsafeEventsOf<MainToHostRpcEventMap>>

export type AssertHostToMainEventsAreWireSafe = AssertNever<UnsafeEventsOf<HostToMainRpcEventMap>>

export type AssertProtocolPayloadsAreWireSafe = AssertNever<
  | ([RpcErrorPayload] extends [WireSafe<RpcErrorPayload>] ? never : 'RpcErrorPayload')
  | ([RpcHandshakeRequest] extends [WireSafe<RpcHandshakeRequest>] ? never : 'RpcHandshakeRequest')
  | ([RpcHandshakeResponse] extends [WireSafe<RpcHandshakeResponse>]
      ? never
      : 'RpcHandshakeResponse')
>
