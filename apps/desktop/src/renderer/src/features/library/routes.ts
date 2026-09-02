/**
 * Library route manifest.
 *
 * Owns every library surface: the layout, the showcase home, one generated
 * detail route per entity type, and the organizer list pages. Pages are
 * lazy-loaded from their .vue files; loaders are declared on
 * `meta.dataLoaders` and awaited by the route-data kernel during navigation.
 * Detail paths, param names, pages, and loaders all derive from one registry,
 * so adding a media type is one entry here plus its page component.
 */

import type {
  NavigationGuardReturn,
  RouteLocationNormalizedGeneric,
  RouteRecordRaw
} from 'vue-router'
import { ALL_ENTITY_TYPES, type AllEntityType } from '@shared/entity-types'
import type { RouteDataHandle } from '@renderer/core/route-data'
import {
  entityDetailRouteName,
  getEntityDetailRoutePattern,
  matchContentEntityDetailRoute,
  LIBRARY_HOME_PATH
} from '@renderer/utils/entity-routes'
import { useDefaultFromStore } from '@renderer/stores'
import { gameDetailData } from '@renderer/composables/use-game'
import { animeDetailData } from '@renderer/composables/use-anime'
import { comicDetailData } from '@renderer/composables/use-comic'
import { novelDetailData } from '@renderer/composables/use-novel'
import { characterDetailData } from '@renderer/composables/use-character'
import { personDetailData } from '@renderer/composables/use-person'
import { companyDetailData } from '@renderer/composables/use-company'
import { collectionDetailData } from '@renderer/composables/use-collection'
import { tagDetailData } from '@renderer/composables/use-tag'
import { showcaseSectionsData } from './composables/use-showcase-sections'
import { favoritesData } from './composables/use-favorites'
import { uncategorizedListData } from './composables/use-uncategorized-list'
import { collectionsListData } from './composables/use-collections-list'

// =============================================================================
// Entity detail routes
// =============================================================================

const ENTITY_DETAIL_ROUTES = {
  game: { page: () => import('./pages/game-detail-page.vue'), loader: gameDetailData },
  anime: { page: () => import('./pages/anime-detail-page.vue'), loader: animeDetailData },
  comic: { page: () => import('./pages/comic-detail-page.vue'), loader: comicDetailData },
  novel: { page: () => import('./pages/novel-detail-page.vue'), loader: novelDetailData },
  character: {
    page: () => import('./pages/character-detail-page.vue'),
    loader: characterDetailData
  },
  person: { page: () => import('./pages/person-detail-page.vue'), loader: personDetailData },
  company: { page: () => import('./pages/company-detail-page.vue'), loader: companyDetailData },
  collection: {
    page: () => import('./pages/collection-detail-page.vue'),
    loader: collectionDetailData
  },
  tag: { page: () => import('./pages/tag-detail-page.vue'), loader: tagDetailData }
} satisfies Record<AllEntityType, { page: () => Promise<unknown>; loader: RouteDataHandle }>

const entityDetailRoutes: RouteRecordRaw[] = ALL_ENTITY_TYPES.map((entityType) => ({
  path: getEntityDetailRoutePattern(entityType),
  name: entityDetailRouteName(entityType),
  component: ENTITY_DETAIL_ROUTES[entityType].page,
  props: true,
  meta: { dataLoaders: [ENTITY_DETAIL_ROUTES[entityType].loader] }
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
        meta: { dataLoaders: [showcaseSectionsData] }
      },
      ...entityDetailRoutes,
      {
        path: 'collections',
        name: 'collections',
        component: () => import('./pages/collections-page.vue'),
        meta: { dataLoaders: [collectionsListData] }
      },
      {
        path: 'uncategorized/:entityType',
        name: 'uncategorized',
        component: () => import('./pages/uncategorized-page.vue'),
        props: true,
        meta: { dataLoaders: [uncategorizedListData] }
      },
      {
        path: 'favorites',
        name: 'favorites',
        component: () => import('./pages/favorites-page.vue'),
        meta: { dataLoaders: [favoritesData] }
      }
    ]
  }
]
