/**
 * Library route manifest.
 *
 * Owns every library surface: the layout, the showcase home, one generated
 * detail route per entity type, and the organizer list pages. Pages are
 * lazy-loaded from their .vue files; route queries are declared on
 * `meta.routeQueries` and loaded by the query kernel during navigation.
 * Detail paths, param names, pages, and queries all derive from one
 * registry, so adding a media type is one entry here plus its page component.
 */

import type {
  NavigationGuardReturn,
  RouteLocationNormalizedGeneric,
  RouteRecordRaw
} from 'vue-router'
import { ALL_ENTITY_TYPES, type AllEntityType } from '@shared/entity-types'
import type { RouteQueryHandle } from '@renderer/core/query'
import {
  entityDetailRouteName,
  getEntityDetailRoutePattern,
  matchContentEntityDetailRoute,
  LIBRARY_HOME_PATH
} from '@renderer/utils/entity-routes'
import { useDefaultFromStore } from '@renderer/stores'
import { gameDetailQuery } from '@renderer/composables/use-game'
import { animeDetailQuery } from '@renderer/composables/use-anime'
import { comicDetailQuery } from '@renderer/composables/use-comic'
import { novelDetailQuery } from '@renderer/composables/use-novel'
import { characterDetailQuery } from '@renderer/composables/use-character'
import { personDetailQuery } from '@renderer/composables/use-person'
import { companyDetailQuery } from '@renderer/composables/use-company'
import { collectionDetailQuery } from '@renderer/composables/use-collection'
import { tagDetailQuery } from '@renderer/composables/use-tag'
import { showcaseQuery } from './composables/use-showcase-sections'
import { favoritesQuery } from './composables/use-favorites'
import { uncategorizedQuery } from './composables/use-uncategorized-list'
import { collectionsQuery } from './composables/use-collections-list'

// =============================================================================
// Entity detail routes
// =============================================================================

const ENTITY_DETAIL_ROUTES = {
  game: { page: () => import('./pages/game-detail-page.vue'), query: gameDetailQuery },
  anime: { page: () => import('./pages/anime-detail-page.vue'), query: animeDetailQuery },
  comic: { page: () => import('./pages/comic-detail-page.vue'), query: comicDetailQuery },
  novel: { page: () => import('./pages/novel-detail-page.vue'), query: novelDetailQuery },
  character: {
    page: () => import('./pages/character-detail-page.vue'),
    query: characterDetailQuery
  },
  person: { page: () => import('./pages/person-detail-page.vue'), query: personDetailQuery },
  company: { page: () => import('./pages/company-detail-page.vue'), query: companyDetailQuery },
  collection: {
    page: () => import('./pages/collection-detail-page.vue'),
    query: collectionDetailQuery
  },
  tag: { page: () => import('./pages/tag-detail-page.vue'), query: tagDetailQuery }
} satisfies Record<AllEntityType, { page: () => Promise<unknown>; query: RouteQueryHandle }>

const entityDetailRoutes: RouteRecordRaw[] = ALL_ENTITY_TYPES.map((entityType) => ({
  path: getEntityDetailRoutePattern(entityType),
  name: entityDetailRouteName(entityType),
  component: ENTITY_DETAIL_ROUTES[entityType].page,
  props: true,
  meta: { routeQueries: [ENTITY_DETAIL_ROUTES[entityType].query] }
}))

// =============================================================================
// Browse-context autofill guard
// =============================================================================

/**
 * Auto-fill the `from` browse-context query on content entity detail routes.
 *
 * Only content entities carry a browse context: organizer detail routes
 * (collection, tag) are containers themselves, not content to be organized.
 * The app entry registers this as a global guard because it must also run on
 * param-only navigations between two entries of the same detail route, which
 * per-route `beforeEnter` does not cover.
 */
export function libraryFromAutofillGuard(
  to: RouteLocationNormalizedGeneric
): NavigationGuardReturn {
  const match = matchContentEntityDetailRoute(to)
  if (!match || to.query.from) return true

  const defaultFrom = useDefaultFromStore().getFrom(match.entityType, match.entityId)
  return { ...to, query: { ...to.query, from: defaultFrom } }
}

// =============================================================================
// Routes
// =============================================================================

export const libraryRoutes: RouteRecordRaw[] = [
  {
    path: LIBRARY_HOME_PATH,
    name: 'library',
    component: () => import('./pages/library-layout.vue'),
    children: [
      {
        path: '',
        name: 'showcase',
        component: () => import('./pages/showcase-page.vue'),
        meta: { routeQueries: [showcaseQuery] }
      },
      ...entityDetailRoutes,
      {
        path: 'collections',
        name: 'collections',
        component: () => import('./pages/collections-page.vue'),
        meta: { routeQueries: [collectionsQuery] }
      },
      {
        path: 'uncategorized/:entityType',
        name: 'uncategorized',
        component: () => import('./pages/uncategorized-page.vue'),
        props: true,
        meta: { routeQueries: [uncategorizedQuery] }
      },
      {
        path: 'favorites',
        name: 'favorites',
        component: () => import('./pages/favorites-page.vue'),
        meta: { routeQueries: [favoritesQuery] }
      }
    ]
  }
]
