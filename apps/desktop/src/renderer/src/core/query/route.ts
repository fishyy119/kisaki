/**
 * Route queries
 *
 * A route page reads exactly one copy of its data: the copy that is being
 * displayed, and that copy is the truth as of the last change batch.
 *
 * Navigation loads are staged under the navigation that requested them and
 * committed in `afterEach` only when that navigation is confirmed, so a
 * superseded navigation never touches what the visible page reads. While a
 * load is staged the navigation owns the query: every in-page trigger
 * (params, view, invalidation, reload) only marks the staging dirty, and one
 * rerun follows the commit or the discard. Outside a navigation, in-page
 * requests share one serial runner: one run in flight, one trailing rerun.
 */

import { computed, effectScope, ref, shallowRef, watch, type EffectScope, type Ref } from 'vue'
import type { NavigationFailure, RouteLocationNormalizedGeneric, Router } from 'vue-router'
import { batchTouchesAny, type DbChangeBatch } from '@shared/db/changes'
import type { TableName } from '@shared/db/table-names'
import { messages } from '@renderer/core/i18n'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { resolveTables, subscribeDbChanges, subscribeIpc } from './invalidation'
import { projectParams } from './params'
import { createSerialRunner } from './runner'
import type { RouteQueryFetchInput, RouteQuerySpec, RouteQuerySurface } from './types'

const log = createLogger('RouteQuery')

/** A single load past this is a data-layer defect, not a router one. */
const LOAD_BUDGET_MS = 100

const QUERY = Symbol('routeQuery')

/** Guard-facing handle declared on route meta. */
export interface RouteQueryHandle {
  readonly name: string
  readonly [QUERY]: RouteQueryController
}

export interface RouteQuery<TParams extends object, TData> extends RouteQueryHandle {
  (): RouteQuerySurface<TParams, TData>
}

declare module 'vue-router' {
  interface RouteMeta {
    /** Queries loaded before the navigation confirms and committed with it. */
    routeQueries?: readonly RouteQueryHandle[]
  }
}

// =============================================================================
// Resource
// =============================================================================

interface Navigation {
  location: RouteLocationNormalizedGeneric
  controller: AbortController
}

interface Settled<TData> {
  data: TData | null | undefined
  error: string | null
}

interface Staging<TKey extends string, TParams extends object, TView, TData> {
  navigation: Navigation
  key: TKey | null
  params: TParams | null
  view: TView
  /** Read set while the result is unknown: the declaration's upper bound. */
  tables: ReadonlySet<TableName>
  /** An invalidation matched while staged; one rerun follows the commit or the discard. */
  dirty: boolean
  settled: Settled<TData> | null
}

/** What the kernel drives; the generic resource behind every handle. */
export interface RouteQueryController {
  readonly name: string
  wire(): void
  prepare(navigation: Navigation): Promise<void> | null
  commit(navigation: Navigation): void
  discard(navigation: Navigation): void
  deactivate(): void
}

const NOT_ACTIVE = Symbol('notActive')
const NO_TABLES: ReadonlySet<TableName> = new Set()

/** Params holder of a spec without params; one shared object so identity comparisons hold. */
const EMPTY_PARAMS = Object.freeze({})

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  return keys.every((key) => Object.is(left[key], right[key]))
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

class RouteQueryResource<
  TKey extends string,
  TParams extends object,
  TView,
  TData
> implements RouteQueryController {
  readonly name: string

  // Committed state: what pages read.
  readonly data = shallowRef<TData | null | undefined>(undefined)
  readonly error = ref<string | null>(null)
  readonly isFetching = ref(false)
  readonly params = shallowRef<TParams | null>(null)
  readonly active = ref(false)

  private committedKey: TKey | null = null
  private committedView: TView | undefined = undefined
  private committedTables: ReadonlySet<TableName> = NO_TABLES
  /** Bumps on every committed-input change; a run whose generation is stale drops its result. */
  private generation = 0

  /** Survives deactivation: params persist across navigations while the key is unchanged. */
  private memory: { key: TKey; params: TParams } | null = null

  private staging: Staging<TKey, TParams, TView, TData> | null = null

  private readonly runner = createSerialRunner({
    run: (signal) => this.runRefresh(signal),
    onIdle: () => {
      if (this.staging === null) this.isFetching.value = false
    }
  })

  private readonly surface: RouteQuerySurface<TParams, TData>

  constructor(private readonly spec: RouteQuerySpec<TKey, TParams, TView, TData>) {
    this.name = spec.name
    this.surface = {
      data: this.data,
      error: this.error,
      isFetching: this.isFetching,
      params: projectParams(
        () => this.params.value,
        (next) => this.setParams(next)
      ),
      reload: () => this.refresh()
    }
  }

  // ---------------------------------------------------------------------------
  // Consumer
  // ---------------------------------------------------------------------------

  use(): RouteQuerySurface<TParams, TData> {
    if (!this.active.value) {
      throw new Error(
        `Route query "${this.name}" is consumed on a route that does not declare it in meta.routeQueries.`
      )
    }
    return this.surface
  }

  // ---------------------------------------------------------------------------
  // Wiring (inside the kernel's effect scope)
  // ---------------------------------------------------------------------------

  wire(): void {
    subscribeDbChanges((batch) => this.onDbBatch(batch))
    for (const channel of this.spec.invalidate?.ipc ?? []) {
      subscribeIpc(channel, () => this.onIpc())
    }

    const { view } = this.spec
    if (!view) return
    watch(
      () => (this.active.value ? view() : NOT_ACTIVE),
      (next) => {
        if (next === NOT_ACTIVE) return
        if (shallowEqual(next, this.committedView)) return
        void this.refresh()
      }
    )
  }

  // ---------------------------------------------------------------------------
  // Navigation protocol
  // ---------------------------------------------------------------------------

  prepare(navigation: Navigation): Promise<void> | null {
    const key = this.spec.key(navigation.location)
    const params = this.paramsFor(key)
    const view = this.readView()

    if (
      this.active.value &&
      this.staging === null &&
      key === this.committedKey &&
      params === this.params.value &&
      shallowEqual(view, this.committedView)
    ) {
      return null
    }

    const staging: Staging<TKey, TParams, TView, TData> = {
      navigation,
      key,
      params,
      view,
      tables: this.tablesFor(key, params, undefined),
      dirty: false,
      settled: null
    }
    this.staging = staging

    if (key === null || params === null) {
      staging.settled = { data: null, error: null }
      return null
    }

    if (this.active.value) this.isFetching.value = true
    return this.execute({ key, params, view, signal: navigation.controller.signal }).then(
      (settled) => {
        staging.settled = settled
      }
    )
  }

  commit(navigation: Navigation): void {
    this.active.value = true

    const staging = this.staging
    if (!staging || staging.navigation !== navigation) return
    this.staging = null

    this.committedKey = staging.key
    this.committedView = staging.view
    this.params.value = staging.params
    this.generation++
    if (staging.key !== null && staging.params !== null) {
      this.memory = { key: staging.key, params: staging.params }
    }
    // The guard awaited the load, so it has settled by the time the navigation is confirmed.
    if (staging.settled) this.apply(staging.settled)
    this.isFetching.value = this.runner.inFlight

    if (staging.dirty || !shallowEqual(staging.view, this.readView())) void this.refresh()
  }

  discard(navigation: Navigation): void {
    if (!this.staging || this.staging.navigation !== navigation) return
    const { dirty } = this.staging
    this.staging = null

    if (!this.active.value) return
    this.isFetching.value = this.runner.inFlight
    if (dirty) void this.refresh()
  }

  deactivate(): void {
    if (!this.active.value && this.staging === null) return

    this.active.value = false
    this.staging = null
    this.runner.abort()

    this.committedKey = null
    this.committedView = undefined
    this.committedTables = NO_TABLES
    this.params.value = null
    this.generation++
    this.data.value = undefined
    this.error.value = null
    this.isFetching.value = false
  }

  // ---------------------------------------------------------------------------
  // Invalidation
  // ---------------------------------------------------------------------------

  private onDbBatch(batch: DbChangeBatch): void {
    if (this.staging) {
      if (
        batchTouchesAny(batch, this.staging.tables) ||
        batchTouchesAny(batch, this.committedTables)
      ) {
        this.staging.dirty = true
      }
      return
    }
    if (this.active.value && batchTouchesAny(batch, this.committedTables)) void this.refresh()
  }

  private onIpc(): void {
    if (this.staging) {
      this.staging.dirty = true
      return
    }
    if (this.active.value) void this.refresh()
  }

  // ---------------------------------------------------------------------------
  // In-page protocol
  // ---------------------------------------------------------------------------

  private setParams(next: TParams): void {
    if (!this.active.value || this.committedKey === null) return
    this.params.value = next
    this.memory = { key: this.committedKey, params: next }
    this.committedTables = this.tablesFor(this.committedKey, next, this.data.value)
    this.generation++
    void this.refresh()
  }

  private refresh(): Promise<void> {
    if (!this.active.value) return Promise.resolve()
    if (this.staging) {
      this.staging.dirty = true
      return Promise.resolve()
    }
    this.isFetching.value = true
    return this.runner.request()
  }

  private async runRefresh(signal: AbortSignal): Promise<void> {
    const key = this.committedKey
    const params = this.params.value
    if (key === null || params === null) return

    const generation = this.generation
    const view = this.readView()
    const settled = await this.execute({ key, params, view, signal })
    if (signal.aborted || !this.active.value || this.generation !== generation) return

    if (settled.error !== null) {
      // The displayed data stays; the failure is reported, not painted over it.
      log.error(`Route query "${this.name}" failed to reload.`, settled.error)
      notify.error(messages.value.feedback.operationFailed, settled.error)
      return
    }
    this.data.value = settled.data
    this.committedView = view
    this.committedTables = this.tablesFor(key, params, settled.data)
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private paramsFor(key: TKey | null): TParams | null {
    if (key === null) return null
    if (this.memory && this.memory.key === key) return this.memory.params
    return this.spec.params
      ? this.spec.params(key, this.memory?.params ?? null)
      : (EMPTY_PARAMS as TParams)
  }

  private readView(): TView {
    return this.spec.view?.() as TView
  }

  private tablesFor(
    key: TKey | null,
    params: TParams | null,
    data: TData | null | undefined
  ): ReadonlySet<TableName> {
    if (key === null || params === null) return NO_TABLES
    return resolveTables(this.spec.invalidate, { key, params, data })
  }

  private apply(settled: Settled<TData>): void {
    this.data.value = settled.data
    this.error.value = settled.error
    this.committedTables = this.tablesFor(this.committedKey, this.params.value, settled.data)
  }

  private async execute(
    input: RouteQueryFetchInput<TKey, TParams, TView>
  ): Promise<Settled<TData>> {
    const startedAt = performance.now()
    try {
      const data = await this.spec.fetch(input)
      return { data, error: null }
    } catch (error) {
      if (input.signal.aborted) return { data: undefined, error: null }
      log.error(`Route query "${this.name}" failed to load.`, error)
      return { data: undefined, error: describeError(error) }
    } finally {
      const elapsed = performance.now() - startedAt
      if (import.meta.env.DEV && elapsed > LOAD_BUDGET_MS) {
        log.warn(
          `Route query "${this.name}" took ${Math.round(elapsed)} ms; the budget is ${LOAD_BUDGET_MS} ms.`
        )
      }
    }
  }
}

// =============================================================================
// Registry
// =============================================================================

const registry = new Map<string, RouteQueryController>()
let scope: EffectScope | null = null

function register(resource: RouteQueryController): void {
  if (registry.has(resource.name)) {
    throw new Error(`Route query "${resource.name}" is defined twice.`)
  }
  registry.set(resource.name, resource)
  scope?.run(() => resource.wire())
}

/**
 * Define a route query.
 *
 * The returned value is a composable (call it inside the page to read the
 * committed surface) and the handle a route declares in `meta.routeQueries`.
 */
export function defineRouteQuery<
  TKey extends string,
  TParams extends object = Record<never, never>,
  TView = undefined,
  TData = unknown
>(spec: RouteQuerySpec<TKey, TParams, TView, TData>): RouteQuery<TParams, TData> {
  const resource = new RouteQueryResource(spec)
  register(resource)

  const handle = (() => resource.use()) as RouteQuery<TParams, TData>
  Object.defineProperty(handle, 'name', { value: spec.name })
  Object.defineProperty(handle, QUERY, { value: resource })
  return handle
}

// =============================================================================
// Router installation
// =============================================================================

const pendingLocation = shallowRef<RouteLocationNormalizedGeneric | null>(null)

/** True while a navigation (including its loads) is in flight. */
export const isNavigationPending: Readonly<Ref<boolean>> = computed(
  () => pendingLocation.value !== null
)

function declaredResources(route: RouteLocationNormalizedGeneric): Set<RouteQueryController> {
  const declared = new Set<RouteQueryController>()
  for (const record of route.matched) {
    for (const handle of record.meta.routeQueries ?? []) declared.add(handle[QUERY])
  }
  return declared
}

/** Register the navigation guards and wire every query's invalidation. */
export function installRouteQueries(router: Router): void {
  scope = effectScope(true)
  scope.run(() => {
    for (const resource of registry.values()) resource.wire()
  })

  const navigations = new WeakMap<RouteLocationNormalizedGeneric, Navigation>()
  let current: Navigation | null = null

  function settle(navigation: Navigation, failure: NavigationFailure | Error | undefined): void {
    if (failure) {
      navigation.controller.abort()
      for (const resource of registry.values()) resource.discard(navigation)
    } else {
      const declared = declaredResources(navigation.location)
      for (const resource of registry.values()) {
        if (declared.has(resource)) resource.commit(navigation)
        else resource.deactivate()
      }
    }
    if (current === navigation) current = null
    if (pendingLocation.value === navigation.location) pendingLocation.value = null
  }

  router.beforeEach((to) => {
    current?.controller.abort()
    const navigation: Navigation = { location: to, controller: new AbortController() }
    navigations.set(to, navigation)
    current = navigation
    pendingLocation.value = to
  })

  router.beforeResolve(async (to) => {
    const navigation = navigations.get(to)
    if (!navigation) return

    const waits: Promise<void>[] = []
    for (const resource of declaredResources(to)) {
      const wait = resource.prepare(navigation)
      if (wait) waits.push(wait)
    }
    if (waits.length > 0) await Promise.all(waits)
  })

  router.afterEach((to, _from, failure) => {
    const navigation = navigations.get(to)
    if (navigation) settle(navigation, failure ?? undefined)
  })

  router.onError((error, to) => {
    const navigation = navigations.get(to)
    if (navigation) settle(navigation, error instanceof Error ? error : new Error(String(error)))
  })
}
