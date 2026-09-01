/**
 * Routing runtime contract of the deeplink service. Main-process only; the
 * wire format (scheme, parsing, pattern grammar) lives in `@shared/deeplink`.
 */

import type { DeeplinkRequest, DeeplinkRouteParams } from '@shared/deeplink'

/** Handler input: the parsed request plus the matched pattern and its params. */
export interface DeeplinkRouteContext<TPattern extends string = string> extends DeeplinkRequest {
  pattern: TPattern
  params: DeeplinkRouteParams<TPattern>
}

/**
 * Handler-reported outcome, consumed only by the service's single-point
 * logging. User feedback for a failure belongs to the handler that owns the
 * flow; the service notifies only for failures nobody owns (invalid or
 * unmatched links).
 */
export type DeeplinkOutcome = { status: 'handled' } | { status: 'failed'; message: string }

export type DeeplinkRouteHandler<TPattern extends string = string> = (
  context: DeeplinkRouteContext<TPattern>
) => Promise<DeeplinkOutcome> | DeeplinkOutcome

export interface DeeplinkRouteOptions {
  /** Whether a match brings the main window to the foreground before handling. */
  focus: boolean
}
