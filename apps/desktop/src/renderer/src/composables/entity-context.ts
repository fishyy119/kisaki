/**
 * Entity detail context factory.
 *
 * One implementation of the provider/consumer shell every entity detail
 * surface shares: a route loader that settles during navigation (with
 * spoiler-state reset across entries), a dialog provider that fetches after
 * mount, computed projections over the fetched data, db-change invalidation,
 * and the injected consumer. What an entity fetches — its data shape and
 * queries — stays in its own `use-<entity>.ts` as the spec.
 */

import {
  computed,
  inject,
  provide,
  ref,
  toRef,
  toValue,
  watch,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref
} from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { defineRouteData, type RouteDataLoader } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { entityRouteParam } from '@renderer/utils/entity-routes'
import type { AllEntityType } from '@shared/common'
import { useAsyncData } from './use-async-data'
import { useDbChanges } from './use-db-changes'

/** Visibility inputs every detail fetch filters by. */
export interface EntityDetailView {
  spoilersRevealed: boolean
  showNsfw: boolean
}

export interface EntityDetailSpec<TData extends object> {
  /** Entity type; names the context and derives the detail-route param. */
  entityType: AllEntityType
  /** Field defaults projected while data is unsettled or hidden. */
  empty: TData
  fetch(id: string, view: EntityDetailView): Promise<TData | null>
  /** Tables whose any change refetches the context. */
  ownedTables: readonly string[]
  /** Entity table whose own-row updates and deletes refetch by id. */
  entityTable: string
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

export type EntityDetailProviderReturn<TData extends object> = EntityDetailContext<TData> & {
  /** Spoiler reveal state owned by the provider; toggling refetches (SWR) */
  spoilersRevealed: Ref<boolean>
}

export interface EntityDetailContextApi<TData extends object> {
  key: InjectionKey<EntityDetailContext<TData>>
  /** Route loader; declare on the detail route's `meta.dataLoaders`. */
  detailData: RouteDataLoader<TData | null>
  /**
   * Provide entity data on the route surface.
   *
   * Data is loaded by `detailData` during navigation, so it is already
   * settled when the page mounts. In-page input changes (spoilers, NSFW
   * preference) trigger a non-blocking SWR refetch.
   */
  useRouteProvider(): EntityDetailProviderReturn<TData>
  /**
   * Provide entity data on the dialog surface (fetches after mount).
   *
   * Spoiler state is instance-local and resets when the dialog unmounts.
   */
  useDialogProvider(id: MaybeRefOrGetter<string>): EntityDetailProviderReturn<TData>
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

export function createEntityDetailContext<TData extends object>(
  spec: EntityDetailSpec<TData>
): EntityDetailContextApi<TData> {
  const key: InjectionKey<EntityDetailContext<TData>> = Symbol(spec.entityType)
  const routeParam = entityRouteParam(spec.entityType)

  // Route-surface spoiler state lives beside the loader so the navigation-time
  // fetch reads a consistent value; it resets whenever a different entry loads.
  let lastRouteId: string | null = null
  const routeSpoilersRevealed = ref(false)

  const detailData = defineRouteData((route) => {
    const id = route.params[routeParam] as string
    if (id !== lastRouteId) {
      lastRouteId = id
      routeSpoilersRevealed.value = false
    }
    const { showNsfw } = storeToRefs(usePreferencesStore())
    return spec.fetch(id, {
      spoilersRevealed: routeSpoilersRevealed.value,
      showNsfw: showNsfw.value
    })
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

  function useDbSync(entityId: MaybeRefOrGetter<string>, refetch: () => Promise<void>): void {
    useDbChanges(({ operation, table, id }) => {
      if (spec.ownedTables.includes(table)) {
        refetch()
        return
      }
      if (table === spec.entityTable && id === toValue(entityId) && operation !== 'inserted') {
        refetch()
      }
    })
  }

  function useRouteProvider(): EntityDetailProviderReturn<TData> {
    const route = useRoute()
    const entityId = computed(() => route.params[routeParam] as string)
    const { data, error, isFetching, refetch } = detailData()

    const { showNsfw } = storeToRefs(usePreferencesStore())
    watch(showNsfw, () => void refetch())

    // Explicit setter (not a watcher on the module ref) so the loader's
    // cross-navigation spoiler reset does not trigger a duplicate fetch.
    const spoilersRevealed = computed({
      get: () => routeSpoilersRevealed.value,
      set: (value) => {
        routeSpoilersRevealed.value = value
        void refetch()
      }
    })

    const context = provideContext({
      data,
      isLoading: ref(false),
      isFetching,
      error,
      refetch
    })
    useDbSync(entityId, refetch)

    return { ...context, spoilersRevealed }
  }

  function useDialogProvider(id: MaybeRefOrGetter<string>): EntityDetailProviderReturn<TData> {
    const entityId = toRef(id)
    const spoilersRevealed = ref(false)
    const { showNsfw } = storeToRefs(usePreferencesStore())

    const { data, isLoading, isFetching, error, refetch } = useAsyncData(
      () =>
        spec.fetch(toValue(entityId), {
          spoilersRevealed: spoilersRevealed.value,
          showNsfw: showNsfw.value
        }),
      { watch: [entityId, spoilersRevealed, showNsfw] }
    )

    const context = provideContext({ data, isLoading, isFetching, error, refetch })
    useDbSync(entityId, refetch)

    return { ...context, spoilersRevealed }
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
