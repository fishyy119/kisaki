export * from './core'
export * from './lifecycle'
export * from './contributions'
export * from './capabilities'

import type {
  HostToMainCapabilityRpcRequestMap,
  MainToHostCapabilityRpcEventMap
} from './capabilities'
import type {
  HostToMainContributionRpcRequestMap,
  MainToHostContributionRpcRequestMap
} from './contributions'
import type {
  RpcEventName,
  RpcMethodName,
  RpcTypedEventMessage,
  RpcTypedRequestMessage,
  RpcTypedResponseMessage
} from './core'
import type { MainToHostLifecycleRpcRequestMap } from './lifecycle'

export type MainToHostRpcRequestMap = MainToHostLifecycleRpcRequestMap &
  MainToHostContributionRpcRequestMap

export type MainToHostRpcEventMap = MainToHostCapabilityRpcEventMap

export type HostToMainRpcRequestMap = HostToMainContributionRpcRequestMap &
  HostToMainCapabilityRpcRequestMap

export type HostToMainRpcEventMap = Record<never, never>

export type ExtensionBridgeRpcRequestMap = MainToHostRpcRequestMap & HostToMainRpcRequestMap

export type ExtensionBridgeRpcEventMap = MainToHostRpcEventMap & HostToMainRpcEventMap

export type MainToHostRpcMethod = RpcMethodName<MainToHostRpcRequestMap>

export type HostToMainRpcMethod = RpcMethodName<HostToMainRpcRequestMap>

export type ExtensionBridgeRpcMethod = RpcMethodName<ExtensionBridgeRpcRequestMap>

export type MainToHostRpcEvent = RpcEventName<MainToHostRpcEventMap>

export type HostToMainRpcEvent = RpcEventName<HostToMainRpcEventMap>

export type ExtensionBridgeRpcEvent = RpcEventName<ExtensionBridgeRpcEventMap>

export type MainToHostRpcRequestMessage<TMethod extends MainToHostRpcMethod = MainToHostRpcMethod> =
  RpcTypedRequestMessage<MainToHostRpcRequestMap, TMethod>

export type MainToHostRpcResponseMessage<
  TMethod extends MainToHostRpcMethod = MainToHostRpcMethod
> = RpcTypedResponseMessage<MainToHostRpcRequestMap, TMethod>

export type MainToHostRpcEventMessage<TEvent extends MainToHostRpcEvent = MainToHostRpcEvent> =
  RpcTypedEventMessage<MainToHostRpcEventMap, TEvent>

export type HostToMainRpcRequestMessage<TMethod extends HostToMainRpcMethod = HostToMainRpcMethod> =
  RpcTypedRequestMessage<HostToMainRpcRequestMap, TMethod>

export type HostToMainRpcResponseMessage<
  TMethod extends HostToMainRpcMethod = HostToMainRpcMethod
> = RpcTypedResponseMessage<HostToMainRpcRequestMap, TMethod>

export type HostToMainRpcEventMessage<TEvent extends HostToMainRpcEvent = HostToMainRpcEvent> =
  RpcTypedEventMessage<HostToMainRpcEventMap, TEvent>
