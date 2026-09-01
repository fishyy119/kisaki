/**
 * Async data fetching composable
 *
 * Provides loading states, error handling, and automatic refetching
 * when dependencies change.
 *
 * Data is held shallowly: results are replaced wholesale, never mutated in
 * place, so consumers derive with computed() instead of deep reactivity.
 *
 * Runs coalesce: while a fetch is in flight, further requests queue exactly
 * one trailing rerun instead of issuing overlapping fetches, so bursts of
 * invalidations cost at most one extra round trip. Input changes (watched
 * dependencies, enable transitions) additionally supersede the in-flight run
 * so a result computed from stale inputs never lands.
 */

import { ref, shallowRef, watch, onUnmounted, toValue, type Ref, type MaybeRefOrGetter } from 'vue'
import { createLogger } from '@renderer/core/log'

const log = createLogger('AsyncData')

/**
 * Options for useAsyncData
 */
export interface UseAsyncDataOptions {
  /** Dependencies to watch for refetch */
  watch?: MaybeRefOrGetter<unknown>[]
  /** Whether to fetch immediately (default: true) */
  immediate?: boolean
  /** Whether fetching is enabled (default: true) */
  enabled?: MaybeRefOrGetter<boolean>
}

/**
 * Return type for useAsyncData
 */
export interface UseAsyncDataReturn<T> {
  /** The fetched data (undefined before first successful fetch) */
  data: Ref<T | undefined>
  /** True during initial load (no data yet) */
  isLoading: Ref<boolean>
  /** True during any fetch (including refetch) */
  isFetching: Ref<boolean>
  /** Error message if fetch failed */
  error: Ref<string | null>
  /** Fetch counter for keying components */
  fetchId: Ref<number>
  /** Manually trigger refetch */
  refetch: () => Promise<void>
}

/**
 * Async data fetching composable
 *
 * Use computed() to extract fields and provide default values.
 *
 * @example
 * ```ts
 * const { data, isLoading } = useAsyncData(
 *   () => fetchGameData(toValue(gameId)),
 *   { watch: [gameId] }
 * )
 *
 * // Use computed for derived values with defaults
 * const game = computed(() => data.value?.game ?? null)
 * const tags = computed(() => data.value?.tags ?? [])
 * ```
 */
export function useAsyncData<T>(
  fetcher: (signal?: AbortSignal) => Promise<T>,
  options: UseAsyncDataOptions = {}
): UseAsyncDataReturn<T> {
  const { watch: watchSources, immediate = true, enabled = true } = options

  // State
  const data = shallowRef<T | undefined>(undefined)
  const isLoading = ref(false)
  const isFetching = ref(false)
  const error = ref<string | null>(null)
  const fetchId = ref(0)

  // Track successful fetches for isLoading calculation
  let hasSucceeded = false

  // Run coordination: one in-flight run, at most one queued trailing rerun.
  let activeController: AbortController | null = null
  let chain: Promise<void> | null = null
  let rerunQueued = false
  let disposed = false

  async function runFetch(): Promise<void> {
    const controller = new AbortController()
    activeController = controller

    if (!hasSucceeded) {
      isLoading.value = true
    }
    isFetching.value = true
    error.value = null

    try {
      const result = await fetcher(controller.signal)

      // A superseding request aborted this run; its result must not land
      if (controller.signal.aborted) return

      data.value = result
      hasSucceeded = true
      fetchId.value++
    } catch (e) {
      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') return
      if (controller.signal.aborted) return

      const err = e instanceof Error ? e : new Error(String(e))
      error.value = err.message
      log.error('Fetch failed.', e)
    } finally {
      if (activeController === controller) {
        activeController = null
      }
      // A superseding or queued run owns the loading flags now
      if (!controller.signal.aborted && !rerunQueued) {
        isLoading.value = false
        isFetching.value = false
      }
    }
  }

  /**
   * Requests a run. While one is in flight the request folds into a single
   * trailing rerun; `supersede` additionally aborts the in-flight run so a
   * result computed from outdated inputs never lands.
   */
  function execute(request: { supersede: boolean } = { supersede: false }): Promise<void> {
    if (!toValue(enabled) || disposed) return Promise.resolve()

    if (chain) {
      if (request.supersede) activeController?.abort()
      rerunQueued = true
      return chain
    }

    chain = (async () => {
      try {
        do {
          rerunQueued = false
          await runFetch()
        } while (rerunQueued && !disposed && toValue(enabled))
      } finally {
        chain = null
      }
    })()

    return chain
  }

  // Watch enabled state - fetch when it becomes true
  watch(
    () => toValue(enabled),
    (newEnabled, oldEnabled) => {
      if (newEnabled && !oldEnabled) {
        void execute({ supersede: true })
      }
    }
  )

  // Watch dependencies; a dependency change invalidates the in-flight run
  if (watchSources && watchSources.length > 0) {
    watch(
      watchSources.map((s) => () => toValue(s)),
      () => void execute({ supersede: true }),
      { immediate }
    )
  } else if (immediate) {
    void execute({ supersede: true })
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disposed = true
    rerunQueued = false
    activeController?.abort()
  })

  return {
    data,
    isLoading,
    isFetching,
    error,
    fetchId,
    refetch: () => execute()
  }
}
