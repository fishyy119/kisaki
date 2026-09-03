import type { Ref, ShallowRef } from 'vue'
import type { RouteLocationNormalizedGeneric } from 'vue-router'
import type { TableName } from '@shared/db/table-names'
import type { IpcRendererEvents } from '@shared/ipc'
import type { ParamRefs } from './params'

export type IpcEventChannel = keyof IpcRendererEvents

/**
 * What makes a query's result stale: the tables its fetch reads (a change
 * batch touching any of them reruns it) and the main-process events that
 * replace its source wholesale. `tables` may depend on the query's context
 * when the read set follows the inputs or the loaded data; while the data is
 * unknown it answers with its upper bound.
 */
export interface QueryInvalidation<TContext> {
  tables?: readonly TableName[] | ((context: TContext) => readonly TableName[])
  ipc?: readonly IpcEventChannel[]
}

export interface RouteQueryInputs<TKey extends string, TParams extends object> {
  key: TKey
  params: TParams
}

export interface RouteQueryFetchInput<
  TKey extends string,
  TParams extends object,
  TView
> extends RouteQueryInputs<TKey, TParams> {
  view: TView
  signal: AbortSignal
}

export interface RouteQueryContext<
  TKey extends string,
  TParams extends object,
  TData
> extends RouteQueryInputs<TKey, TParams> {
  data: TData | null | undefined
}

/**
 * A route query is a function of three inputs. The `key` names the identity
 * the route shows (an entity id, a report type, a constant); `params` are the
 * page's own in-page inputs (a list query, a period), recomputed when the key
 * changes and persisting across navigations while it does not; `view` is
 * every external reactive input (preferences, stores).
 */
export interface RouteQuerySpec<TKey extends string, TParams extends object, TView, TData> {
  /** Unique; the registry key and the name in every error message. */
  name: string
  /** Identity the route shows; null when the route names no valid identity. */
  key: (route: RouteLocationNormalizedGeneric) => TKey | null
  /** In-page inputs; recomputed only when the key changes, with the previous params in hand. */
  params?: (key: TKey, previous: TParams | null) => TParams
  /** External reactive inputs; a change reloads the active query. */
  view?: () => TView
  fetch: (input: RouteQueryFetchInput<TKey, TParams, TView>) => Promise<TData | null>
  invalidate?: QueryInvalidation<RouteQueryContext<TKey, TParams, TData>>
}

export interface RouteQuerySurface<TParams extends object, TData> {
  /**
   * `undefined`: none (the navigation load failed, or the query is not
   * active). `null`: the key was absent or the entity does not exist.
   * Otherwise the content.
   */
  data: Readonly<ShallowRef<TData | null | undefined>>
  /** Set only by a committed navigation load failure; implies `data === undefined`. */
  error: Readonly<Ref<string | null>>
  /** Any run is in flight. */
  isFetching: Readonly<Ref<boolean>>
  params: ParamRefs<TParams>
  reload: () => Promise<void>
}
