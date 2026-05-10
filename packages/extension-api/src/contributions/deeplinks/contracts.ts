import type { Disposable, MaybePromise, SerializableValue } from '../../shared'

export interface DeeplinkRouteHandleEvent {
  path: string
  params: Record<string, string>
  rawUrl: string
}

export interface DeeplinkRouteHandleResult {
  success: boolean
  status?: 'handled' | 'ignored' | 'error'
  message?: string
  data?: SerializableValue
}

export interface DeeplinkRouteContribution {
  id: string
  path: string
  handle(event: DeeplinkRouteHandleEvent): MaybePromise<DeeplinkRouteHandleResult>
}

export interface DeeplinkRouteRegistration extends Disposable {
  readonly url: string
}

export interface DeeplinkRouteRegistrar {
  register(route: DeeplinkRouteContribution): DeeplinkRouteRegistration
}
