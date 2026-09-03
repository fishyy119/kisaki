/**
 * Live query: an instance-scoped async read that follows its sources.
 *
 * Runs the fetcher on mount, whenever a watched dependency changes, and
 * whenever a declared source changes: a `db:changed` batch touching one of
 * the declared tables, or one of the declared main-process events. Data is
 * held shallowly and replaced wholesale, so consumers derive with computed().
 *
 * Runs coalesce through one serial runner: a burst of invalidations costs at
 * most one extra round trip, and an input change supersedes the in-flight
 * run so a result computed from stale inputs never lands.
 */

import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref
} from 'vue'
import { batchTouchesAny } from '@shared/db/changes'
import {
  createSerialRunner,
  resolveTables,
  subscribeDbChanges,
  subscribeIpc,
  type QueryInvalidation
} from '@renderer/core/query'
import { createLogger } from '@renderer/core/log'

const log = createLogger('LiveQuery')

export interface LiveQueryContext<T> {
  /** The loaded data when known; a declaration that needs it returns its upper bound otherwise. */
  data: T | undefined
}

export interface UseLiveQueryOptions<T> {
  /** Dependencies whose change supersedes the in-flight run and reruns. */
  watch?: MaybeRefOrGetter<unknown>[]
  /** Whether to fetch immediately (default: true). */
  immediate?: boolean
  /** Whether fetching is enabled (default: true). */
  enabled?: MaybeRefOrGetter<boolean>
  /** Sources whose change reruns the query without superseding. */
  invalidate?: QueryInvalidation<LiveQueryContext<T>>
}

export interface UseLiveQueryReturn<T> {
  /** The fetched data (undefined before the first successful fetch). */
  data: Ref<T | undefined>
  /** True during the initial load (no data yet). */
  isLoading: Ref<boolean>
  /** True during any fetch. */
  isFetching: Ref<boolean>
  /** Error message if the last fetch failed. */
  error: Ref<string | null>
  /** Run the fetcher again; the current data stays until the result lands. */
  reload: () => Promise<void>
}

export function useLiveQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseLiveQueryOptions<T> = {}
): UseLiveQueryReturn<T> {
  const { watch: watchSources, immediate = true, enabled = true, invalidate } = options

  const data = shallowRef<T | undefined>(undefined)
  const isLoading = ref(false)
  const isFetching = ref(false)
  const error = ref<string | null>(null)

  let hasSucceeded = false
  let disposed = false

  const runner = createSerialRunner({
    run: async (signal) => {
      if (!hasSucceeded) isLoading.value = true
      isFetching.value = true
      error.value = null

      try {
        const result = await fetcher(signal)
        if (signal.aborted) return
        data.value = result
        hasSucceeded = true
      } catch (e) {
        if (signal.aborted) return
        error.value = e instanceof Error ? e.message : String(e)
        log.error('Fetch failed.', e)
      }
    },
    onIdle: () => {
      isLoading.value = false
      isFetching.value = false
    }
  })

  function request(supersede: boolean): Promise<void> {
    if (!toValue(enabled) || disposed) return Promise.resolve()
    return runner.request({ supersede })
  }

  watch(
    () => toValue(enabled),
    (next, previous) => {
      if (next && !previous) void request(true)
    }
  )

  if (watchSources && watchSources.length > 0) {
    watch(
      watchSources.map((source) => () => toValue(source)),
      () => void request(true),
      { immediate }
    )
  } else if (immediate) {
    void request(true)
  }

  if (invalidate?.tables) {
    const tables = computed(() => resolveTables(invalidate, { data: data.value }))
    onScopeDispose(
      subscribeDbChanges((batch) => {
        if (batchTouchesAny(batch, tables.value)) void request(false)
      })
    )
  }
  for (const channel of invalidate?.ipc ?? []) {
    onScopeDispose(subscribeIpc(channel, () => void request(false)))
  }

  onScopeDispose(() => {
    disposed = true
    runner.abort()
  })

  return {
    data,
    isLoading,
    isFetching,
    error,
    reload: () => request(false)
  }
}
