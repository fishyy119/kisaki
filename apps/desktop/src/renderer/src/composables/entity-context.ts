/**
 * Entity detail context factory.
 *
 * One implementation of the provider/consumer shell every entity detail
 * surface shares: a route data resource keyed by the entity id (params reset
 * across entries, invalidation attributed to the entity), a dialog provider
 * that fetches after mount and evaluates the same invalidation declaration,
 * computed projections over the fetched data, and the injected consumer.
 * What an entity fetches — its data shape, its in-page params, its queries,
 * and the tables those queries read — stays in its own `use-<entity>.ts` as
 * the spec.
 */

import {
  computed,
  inject,
  provide,
  ref,
  shallowRef,
  toRef,
  toValue,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref
} from 'vue'
import { storeToRefs } from 'pinia'
import { ENTITY_TABLES } from '@renderer/core/db'
import {
  buildDbPredicate,
  defineRouteData,
  projectParams,
  type RouteData,
  type RouteDataInvalidate,
  type RouteDataParams
} from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { entityRouteParam } from '@renderer/utils/entity-routes'
import type { AllEntityType } from '@shared/entity-types'
import type { TableName } from '@shared/db/table-names'
import { useAsyncData } from './use-async-data'
import { useDbChanges } from './use-db-changes'

/** Global visibility preference every detail fetch filters by. */
export interface EntityDetailView {
  showNsfw: boolean
}

/** What a spec's read-set declaration may depend on. */
export interface EntityDetailReadsContext<TData extends object, TParams extends object> {
  params: TParams
  /** The loaded data when known; a declaration that needs it returns its upper bound otherwise. */
  data: TData | null | undefined
}

export interface EntityDetailSpec<TData extends object, TParams extends object> {
  /** Entity type; names the context and derives the detail-route param. */
  entityType: AllEntityType
  /** Field defaults projected while data is unsettled or hidden. */
  empty: TData
  /**
   * In-page fetch parameters. The route surface resets them whenever a
   * different entry loads; a dialog keeps its own per instance.
   */
  initialParams(): TParams
  fetch(id: string, params: TParams, view: EntityDetailView): Promise<TData | null>
  /**
   * Every table `fetch` reads besides the entity's own table: owned rows,
   * link rows, and the satellite tables the links join. Rows that reference
   * the entity are attributed to it by the schema; satellite tables match by
   * table.
   */
  reads:
    | readonly TableName[]
    | ((context: EntityDetailReadsContext<TData, TParams>) => readonly TableName[])
}

export interface EntityDetailContextBase {
  /** Initial loading state (always false on the route surface after mount) */
  isLoading: Ref<boolean>
  /** Background refetching state */
  isFetching: Ref<boolean>
  /** Error if any */
  error: Ref<string | null>
  /** Manually refetch data */
  refetch: () => Promise<void>
}

export type EntityDetailContext<TData extends object> = {
  readonly [K in keyof TData]: ComputedRef<TData[K]>
} & EntityDetailContextBase

/** One writable ref per in-page param; a set replaces the params and refetches (SWR). */
export type EntityDetailParams<TParams extends object> = RouteDataParams<TParams>

export type EntityDetailProviderReturn<
  TData extends object,
  TParams extends object
> = EntityDetailContext<TData> & {
  params: EntityDetailParams<TParams>
}

/** In-page params shared by the content entity detail specs. */
export interface EntitySpoilerParams {
  /** Whether spoiler-flagged links show. */
  spoilersRevealed: boolean
}

export function createEntitySpoilerParams(): EntitySpoilerParams {
  return { spoilersRevealed: false }
}

export interface EntityDetailContextApi<TData extends object, TParams extends object> {
  key: InjectionKey<EntityDetailContext<TData>>
  /** Route data resource; declare on the detail route's `meta.routeData`. */
  detailData: RouteData<TParams, TData>
  /**
   * Provide entity data on the route surface.
   *
   * Data is committed by the route data kernel when the navigation confirms,
   * so it is already settled when the page mounts. In-page changes (params,
   * NSFW preference, db changes) trigger a non-blocking SWR refetch.
   */
  useRouteProvider(): EntityDetailProviderReturn<TData, TParams>
  /**
   * Provide entity data on the dialog surface (fetches after mount).
   *
   * Params are instance-local and reset when the dialog unmounts.
   */
  useDialogProvider(id: MaybeRefOrGetter<string>): EntityDetailProviderReturn<TData, TParams>
  /** Consume the context provided by one of the providers above. */
  useContext(): EntityDetailContext<TData>
}

interface EntityDetailSource<TData extends object> {
  data: Readonly<Ref<TData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

export function createEntityDetailContext<TData extends object, TParams extends object>(
  spec: EntityDetailSpec<TData, TParams>
): EntityDetailContextApi<TData, TParams> {
  const key: InjectionKey<EntityDetailContext<TData>> = Symbol(spec.entityType)
  const routeParam = entityRouteParam(spec.entityType)
  const entityTable = ENTITY_TABLES[spec.entityType].tableName

  // One declaration serves both surfaces: the entity's own table plus what
  // the spec reads, attributed to the entity itself.
  const invalidate: RouteDataInvalidate<string, TParams, TData> = {
    reads: ({ params, data }) => [
      entityTable,
      ...(typeof spec.reads === 'function' ? spec.reads({ params, data }) : spec.reads)
    ],
    scope: ({ key: id }) => [{ entity: spec.entityType, id }]
  }

  const detailData = defineRouteData<string, TParams, EntityDetailView, TData>({
    name: `${spec.entityType}-detail`,
    key: (route) => {
      const id = route.params[routeParam]
      return typeof id === 'string' && id !== '' ? id : null
    },
    params: () => spec.initialParams(),
    view: () => {
      const { showNsfw } = storeToRefs(usePreferencesStore())
      return { showNsfw: showNsfw.value }
    },
    fetch: ({ key: id, params, view }) => spec.fetch(id, params, view),
    invalidate
  })

  function provideContext(source: EntityDetailSource<TData>): EntityDetailContext<TData> {
    // The projection is mechanical over the spec's empty shape; the factory
    // owns the correlation between data keys and their computed refs.
    const projected = Object.fromEntries(
      (Object.keys(spec.empty) as Array<keyof TData & string>).map((field) => [
        field,
        computed(() => source.data.value?.[field] ?? spec.empty[field])
      ])
    ) as { [K in keyof TData]: ComputedRef<TData[K]> }

    const context: EntityDetailContext<TData> = {
      ...projected,
      isLoading: source.isLoading,
      isFetching: source.isFetching,
      error: source.error,
      refetch: source.refetch
    }

    provide(key, context)
    return context
  }

  function useRouteProvider(): EntityDetailProviderReturn<TData, TParams> {
    const { data, error, isFetching, params, reload } = detailData()

    const context = provideContext({
      data,
      isLoading: ref(false),
      isFetching,
      error,
      refetch: reload
    })

    return { ...context, params }
  }

  function useDialogProvider(
    id: MaybeRefOrGetter<string>
  ): EntityDetailProviderReturn<TData, TParams> {
    const entityId = toRef(id)
    const instanceParams = shallowRef<TParams>(spec.initialParams())
    const { showNsfw } = storeToRefs(usePreferencesStore())

    const { data, isLoading, isFetching, error, refetch } = useAsyncData(
      () => spec.fetch(toValue(entityId), instanceParams.value, { showNsfw: showNsfw.value }),
      { watch: [entityId, instanceParams, showNsfw] }
    )

    const params = projectParams(
      () => instanceParams.value,
      (next) => {
        instanceParams.value = next
      }
    )

    const context = provideContext({ data, isLoading, isFetching, error, refetch })

    // The dialog evaluates the same declaration the route resource declares.
    const predicate = computed(() =>
      buildDbPredicate(invalidate, {
        key: toValue(entityId),
        params: instanceParams.value,
        data: data.value
      })
    )
    useDbChanges((batch) => {
      if (predicate.value?.(batch)) void refetch()
    })

    return { ...context, params }
  }

  function useContext(): EntityDetailContext<TData> {
    const context = inject(key)
    if (!context) {
      throw new Error(`The ${spec.entityType} context must be consumed under one of its providers`)
    }
    return context
  }

  return { key, detailData, useRouteProvider, useDialogProvider, useContext }
}
