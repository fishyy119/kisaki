/**
 * Explorer locator.
 *
 * Owns the reconciliation between the active detail route and the explorer
 * list. The route is the single source of truth for "the current entity";
 * this module answers where that entity lives in the list (the current
 * instance), whether its row is on screen, how to reveal it, and — when the
 * URL's `from` no longer names a real instance — heals the URL itself.
 *
 * Addressing is exact, never fuzzy: the grouped view addresses rows by
 * `(from, id)` (one row per containing collection), the filtered view by
 * `id` (deduplicated flat list, one row per entity). Bad `from` values are
 * not tolerated here; they are repaired at their layer by `router.replace`,
 * so consumers only ever look up.
 */

import {
  computed,
  inject,
  onScopeDispose,
  provide,
  ref,
  shallowReactive,
  shallowRef,
  watch,
  watchEffect,
  type ComputedRef,
  type InjectionKey,
  type Ref
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useDefaultFromStore } from '@renderer/stores'
import { matchContentEntityDetailRoute } from '@renderer/utils/entity-routes'
import { formatExplorerContext } from '@renderer/utils/explorer-context'
import {
  clearEntityListQuery,
  hasActiveEntityListQuery,
  switchEntityListType,
  type EntityListQuery
} from '@renderer/composables/entity-list-query'
import { useLibraryExplorerStore } from '../stores'
import { toExplorerSelectionKey } from '../utils/explorer-selection'
import type { ExplorerListContext } from './use-explorer-list'
import type { ContentEntityType } from '@shared/common'

// =============================================================================
// Types
// =============================================================================

/** Entity of the active content detail route. */
export interface ExplorerLocatorTarget {
  entityType: ContentEntityType
  entityId: string
  from: string | null
}

/** Scroll handle one virtualized list registers with the locator. */
export interface ExplorerListViewHandle {
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' }) => void
}

/** Where the current instance lives: which list view, which row, which group. */
interface ExplorerInstanceLocation {
  key: string
  listViewId: string
  index: number
  /** Collapse id of the containing group; null for the filtered list. */
  groupId: string | null
}

/**
 * Reveal intent. `auto` follows navigation and never touches the query of the
 * active type; `user` is the footer affordance and clears search/filter when
 * they are what hides the target.
 */
export type ExplorerRevealMode = 'auto' | 'user'

export interface ExplorerLocator {
  /** Entity of the active content detail route, or null on other routes. */
  target: ComputedRef<ExplorerLocatorTarget | null>
  /** Selection key of the row standing for the current entity, when the list has one. */
  currentInstanceKey: ComputedRef<string | null>
  /** Whether the current instance row is inside the scroll viewport right now. */
  isCurrentRowVisible: Readonly<Ref<boolean>>
  /** Whether the footer should offer the locate affordance. */
  showLocateButton: ComputedRef<boolean>
  /** Reveal the current entity: retarget the surface, expand, scroll. */
  reveal: (mode: ExplorerRevealMode) => void
  /** Row-side registration: the current instance row reports its element while rendered. */
  registerCurrentRow: (el: HTMLElement) => () => void
  /** List-side registration: each virtualized list registers its scroll handle. */
  registerListView: (id: string, handle: ExplorerListViewHandle) => () => void
}

/** Registry id of the filter-mode flat list; group lists use their from token. */
export const FILTERED_LIST_VIEW_ID = '__filtered__'

/** Collapse id of the uncategorized group (matches the store's collapsedIds). */
export const UNCATEGORIZED_GROUP_ID = '__uncategorized__'

const UNCATEGORIZED_FROM = formatExplorerContext({ kind: 'uncategorized' })

const ExplorerLocatorKey: InjectionKey<ExplorerLocator> = Symbol('explorerLocator')

interface PendingReveal {
  entityType: ContentEntityType
  entityId: string
  /** Query the reveal was issued for; any external replacement cancels it. */
  forQuery: EntityListQuery
}

/** Whether at least half of the element's height is inside the root's viewport. */
function isHalfVisible(el: HTMLElement, root: HTMLElement): boolean {
  const elRect = el.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  const overlap = Math.min(elRect.bottom, rootRect.bottom) - Math.max(elRect.top, rootRect.top)
  return overlap >= elRect.height / 2
}

// =============================================================================
// Provider
// =============================================================================

export function useExplorerLocatorProvider(options: {
  list: ExplorerListContext
  scrollContainer: Ref<HTMLElement | undefined>
}): ExplorerLocator {
  const { list, scrollContainer } = options

  const route = useRoute()
  const router = useRouter()
  const store = useLibraryExplorerStore()
  const { query, activeEntityType, collapsedIds } = storeToRefs(store)
  const defaultFromStore = useDefaultFromStore()

  // ===========================================================================
  // Target and instance resolution
  // ===========================================================================

  const target = computed<ExplorerLocatorTarget | null>(() => {
    const match = matchContentEntityDetailRoute(route)
    if (!match) return null
    const from = typeof route.query.from === 'string' ? route.query.from : null
    return { ...match, from }
  })

  const isFiltering = computed(() => hasActiveEntityListQuery(query.value))

  const currentInstance = computed<ExplorerInstanceLocation | null>(() => {
    const t = target.value
    if (!t || t.entityType !== activeEntityType.value) return null

    // Filtered view: one row per entity, addressed by id. The row's from is
    // its own default-from, exactly as the list renders it.
    if (isFiltering.value) {
      const index = list.allEntities.value.findIndex((entity) => entity.id === t.entityId)
      if (index === -1) return null
      const from = defaultFromStore.getFrom(t.entityType, t.entityId)
      return {
        key: toExplorerSelectionKey(from, t.entityId),
        listViewId: FILTERED_LIST_VIEW_ID,
        index,
        groupId: null
      }
    }

    // Grouped view: one row per containing collection, addressed by (from, id).
    if (!t.from) return null

    if (t.from === UNCATEGORIZED_FROM) {
      const index = list.data.value.uncategorized.findIndex((entity) => entity.id === t.entityId)
      if (index === -1) return null
      return {
        key: toExplorerSelectionKey(t.from, t.entityId),
        listViewId: t.from,
        index,
        groupId: UNCATEGORIZED_GROUP_ID
      }
    }

    for (const group of list.data.value.collections) {
      const groupFrom = formatExplorerContext({ kind: 'collection', collectionId: group.id })
      if (groupFrom !== t.from) continue
      const index = group.entities.findIndex((entity) => entity.id === t.entityId)
      if (index === -1) return null
      return {
        key: toExplorerSelectionKey(t.from, t.entityId),
        listViewId: t.from,
        index,
        groupId: group.id
      }
    }

    return null
  })

  const currentInstanceKey = computed(() => currentInstance.value?.key ?? null)

  const targetExistsInData = computed(() => {
    const t = target.value
    if (!t || t.entityType !== activeEntityType.value) return false
    return list.allEntities.value.some((entity) => entity.id === t.entityId)
  })

  // ===========================================================================
  // URL healing
  //
  // The navigation-time half of "from is always a valid instance address"
  // lives in the autofill guard; this is the residence-time half. The grouped
  // view without an active query is the complete membership picture, so a
  // routed entity that is in the data but has no (from, id) row proves the
  // URL's from went stale (entity moved out, collection deleted, hand-edited
  // URL, or a pre-warmup autofill). Repair the URL; never work around it.
  // ===========================================================================

  /**
   * A repair is owed to the URL. Computed rather than event-driven so the
   * reveal pipeline can also see it and hold its pending scroll until the
   * repaired `from` produces the instance.
   */
  const pendingHeal = computed(() => {
    const t = target.value
    if (!t || t.entityType !== activeEntityType.value) return false
    if (isFiltering.value) return false
    if (currentInstance.value !== null || !targetExistsInData.value) return false
    // Already canonical yet unresolved: the two data sources are mid-sync
    // (both react to the same DB events); replacing would only loop.
    return defaultFromStore.getFrom(t.entityType, t.entityId) !== t.from
  })

  watch([pendingHeal, () => list.isFetching.value, () => list.isLoading.value], () => {
    if (!pendingHeal.value) return
    if (list.isFetching.value || list.isLoading.value) return

    const t = target.value
    if (!t) return
    const canonical = defaultFromStore.getFrom(t.entityType, t.entityId)
    void router.replace({ query: { ...route.query, from: canonical } })
  })

  // ===========================================================================
  // List view registry
  //
  // Reactive: a pending reveal is fulfilled only once the owning list view
  // exists, so registration itself re-triggers the fulfillment effect. This
  // is what carries a reveal across render gaps — the delayed loading state
  // keeps groups unrendered for a while after the data has already settled.
  // ===========================================================================

  const listViews = shallowReactive(new Map<string, ExplorerListViewHandle>())

  function registerListView(id: string, handle: ExplorerListViewHandle): () => void {
    listViews.set(id, handle)
    return () => {
      if (listViews.get(id) === handle) listViews.delete(id)
    }
  }

  // ===========================================================================
  // Current row visibility
  // ===========================================================================

  const isCurrentRowVisible = ref(false)

  let observer: IntersectionObserver | null = null
  let observerRoot: HTMLElement | null = null
  let observedElement: HTMLElement | null = null

  function ensureObserver(): IntersectionObserver | null {
    const root = scrollContainer.value ?? null
    if (!root) return null
    if (observer && observerRoot === root) return observer

    observer?.disconnect()
    observerRoot = root
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target !== observedElement) continue
          // Ratio, not isIntersecting: callbacks only fire at the 0.5
          // crossing, where the row still intersects in both directions.
          isCurrentRowVisible.value = entry.intersectionRatio >= 0.5
        }
      },
      { root, threshold: 0.5 }
    )
    if (observedElement) observer.observe(observedElement)
    return observer
  }

  function registerCurrentRow(el: HTMLElement): () => void {
    if (observer && observedElement) observer.unobserve(observedElement)
    observedElement = el

    // Seed synchronously so the footer button never flashes during the gap
    // before the observer's first report.
    const root = scrollContainer.value
    isCurrentRowVisible.value = root ? isHalfVisible(el, root) : false
    ensureObserver()?.observe(el)

    return () => {
      if (observedElement !== el) return
      observer?.unobserve(el)
      observedElement = null
      isCurrentRowVisible.value = false
    }
  }

  onScopeDispose(() => {
    observer?.disconnect()
    observer = null
    observedElement = null
    listViews.clear()
  })

  // ===========================================================================
  // Reveal pipeline
  // ===========================================================================

  const pendingReveal = shallowRef<PendingReveal | null>(null)

  function reveal(mode: ExplorerRevealMode): void {
    const t = target.value
    if (!t) return

    // Stage 1: retarget the surface. The type always follows the entity; the
    // query of the active type is user input and only the explicit locate
    // affordance may lift it.
    if (t.entityType !== activeEntityType.value) {
      store.setQuery(switchEntityListType(query.value, t.entityType))
    } else if (mode === 'user' && !currentInstance.value && hasActiveEntityListQuery(query.value)) {
      store.setQuery(clearEntityListQuery(query.value))
    }

    // Stage 2 is deferred: the fulfillment effect below scrolls once the data
    // holds the instance and its owning list view is mounted.
    pendingReveal.value = {
      entityType: t.entityType,
      entityId: t.entityId,
      forQuery: query.value
    }
  }

  function scrollToInstance(instance: ExplorerInstanceLocation): void {
    // Already on screen: revealing must not move what the user is looking at
    // (clicking a row in the explorer itself is the hot path). Off-screen
    // targets land centered, arriving with their surroundings in view.
    if (isCurrentRowVisible.value) return

    listViews.get(instance.listViewId)?.scrollToIndex(instance.index, { align: 'center' })
  }

  watch(
    () => (target.value ? `${target.value.entityType}\u0000${target.value.entityId}` : null),
    (identity) => {
      if (!identity) {
        pendingReveal.value = null
        return
      }
      reveal('auto')
    },
    { immediate: true }
  )

  // Fulfillment: an effect rather than a sourced watch, because every wait
  // state below must re-trigger it — data landing (currentInstance), the view
  // materializing (listViews), an expansion (collapsedIds), a settle
  // (isFetching), or an owed heal (pendingHeal).
  watchEffect(
    () => {
      const pending = pendingReveal.value
      if (!pending) return

      // Superseded by navigation or by an external query change.
      const t = target.value
      if (
        !t ||
        t.entityType !== pending.entityType ||
        t.entityId !== pending.entityId ||
        query.value !== pending.forQuery
      ) {
        pendingReveal.value = null
        return
      }

      const instance = currentInstance.value
      if (!instance) {
        // The query settled without producing the instance (filtered out,
        // NSFW-hidden, or gone): give up; the footer affordance takes over.
        // An owed URL repair is not a settle — the healed `from` is about to
        // produce the instance this reveal is waiting for.
        if (!list.isFetching.value && !list.isLoading.value && !pendingHeal.value) {
          pendingReveal.value = null
        }
        return
      }

      // A collapsed group holds the instance: expand and wait — the mounted
      // list re-triggers through the registry.
      if (instance.groupId && collapsedIds.value.includes(instance.groupId)) {
        store.toggleCollapsed(instance.groupId)
        return
      }

      // The owning list view may not exist yet (delayed loading state keeps
      // groups unrendered past the data settle): wait for registration.
      if (!listViews.has(instance.listViewId)) return

      pendingReveal.value = null
      scrollToInstance(instance)
    },
    { flush: 'post' }
  )

  // ===========================================================================
  // Footer affordance
  // ===========================================================================

  const canReveal = computed(() => {
    const t = target.value
    if (!t) return false
    // A type switch, an expand/scroll, or a query lift can each reveal.
    if (t.entityType !== activeEntityType.value) return true
    if (currentInstance.value) return true
    return hasActiveEntityListQuery(query.value)
  })

  const showLocateButton = computed(() => {
    if (!target.value) return false
    if (list.isLoading.value) return false
    if (pendingReveal.value) return false
    if (isCurrentRowVisible.value) return false
    return canReveal.value
  })

  const locator: ExplorerLocator = {
    target,
    currentInstanceKey,
    isCurrentRowVisible,
    showLocateButton,
    reveal,
    registerCurrentRow,
    registerListView
  }

  provide(ExplorerLocatorKey, locator)
  return locator
}

// =============================================================================
// Consumer
// =============================================================================

export function useExplorerLocator(): ExplorerLocator {
  const locator = inject(ExplorerLocatorKey)
  if (!locator) {
    throw new Error('useExplorerLocator() must be used inside a LibraryExplorer subtree')
  }
  return locator
}
