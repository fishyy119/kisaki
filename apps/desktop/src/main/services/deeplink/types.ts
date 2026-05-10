import type { DeeplinkResult, DeeplinkRouteContext } from '@shared/deeplink'

export type {
  DeeplinkResult,
  DeeplinkRouteContext,
  DeeplinkRouteInfo,
  DeeplinkRouteParams,
  ParsedDeeplink
} from '@shared/deeplink'

export interface DeeplinkRouteHandler<TPattern extends string = string> {
  handle: (deeplink: DeeplinkRouteContext<TPattern>) => Promise<DeeplinkResult>
}
