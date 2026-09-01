import type { Disposable, MaybePromise } from '../../shared'

export type DeeplinkRouteParamMap = Record<string, string>

type TrimLeadingSlash<TValue extends string> = TValue extends `/${infer TRest}`
  ? TrimLeadingSlash<TRest>
  : TValue

type SegmentParamName<TSegment extends string> = TSegment extends `:${infer TName}`
  ? TName extends ''
    ? never
    : TName
  : TSegment extends `*${infer TName}`
    ? TName extends ''
      ? never
      : TName
    : never

type RouteParamNames<TPattern extends string> =
  TrimLeadingSlash<TPattern> extends ''
    ? never
    : TrimLeadingSlash<TPattern> extends `${infer THead}/${infer TTail}`
      ? SegmentParamName<THead> | RouteParamNames<TTail>
      : SegmentParamName<TrimLeadingSlash<TPattern>>

export type DeeplinkRouteParams<TPattern extends string> = string extends TPattern
  ? DeeplinkRouteParamMap
  : [RouteParamNames<TPattern>] extends [never]
    ? Record<never, never>
    : { [TName in RouteParamNames<TPattern>]: string }

export interface DeeplinkRouteHandleEvent<TPattern extends string = string> {
  /** Route path relative to the extension's namespace, e.g. `/oauth-callback`. */
  path: string
  pattern: TPattern
  params: DeeplinkRouteParams<TPattern>
  /** Query payload of the deeplink; values are untrusted external input. */
  query: DeeplinkRouteParamMap
}

/**
 * Outcome of handling a deeplink. It feeds the host's logging only; user
 * feedback for a failure belongs to the extension, which owns the flow.
 */
export interface DeeplinkRouteHandleResult {
  status: 'handled' | 'failed'
  message?: string | undefined
}

export interface DeeplinkRouteContribution<TPattern extends string = string> {
  id: string
  /** Route pattern relative to `kisaki://ext/<extensionId>`, e.g. `/oauth-callback`. */
  path: TPattern
  /**
   * Whether a matching deeplink brings the main window to the foreground
   * before the route runs. Defaults to true, which fits user-facing bounces
   * such as OAuth callbacks; machine-facing routes opt out.
   */
  focus?: boolean | undefined
  handle(event: DeeplinkRouteHandleEvent<TPattern>): MaybePromise<DeeplinkRouteHandleResult>
}

export interface DeeplinkRouteRegistration extends Disposable {
  /** Absolute deeplink URL of the route, e.g. usable as an OAuth callback URL. */
  readonly urlPattern: string
}

export interface DeeplinkRouteRegistrar {
  register<const TPattern extends string>(
    route: DeeplinkRouteContribution<TPattern>
  ): DeeplinkRouteRegistration
}
