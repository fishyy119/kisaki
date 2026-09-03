/**
 * Route data resources
 *
 * A route page surface reads exactly one copy of its data: the copy that is
 * being displayed, and that copy is the truth as of the last change batch.
 * This kernel owns everything that keeps that sentence true.
 *
 * A resource is a function of three inputs. The `key` names the identity the
 * route shows (an entity id, a report type, a constant); `params` are the
 * page's own in-page inputs (a list query, a period), scoped to the key and
 * persisting across navigations while the key is unchanged; `view` is every
 * external reactive input (preferences, stores). `fetch` is pure over the
 * three.
 *
 * Navigation loads are staged under the navigation that requested them and
 * committed atomically in `afterEach` only when that navigation is confirmed,
 * so a superseded navigation never touches what the visible page reads. A
 * resource has one serialized writer: navigation loads supersede in-page
 * runs, in-page requests (params, view, invalidation, reload) coalesce into
 * one in-flight run plus one trailing rerun, and an invalidation that arrives
 * while a run is in flight marks it dirty so the result commits and reruns.
 *
 * Invalidation is declared, never hand-written: `reads` lists the tables the
 * fetch reads and `scope` the entities the resource is about; each read table
 * is attributed by target when the schema says its rows reference an entity
 * kind in scope, and by table otherwise. Blocking is decided by the data
 * source: local data blocks navigation, remote data does not and is the only
 * sanctioned first-frame loading state.
 */

import {
  computed,
  effectScope,
  ref,
  shallowRef,
  watch,
  type EffectScope,
  type Ref,
  type ShallowRef,
  type WritableComputedRef
} from 'vue'
import type { NavigationFailure, RouteLocationNormalizedGeneric, Router } from 'vue-router'
import type { AllEntityType } from '@shared/entity-types'
import type { TableName } from '@shared/db/table-names'
import { aggregateDbChanges, type DbChangeBatch, type DbChangeTarget } from '@shared/db/changes'
import { referencedEntityKinds } from '@shared/db/references'
import type { IpcRendererEvents } from '@shared/ipc'
import { ipcManager } from '@renderer/core/ipc'
import { messages } from '@renderer/core/i18n'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'

const log = createLogger('RouteData')

/** A single navigation load past this is a data-layer defect, not a router one. */
const LOAD_BUDGET_MS = 100

// =============================================================================
// Spec
// =============================================================================

export type IpcEventChannel = keyof IpcRendererEvents

export interface RouteDataInputs<TKey extends string, TParams extends object> {
  key: TKey
  params: TParams
}

export interface RouteDataFetchInput<
  TKey extends string,
  TParams extends object,
  TView
> extends RouteDataInputs<TKey, TParams> {
  view: TView
  signal: AbortSignal
}

/**
 * What a read-set declaration may depend on. `data` is the committed result
 * when one exists; a declaration that needs it (an organizer whose shown type
 * or dynamic config decides the tables) returns its upper bound while it is
 * still unknown.
 */
export interface RouteDataInvalidateContext<
  TKey extends string,
  TParams extends object,
  TData
> extends RouteDataInputs<TKey, TParams> {
  data: TData | null | undefined
}

export interface RouteDataInvalidate<TKey extends string, TParams extends object, TData> {
  /** Every table the fetch reads; may depend on the inputs (a list query's active conditions). */
  reads?:
    | readonly TableName[]
    | ((context: RouteDataInvalidateContext<TKey, TParams, TData>) => readonly TableName[])
  /**
   * The entities the resource is about: a detail is about itself, a
   * collection or tag browse about that collection or tag. Read tables whose
   * rows reference an entity kind in scope are attributed by target.
   */
  scope?: (inputs: RouteDataInputs<TKey, TParams>) => readonly DbChangeTarget[]
  /** Main-process events that invalidate the resource wholesale. */
  ipc?: readonly IpcEventChannel[]
}

export interface RouteDataSpec<TKey extends string, TParams extends object, TView, TData> {
  /** Unique; the registry key and the name in every error message. */
  name: string
  /** Identity the route shows; null when the route names no valid identity. */
  key: (route: RouteLocationNormalizedGeneric) => TKey | null
  /** In-page inputs; recomputed only when the key changes, with the previous params in hand. */
  params?: (key: TKey, previous: TParams | null) => TParams
  /** External reactive inputs; a change reloads the active resource. */
  view?: () => TView
  fetch: (input: RouteDataFetchInput<TKey, TParams, TView>) => Promise<TData | null>
  invalidate?: RouteDataInvalidate<TKey, TParams, TData>
  /** Whether navigation waits for the load. Default true; false only for remote sources. */
  blocking?: boolean
}

// =============================================================================
// Surface
// =============================================================================

/** One writable ref per param; a set replaces the params wholesale. */
export type RouteDataParams<TParams extends object> = {
  readonly [K in keyof TParams]: WritableComputedRef<TParams[K]>
}

export interface RouteDataSurface<TParams extends object, TData> {
  /**
   * `undefined`: none (navigation load failed, non-blocking first load in
   * flight, or inactive). `null`: the key was absent or the entity does not
   * exist. Otherwise the content.
   */
  data: Readonly<ShallowRef<TData | null | undefined>>
  /** Set only by a committed navigation load failure; implies `data === undefined`. */
  error: Readonly<Ref<string | null>>
  /** A non-blocking resource's first load is in flight. */
  isLoading: Readonly<Ref<boolean>>
  /** Any run is in flight. */
  isFetching: Readonly<Ref<boolean>>
  params: RouteDataParams<TParams>
  reload: () => Promise<void>
}

const RESOURCE = Symbol('routeDataResource')

/** Guard-facing handle declared on route meta. */
export interface RouteDataHandle {
  readonly name: string
  readonly [RESOURCE]: ResourceController
}

export interface RouteData<TParams extends object, TData> extends RouteDataHandle {
  (): RouteDataSurface<TParams, TData>
}

declare module 'vue-router' {
  interface RouteMeta {
    /** Resources loaded before the navigation confirms and committed with it. */
    routeData?: readonly RouteDataHandle[]
  }
}

// =============================================================================
// Params projection
// =============================================================================

/**
 * Per-key writable refs over one params holder. Params are replaced
 * wholesale through `commit`, never mutated, so a shallow holder sees every
 * change. Refs are created on first access, so no key enumeration is needed.
 */
export function projectParams<TParams extends object>(
  read: () => TParams | null,
  commit: (next: TParams) => void
): RouteDataParams<TParams> {
  const refs = new Map<PropertyKey, WritableComputedRef<unknown>>()

  return new Proxy({} as RouteDataParams<TParams>, {
    get(_target, property) {
      let projected = refs.get(property)
      if (!projected) {
        projected = computed({
          get: () => (read() as Record<PropertyKey, unknown> | null)?.[property],
          set: (value) => {
            const current = read()
            if (!current) return
            commit({ ...current, [property]: value })
          }
        })
        refs.set(property, projected)
      }
      return projected
    }
  })
}

// =============================================================================
// Db predicate
// =============================================================================

export type DbPredicate = (batch: DbChangeBatch) => boolean

/**
 * Partitions the read tables once, by schema: a table whose rows reference an
 * entity kind in scope matches only changes targeting a scope entity; any
 * other table matches any of its changes. There is no runtime fallback.
 *
 * Exported for surfaces outside routes (dialog providers, persistent panels)
 * that share a resource's declaration and evaluate it themselves.
 */
export function buildDbPredicate<TKey extends string, TParams extends object, TData>(
  invalidate: RouteDataInvalidate<TKey, TParams, TData> | undefined,
  context: RouteDataInvalidateContext<TKey, TParams, TData>
): DbPredicate | null {
  if (!invalidate?.reads) return null

  const reads =
    typeof invalidate.reads === 'function' ? invalidate.reads(context) : invalidate.reads
  const scopeIds = new Map<AllEntityType, Set<string>>()
  for (const target of invalidate.scope?.(context) ?? []) {
    let ids = scopeIds.get(target.entity)
    if (!ids) {
      ids = new Set()
      scopeIds.set(target.entity, ids)
    }
    ids.add(target.id)
  }

  const modes = new Map<TableName, 'table' | 'target'>()
  for (const table of reads) {
    const kinds = referencedEntityKinds(table)
    const attributable = [...scopeIds.keys()].some((kind) => kinds.has(kind))
    modes.set(table, attributable ? 'target' : 'table')
  }

  return (batch) => {
    let touched = false
    for (const table of modes.keys()) {
      if (batch.tables.has(table)) {
        touched = true
        break
      }
    }
    if (!touched) return false

    for (const change of batch.changes) {
      const mode = modes.get(change.table)
      if (!mode) continue
      if (mode === 'table') return true
      for (const target of change.targets) {
        if (scopeIds.get(target.entity)?.has(target.id)) return true
      }
    }
    return false
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
  predicate: DbPredicate | null
  /** A matching invalidation arrived while the run was in flight. */
  dirty: boolean
  settled: Settled<TData> | null
  run: Promise<void>
}

interface ResourceController {
  readonly name: string
  readonly ipcChannels: readonly IpcEventChannel[]
  wire(): void
  prepare(navigation: Navigation): Promise<void> | null
  commit(navigation: Navigation): void
  discard(navigation: Navigation): void
  deactivate(): void
  onDbBatch(batch: DbChangeBatch): void
  onIpc(channel: IpcEventChannel): void
  adopt(previous: ResourceController): void
}

const NOT_ACTIVE = Symbol('notActive')

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

class Resource<
  TKey extends string,
  TParams extends object,
  TView,
  TData
> implements ResourceController {
  readonly name: string
  readonly ipcChannels: readonly IpcEventChannel[]

  // Committed state: what pages read.
  readonly data = shallowRef<TData | null | undefined>(undefined)
  readonly error = ref<string | null>(null)
  readonly isLoading = ref(false)
  readonly isFetching = ref(false)
  readonly params = shallowRef<TParams | null>(null)
  readonly active = ref(false)

  private committedKey: TKey | null = null
  private committedView: TView | undefined = undefined
  private committedPredicate: DbPredicate | null = null
  /** Bumps on every committed-input change; a run whose generation is stale drops its result. */
  private generation = 0

  /** Survives deactivation: params persist across navigations while the key is unchanged. */
  private memory: { key: TKey; params: TParams } | null = null

  private staging: Staging<TKey, TParams, TView, TData> | null = null

  // In-page runs: one in flight, at most one trailing rerun.
  private inflight: AbortController | null = null
  private refreshChain: Promise<void> | null = null
  private trailing = false
  /** An in-page run was superseded by a navigation that then failed. */
  private dirty = false

  private readonly surface: RouteDataSurface<TParams, TData>

  constructor(private readonly spec: RouteDataSpec<TKey, TParams, TView, TData>) {
    this.name = spec.name
    this.ipcChannels = spec.invalidate?.ipc ?? []
    this.surface = {
      data: this.data,
      error: this.error,
      isLoading: this.isLoading,
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

  use(): RouteDataSurface<TParams, TData> {
    if (!this.active.value) {
      throw new Error(
        `Route data "${this.name}" is consumed on a route that does not declare it in meta.routeData.`
      )
    }
    return this.surface
  }

  // ---------------------------------------------------------------------------
  // Wiring (inside the kernel's effect scope)
  // ---------------------------------------------------------------------------

  wire(): void {
    const { view } = this.spec
    if (!view) return
    watch(
      () => (this.active.value ? view() : NOT_ACTIVE),
      (next) => {
        if (next === NOT_ACTIVE) return
        if (shallowEqual(next, this.committedView)) return
        this.committedView = next as TView
        this.generation++
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

    // The navigation owns the resource now; an in-page run's intent is lost.
    if (this.inflight) {
      this.inflight.abort()
      this.dirty = true
    }
    this.trailing = false

    const staging: Staging<TKey, TParams, TView, TData> = {
      navigation,
      key,
      params,
      view,
      // The result is unknown while the run is in flight: the declaration
      // answers with its upper bound for `data: undefined`.
      predicate: this.predicateFor(key, params, undefined),
      dirty: false,
      settled: null,
      run: Promise.resolve()
    }
    this.staging = staging

    if (key === null || params === null) {
      staging.settled = { data: null, error: null }
      return null
    }

    if (this.active.value) this.isFetching.value = true
    staging.run = this.execute({ key, params, view, signal: navigation.controller.signal }).then(
      (settled) => {
        staging.settled = settled
      }
    )
    return this.spec.blocking === false ? null : staging.run
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

    if (staging.settled) {
      this.apply(staging.settled)
      this.isLoading.value = false
      this.isFetching.value = this.refreshChain !== null
    } else {
      // Non-blocking: the page mounts loading; the result lands if still current.
      this.data.value = undefined
      this.error.value = null
      this.isLoading.value = true
      this.isFetching.value = true
      this.rebuildPredicate()
      const generation = this.generation
      void staging.run.then(() => {
        if (!this.active.value || this.generation !== generation || !staging.settled) return
        this.apply(staging.settled)
        this.isLoading.value = false
        this.isFetching.value = this.refreshChain !== null
        if (staging.dirty) void this.refresh()
      })
    }

    if (this.dirty || (staging.settled && staging.dirty)) {
      this.dirty = false
      void this.refresh()
    }
  }

  discard(navigation: Navigation): void {
    if (!this.staging || this.staging.navigation !== navigation) return
    this.staging = null

    if (!this.active.value) return
    this.isFetching.value = this.refreshChain !== null
    if (this.dirty) {
      this.dirty = false
      void this.refresh()
    }
  }

  deactivate(): void {
    if (!this.active.value && this.staging === null) return

    this.active.value = false
    this.staging = null
    this.inflight?.abort()
    this.inflight = null
    this.trailing = false
    this.dirty = false

    this.committedKey = null
    this.committedView = undefined
    this.committedPredicate = null
    this.params.value = null
    this.generation++
    this.data.value = undefined
    this.error.value = null
    this.isLoading.value = false
    this.isFetching.value = false
  }

  // ---------------------------------------------------------------------------
  // Invalidation
  // ---------------------------------------------------------------------------

  onDbBatch(batch: DbChangeBatch): void {
    if (this.staging && this.staging.settled === null && this.staging.predicate?.(batch)) {
      this.staging.dirty = true
    }
    if (this.active.value && this.committedPredicate?.(batch)) {
      void this.refresh()
    }
  }

  onIpc(channel: IpcEventChannel): void {
    if (!this.ipcChannels.includes(channel)) return
    if (this.staging && this.staging.settled === null) this.staging.dirty = true
    if (this.active.value) void this.refresh()
  }

  // ---------------------------------------------------------------------------
  // In-page protocol
  // ---------------------------------------------------------------------------

  private setParams(next: TParams): void {
    if (!this.active.value || this.committedKey === null) return
    this.params.value = next
    this.memory = { key: this.committedKey, params: next }
    this.rebuildPredicate()
    this.generation++
    void this.refresh()
  }

  private refresh(): Promise<void> {
    if (!this.active.value) return Promise.resolve()

    if (this.refreshChain) {
      this.trailing = true
      return this.refreshChain
    }

    this.refreshChain = (async () => {
      try {
        do {
          this.trailing = false
          await this.runRefresh()
        } while (this.trailing && this.active.value)
      } finally {
        this.refreshChain = null
        if (this.active.value && this.staging === null) this.isFetching.value = false
      }
    })()

    return this.refreshChain
  }

  private async runRefresh(): Promise<void> {
    const key = this.committedKey
    const params = this.params.value
    if (key === null || params === null) return

    const generation = this.generation
    const controller = new AbortController()
    this.inflight = controller
    this.isFetching.value = true

    const settled = await this.execute({
      key,
      params,
      view: this.readView(),
      signal: controller.signal
    })

    if (this.inflight === controller) this.inflight = null
    if (controller.signal.aborted || !this.active.value || this.generation !== generation) return

    if (settled.error !== null) {
      // The displayed data stays; the failure is reported, not painted over it.
      log.error(`Route data "${this.name}" failed to refresh.`, settled.error)
      notify.error(messages.value.feedback.operationFailed, settled.error)
      return
    }
    this.data.value = settled.data
    this.rebuildPredicate()
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

  private predicateFor(
    key: TKey | null,
    params: TParams | null,
    data: TData | null | undefined
  ): DbPredicate | null {
    if (key === null || params === null) return null
    return buildDbPredicate(this.spec.invalidate, { key, params, data })
  }

  /** The committed predicate follows the committed inputs and data. */
  private rebuildPredicate(): void {
    this.committedPredicate = this.predicateFor(
      this.committedKey,
      this.params.value,
      this.data.value
    )
  }

  private apply(settled: Settled<TData>): void {
    this.data.value = settled.data
    this.error.value = settled.error
    this.rebuildPredicate()
  }

  private async execute(input: RouteDataFetchInput<TKey, TParams, TView>): Promise<Settled<TData>> {
    const startedAt = performance.now()
    try {
      const data = await this.spec.fetch(input)
      return { data, error: null }
    } catch (error) {
      if (input.signal.aborted) return { data: undefined, error: null }
      log.error(`Route data "${this.name}" failed to load.`, error)
      return { data: undefined, error: describeError(error) }
    } finally {
      const elapsed = performance.now() - startedAt
      if (import.meta.env.DEV && elapsed > LOAD_BUDGET_MS) {
        log.warn(
          `Route data "${this.name}" took ${Math.round(elapsed)} ms; the budget is ${LOAD_BUDGET_MS} ms.`
        )
      }
    }
  }

  adopt(previous: ResourceController): void {
    const source = previous as unknown as Resource<TKey, TParams, TView, TData>
    this.active.value = source.active.value
    this.data.value = source.data.value
    this.error.value = source.error.value
    this.isLoading.value = source.isLoading.value
    this.params.value = source.params.value
    this.committedKey = source.committedKey
    this.committedView = source.committedView
    this.memory = source.memory
    this.rebuildPredicate()
    source.deactivate()
  }
}

// =============================================================================
// Registry
// =============================================================================

const registry = new Map<string, ResourceController>()
let scope: EffectScope | null = null
const ipcSubscriptions = new Set<IpcEventChannel>()

function wireIpc(channel: IpcEventChannel): void {
  if (!scope || ipcSubscriptions.has(channel)) return
  ipcSubscriptions.add(channel)
  scope.run(() => {
    ipcManager.on(channel, () => {
      for (const resource of registry.values()) resource.onIpc(channel)
    })
  })
}

function wireResource(resource: ResourceController): void {
  if (!scope) return
  scope.run(() => resource.wire())
  for (const channel of resource.ipcChannels) wireIpc(channel)
}

function register(resource: ResourceController): void {
  const previous = registry.get(resource.name)
  if (previous) {
    if (!import.meta.env.DEV) {
      throw new Error(`Route data "${resource.name}" is defined twice.`)
    }
    // Hot update: the new definition takes over the committed state.
    resource.adopt(previous)
  }
  registry.set(resource.name, resource)
  wireResource(resource)
}

/**
 * Define a route data resource.
 *
 * The returned value is a composable (call it inside the page to read the
 * committed surface) and the handle a route declares in `meta.routeData`.
 */
export function defineRouteData<
  TKey extends string,
  TParams extends object = Record<never, never>,
  TView = undefined,
  TData = unknown
>(spec: RouteDataSpec<TKey, TParams, TView, TData>): RouteData<TParams, TData> {
  const resource = new Resource(spec)
  register(resource)

  const handle = (() => resource.use()) as RouteData<TParams, TData>
  Object.defineProperty(handle, 'name', { value: spec.name })
  Object.defineProperty(handle, RESOURCE, { value: resource })
  return handle
}

// =============================================================================
// Router installation
// =============================================================================

const pendingLocation = shallowRef<RouteLocationNormalizedGeneric | null>(null)

/** True while a navigation (including its blocking loads) is in flight. */
export const isNavigationPending: Readonly<Ref<boolean>> = computed(
  () => pendingLocation.value !== null
)

function declaredResources(route: RouteLocationNormalizedGeneric): ResourceController[] {
  const declared = new Set<ResourceController>()
  for (const record of route.matched) {
    for (const handle of record.meta.routeData ?? []) declared.add(handle[RESOURCE])
  }
  return [...declared]
}

/** Register the navigation guards and the invalidation subscriptions. */
export function installRouteData(router: Router): void {
  scope = effectScope(true)
  scope.run(() => {
    ipcManager.on('db:changed', (_e, changes) => {
      if (changes.length === 0) return
      const batch = aggregateDbChanges(changes)
      for (const resource of registry.values()) resource.onDbBatch(batch)
    })
  })
  for (const resource of registry.values()) wireResource(resource)

  const navigations = new WeakMap<RouteLocationNormalizedGeneric, Navigation>()
  let current: Navigation | null = null

  function settle(navigation: Navigation, failure: NavigationFailure | Error | undefined): void {
    if (failure) {
      navigation.controller.abort()
      for (const resource of registry.values()) resource.discard(navigation)
    } else {
      const declared = new Set(declaredResources(navigation.location))
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
