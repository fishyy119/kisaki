export * from './core'
export * from './lifecycle'
export * from './runtime'
export * from './contributions'
export * from './capabilities'
export type { WireSafe } from './wire'

import type {
  HostToMainCapabilityRpcRequestMap,
  MainToHostCapabilityRpcEventMap
} from './capabilities'
import type {
  HostToMainContributionRpcRequestMap,
  MainToHostContributionRpcRequestMap
} from './contributions'
import type { RpcEventName, RpcMethodName } from './core'
import type { MainToHostLifecycleRpcRequestMap } from './lifecycle'
import type { HostToMainRuntimeRpcRequestMap, MainToHostRuntimeRpcEventMap } from './runtime'

export type MainToHostRpcRequestMap = MainToHostLifecycleRpcRequestMap &
  MainToHostContributionRpcRequestMap

export type MainToHostRpcEventMap = MainToHostRuntimeRpcEventMap & MainToHostCapabilityRpcEventMap

export type HostToMainRpcRequestMap = HostToMainContributionRpcRequestMap &
  HostToMainRuntimeRpcRequestMap &
  HostToMainCapabilityRpcRequestMap

export type HostToMainRpcEventMap = Record<never, never>

export type MainToHostRpcMethod = RpcMethodName<MainToHostRpcRequestMap>

export type HostToMainRpcMethod = RpcMethodName<HostToMainRpcRequestMap>

export type MainToHostRpcEvent = RpcEventName<MainToHostRpcEventMap>

export type HostToMainRpcEvent = RpcEventName<HostToMainRpcEventMap>
