/**
 * Entity detail context factory.
 *
 * One implementation of the provider/consumer shell every entity detail
 * surface shares: a route loader that settles during navigation (with the
 * in-page params reset across entries), a dialog provider that fetches after
 * mount, computed projections over the fetched data, db-change invalidation,
 * and the injected consumer. What an entity fetches — its data shape, its
 * in-page params, and its queries — stays in its own `use-<entity>.ts` as
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
  watch,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
  type WritableComputedRef
} from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { defineRouteData, type RouteDataLoader } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { entityRouteParam } from '@renderer/utils/entity-routes'
import type { AllEntityType } from '@shared/common'
import type { TableName } from '@shared/db/table-names'
import { useAsyncData } from './use-async-data'
import { useDbChanges } from './use-db-changes'

/** Global visibility preference every detail fetch filters by. */
export interface EntityDetailView {
  showNsfw: boolean
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
   * Tables whose any change refetches the context. Decided by the loaded
   * data, since a resolved type or an active filter can widen the set.
   */
  relevantTables(data: TData | null): readonly TableName[]
  /** Entity table whose own-row updates and deletes refetch by id. */
  entityTable: TableName
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
export type EntityDetailParams<TParams extends object> = {
  readonly [K in keyof TParams]: WritableComputedRef<TParams[K]>
}

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
  /** Route loader; declare on the detail route's `meta.dataLoaders`. */
  detailData: RouteDataLoader<TData | null>
  /**
   * Provide entity data on the route surface.
   *
   * Data is loaded by `detailData` during navigation, so it is already
   * settled when the page mounts. In-page changes (params, NSFW preference)
   * trigger a non-blocking SWR refetch.
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

  // The param keys are fixed by the spec; enumerated once for the projection.
  const paramKeys = Object.keys(spec.initialParams()) as Array<keyof TParams & string>

  // Route-surface params live beside the loader so the navigation-time fetch
  // reads a consistent value; they reset whenever a different entry loads.
  // Only the loader and the route setter write them; a watcher would turn the
  // cross-navigation reset into a duplicate fetch.
  let lastRouteId: string | null = null
  const routeParams = shallowRef<TParams>(spec.initialParams())

  const detailData = defineRouteData((route) => {
    const id = route.params[routeParam] as string
    if (id !== lastRouteId) {
      lastRouteId = id
      routeParams.value = spec.initialParams()
    }
    const { showNsfw } = storeToRefs(usePreferencesStore())
    return spec.fetch(id, routeParams.value, { showNsfw: showNsfw.value })
  })

  /**
   * Per-key writable refs over one params holder. Params are replaced
   * wholesale through `commit`, never mutated, so a shallow holder sees
   * every change.
   */
  function projectParams(
    read: () => TParams,
    commit: (next: TParams) => void
  ): EntityDetailParams<TParams> {
    return Object.fromEntries(
      paramKeys.map((param) => [
        param,
        computed({
          get: () => read()[param],
          set: (value: TParams[typeof param]) => commit({ ...read(), [param]: value })
        })
      ])
    ) as EntityDetailParams<TParams>
  }

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

  function useDbSync(
    entityId: MaybeRefOrGetter<string>,
    data: Readonly<Ref<TData | null | undefined>>,
    refetch: () => Promise<void>
  ): void {
    const relevantTables = computed(() => new Set(spec.relevantTables(data.value ?? null)))

    useDbChanges(({ operation, table, id }) => {
      if (relevantTables.value.has(table)) {
        refetch()
        return
      }
      if (table === spec.entityTable && id === toValue(entityId) && operation !== 'inserted') {
        refetch()
      }
    })
  }

  function useRouteProvider(): EntityDetailProviderReturn<TData, TParams> {
    const route = useRoute()
    const entityId = computed(() => route.params[routeParam] as string)
    const { data, error, isFetching, refetch } = detailData()

    const { showNsfw } = storeToRefs(usePreferencesStore())
    watch(showNsfw, () => void refetch())

    const params = projectParams(
      () => routeParams.value,
      (next) => {
        routeParams.value = next
        void refetch()
      }
    )

    const context = provideContext({
      data,
      isLoading: ref(false),
      isFetching,
      error,
      refetch
    })
    useDbSync(entityId, data, refetch)

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
    useDbSync(entityId, data, refetch)

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
