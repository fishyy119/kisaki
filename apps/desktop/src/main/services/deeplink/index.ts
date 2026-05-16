/**
 * Deeplink Service
 *
 * Handles kisaki:// protocol deeplinks for the application.
 */

export { DeeplinkService } from './service'
export { DeeplinkRouter } from './router'
export {
  compileDeeplinkRoutePattern,
  matchDeeplinkRoutePath,
  matchNormalizedDeeplinkRoutePath,
  normalizeDeeplinkRoutePath,
  normalizeDeeplinkRoutePattern
} from './route-pattern'
export type { CompiledDeeplinkRoutePattern } from './route-pattern'
export type {
  DeeplinkRouteContext,
  DeeplinkRouteHandler,
  DeeplinkRouteInfo,
  DeeplinkResult,
  ParsedDeeplink
} from './types'
