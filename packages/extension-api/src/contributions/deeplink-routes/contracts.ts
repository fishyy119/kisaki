import type { Disposable, MaybePromise, SerializableValue } from '../../shared'

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
  path: string
  pattern: TPattern
  params: DeeplinkRouteParams<TPattern>
  query: DeeplinkRouteParamMap
  rawUrl: string
}

export interface DeeplinkRouteHandleResult {
  success: boolean
  status?: 'handled' | 'ignored' | 'error'
  message?: string
  data?: SerializableValue
}

export interface DeeplinkRouteContribution<TPattern extends string = string> {
  id: string
  path: TPattern
  handle(event: DeeplinkRouteHandleEvent<TPattern>): MaybePromise<DeeplinkRouteHandleResult>
}

export interface DeeplinkRouteRegistration extends Disposable {
  readonly urlPattern: string
}

export interface DeeplinkRouteRegistrar {
  register<const TPattern extends string>(
    route: DeeplinkRouteContribution<TPattern>
  ): DeeplinkRouteRegistration
}
