/**
 * Route-level data loading
 *
 * Navigation-blocking data loaders: a global `beforeResolve` guard awaits the
 * loaders declared on the matched records' `meta.dataLoaders`, so the previous
 * page stays fully visible until the next page's data has settled and route
 * pages never render a loading state on their first frame. Loader wiring is
 * owned by the feature route manifests (`features/<feature>/routes.ts`); this
 * kernel has no feature knowledge.
 *
 * Each loader owns a module-level store (route page data is a singleton per
 * loader; the app renders one RouterView). Fetch failures are captured into
 * the loader's `error` ref and never block navigation.
 */

import { ref, shallowRef, type Ref } from 'vue'
import type { Router, RouteLocationNormalizedGeneric } from 'vue-router'
import { createLogger } from '@renderer/core/log'

const log = createLogger('RouteData')

// =============================================================================
// Types
// =============================================================================

/** Guard-facing handle declared on route meta. */
export interface RouteDataHandle {
  load: (route: RouteLocationNormalizedGeneric) => Promise<void>
}

// Named `dataLoaders` because vue-router already reserves `meta.loaders`
// for its own experimental data loader API.
declare module 'vue-router' {
  interface RouteMeta {
    /** Loaders awaited in beforeResolve before the navigation is confirmed */
    dataLoaders?: RouteDataHandle[]
  }
}

export interface UseRouteDataReturn<T> {
  /** Loaded data; settled before the page mounts */
  data: Readonly<Ref<T | undefined>>
  /** Safe error summary from the last load or refetch */
  error: Readonly<Ref<string | null>>
  /** True while a fetch is in flight (navigation load or refetch) */
  isFetching: Readonly<Ref<boolean>>
  /** Re-run the fetcher with the current route; old data stays until settled */
  refetch: () => Promise<void>
}

export interface RouteDataLoader<T> extends RouteDataHandle {
  (): UseRouteDataReturn<T>
}

// =============================================================================
// Loader definition
// =============================================================================

/**
 * Define a route data loader.
 *
 * The returned value is both a composable (call inside the page/provider to
 * read the settled data) and a guard handle (`load` is invoked by the global
 * beforeResolve for routes that declare it in `meta.dataLoaders`).
 *
 * `refetch` re-runs the fetcher against the last loaded route without
 * clearing current data (SWR), for db-event invalidation and in-page
 * parameter changes.
 */
export function defineRouteData<T>(
  fetcher: (route: RouteLocationNormalizedGeneric) => Promise<T>
): RouteDataLoader<T> {
  const data = shallowRef<T | undefined>(undefined)
  const error = shallowRef<string | null>(null)
  const isFetching = ref(false)

  let currentRoute: RouteLocationNormalizedGeneric | null = null
  let runId = 0

  async function run(route: RouteLocationNormalizedGeneric, isNavigation: boolean): Promise<void> {
    const id = ++runId
    isFetching.value = true
    try {
      const result = await fetcher(route)
      // Discard results of runs superseded by a newer load/refetch
      if (id !== runId) return
      data.value = result
      error.value = null
    } catch (e) {
      if (id !== runId) return
      log.error('Route data load failed.', e)
      error.value = e instanceof Error ? e.message : String(e)
      // Data from a previous route must not leak into the failed navigation
      if (isNavigation) data.value = undefined
    } finally {
      if (id === runId) isFetching.value = false
    }
  }

  async function load(route: RouteLocationNormalizedGeneric): Promise<void> {
    currentRoute = route
    await run(route, true)
  }

  async function refetch(): Promise<void> {
    if (!currentRoute) return
    await run(currentRoute, false)
  }

  const use = (): UseRouteDataReturn<T> => ({ data, error, isFetching, refetch })

  return Object.assign(use, { load })
}

// =============================================================================
// Router installation
// =============================================================================

const navigationPending = ref(false)

/** True while a navigation (including its data loaders) is in flight. */
export const isNavigationPending: Readonly<Ref<boolean>> = navigationPending

/** Register the global data-loading guard and navigation pending tracking. */
export function installRouteData(router: Router): void {
  router.beforeEach(() => {
    navigationPending.value = true
  })

  router.beforeResolve(async (to) => {
    // A loader may be declared on several matched records (a layout and its
    // children, or sibling routes sharing one dataset); it runs once.
    const loaders = new Set(to.matched.flatMap((record) => record.meta.dataLoaders ?? []))
    if (loaders.size > 0) {
      await Promise.all([...loaders].map((loader) => loader.load(to)))
    }
  })

  router.afterEach(() => {
    navigationPending.value = false
  })

  router.onError(() => {
    navigationPending.value = false
  })
}
