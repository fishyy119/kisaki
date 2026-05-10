/**
 * Shared types for the kisaki:// deeplink protocol.
 */

export type DeeplinkParamMap = Record<string, string>

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
  ? DeeplinkParamMap
  : [RouteParamNames<TPattern>] extends [never]
    ? Record<never, never>
    : { [TName in RouteParamNames<TPattern>]: string }

export interface ParsedDeeplink {
  path: string
  query: DeeplinkParamMap
  rawUrl: string
}

export interface DeeplinkRouteContext<TPattern extends string = string> extends ParsedDeeplink {
  pattern: TPattern
  params: DeeplinkRouteParams<TPattern>
}

export interface DeeplinkRouteInfo {
  pattern: string
}

export interface DeeplinkResult {
  success: boolean
  path?: string
  pattern?: string
  message?: string
  data?: unknown
}

export interface DeeplinkNavigatePayload {
  route: string
  query: DeeplinkParamMap
}

export interface DeeplinkAuthCallbackPayload {
  provider: string
  code: string
  state?: string
}

export interface DeeplinkAuthErrorPayload {
  provider: string
  error: string
  errorDescription?: string
}
