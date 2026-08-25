/**
 * Vue Router Configuration
 *
 * Hash history for Electron compatibility
 */

import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useDefaultFromStore } from '@renderer/stores'
import { isContentEntityType } from '@shared/common'
import { installRouteData } from '@renderer/core/route-data'
import {
  gameDetailData,
  animeDetailData,
  comicDetailData,
  novelDetailData,
  characterDetailData,
  personDetailData,
  companyDetailData,
  collectionDetailData,
  tagDetailData
} from '@renderer/composables'

// Route data loaders come from the feature boundaries, while page components
// are lazy-loaded from their concrete .vue files. Routing must never import
// page components statically: pages sit downstream of the shared
// composable/store graph, so a static edge back from the router would place
// every page inside a circular import and degrade HMR to full reloads.
import {
  showcaseSectionsData,
  favoritesData,
  uncategorizedListData,
  collectionsListData
} from '@renderer/features/library'
import { scannersData } from '@renderer/features/scanner'
import { automationsData } from '@renderer/features/automation'
import {
  discoverSearchData,
  installedExtensionsData,
  extensionRepositoriesData,
  extensionSignersData
} from '@renderer/features/extension'
import { statisticsData } from '@renderer/features/statistics'

// Route definitions
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/library'
  },
  // Library routes
  {
    path: '/library',
    name: 'library',
    component: () => import('@renderer/features/library/pages/library-layout.vue'),
    children: [
      {
        path: '',
        name: 'showcase',
        component: () => import('@renderer/features/library/pages/showcase-page.vue'),
        meta: { dataLoaders: [showcaseSectionsData] }
      },
      {
        path: 'game/:gameId',
        name: 'game-detail',
        component: () => import('@renderer/features/library/pages/game-detail-page.vue'),
        props: true,
        meta: { entityType: 'game', dataLoaders: [gameDetailData] }
      },
      {
        path: 'anime/:animeId',
        name: 'anime-detail',
        component: () => import('@renderer/features/library/pages/anime-detail-page.vue'),
        props: true,
        meta: { entityType: 'anime', dataLoaders: [animeDetailData] }
      },
      {
        path: 'comic/:comicId',
        name: 'comic-detail',
        component: () => import('@renderer/features/library/pages/comic-detail-page.vue'),
        props: true,
        meta: { entityType: 'comic', dataLoaders: [comicDetailData] }
      },
      {
        path: 'novel/:novelId',
        name: 'novel-detail',
        component: () => import('@renderer/features/library/pages/novel-detail-page.vue'),
        props: true,
        meta: { entityType: 'novel', dataLoaders: [novelDetailData] }
      },
      {
        path: 'person/:personId',
        name: 'person-detail',
        component: () => import('@renderer/features/library/pages/person-detail-page.vue'),
        props: true,
        meta: { entityType: 'person', dataLoaders: [personDetailData] }
      },
      {
        path: 'character/:characterId',
        name: 'character-detail',
        component: () => import('@renderer/features/library/pages/character-detail-page.vue'),
        props: true,
        meta: { entityType: 'character', dataLoaders: [characterDetailData] }
      },
      {
        path: 'company/:companyId',
        name: 'company-detail',
        component: () => import('@renderer/features/library/pages/company-detail-page.vue'),
        props: true,
        meta: { entityType: 'company', dataLoaders: [companyDetailData] }
      },
      {
        path: 'collection/:collectionId',
        name: 'collection-detail',
        component: () => import('@renderer/features/library/pages/collection-detail-page.vue'),
        props: true,
        meta: { entityType: 'collection', dataLoaders: [collectionDetailData] }
      },
      {
        path: 'tag/:tagId',
        name: 'tag-detail',
        component: () => import('@renderer/features/library/pages/tag-detail-page.vue'),
        props: true,
        meta: { entityType: 'tag', dataLoaders: [tagDetailData] }
      },
      {
        path: 'collections',
        name: 'collections',
        component: () => import('@renderer/features/library/pages/collections-page.vue'),
        meta: { dataLoaders: [collectionsListData] }
      },
      {
        path: 'uncategorized/:entityType',
        name: 'uncategorized',
        component: () => import('@renderer/features/library/pages/uncategorized-page.vue'),
        props: true,
        meta: { dataLoaders: [uncategorizedListData] }
      },
      {
        path: 'favorites',
        name: 'favorites',
        component: () => import('@renderer/features/library/pages/favorites-page.vue'),
        meta: { dataLoaders: [favoritesData] }
      }
    ]
  },
  // Statistics routes
  {
    path: '/statistics',
    component: () => import('@renderer/features/statistics/pages/statistics-layout.vue'),
    redirect: '/statistics/overview',
    children: [
      {
        path: 'overview',
        name: 'statistics-overview',
        component: () => import('@renderer/features/statistics/pages/statistics-overview-page.vue'),
        meta: { dataLoaders: [statisticsData] }
      },
      {
        path: 'weekly',
        name: 'statistics-weekly',
        component: () => import('@renderer/features/statistics/pages/statistics-weekly-page.vue'),
        meta: { dataLoaders: [statisticsData] }
      },
      {
        path: 'monthly',
        name: 'statistics-monthly',
        component: () => import('@renderer/features/statistics/pages/statistics-monthly-page.vue'),
        meta: { dataLoaders: [statisticsData] }
      },
      {
        path: 'yearly',
        name: 'statistics-yearly',
        component: () => import('@renderer/features/statistics/pages/statistics-yearly-page.vue'),
        meta: { dataLoaders: [statisticsData] }
      }
    ]
  },
  // Scanner
  {
    path: '/scanner',
    name: 'scanner',
    component: () => import('@renderer/features/scanner/pages/scanner-page.vue'),
    meta: { dataLoaders: [scannersData] }
  },
  // automations
  {
    path: '/automation',
    name: 'automation',
    component: () => import('@renderer/features/automation/pages/automation-page.vue'),
    meta: { dataLoaders: [automationsData] }
  },
  // Extension
  {
    path: '/extension',
    component: () => import('@renderer/features/extension/pages/extension-layout.vue'),
    redirect: '/extension/discover',
    children: [
      {
        path: 'discover',
        name: 'extension-discover',
        component: () => import('@renderer/features/extension/pages/extension-discover-page.vue'),
        meta: { dataLoaders: [discoverSearchData, installedExtensionsData] }
      },
      {
        path: 'installed',
        name: 'extension-installed',
        component: () => import('@renderer/features/extension/pages/extension-installed-page.vue'),
        meta: { dataLoaders: [installedExtensionsData] }
      },
      {
        path: 'repositories',
        name: 'extension-repositories',
        component: () =>
          import('@renderer/features/extension/pages/extension-repositories-page.vue'),
        meta: { dataLoaders: [extensionRepositoriesData] }
      },
      {
        path: 'signers',
        name: 'extension-signers',
        component: () => import('@renderer/features/extension/pages/extension-signers-page.vue'),
        meta: { dataLoaders: [extensionSignersData] }
      }
    ]
  },
  // Extension declared page surface
  {
    path: '/extension-page/:extensionId/:pageId',
    name: 'extension-page',
    component: () => import('@renderer/pages/extension-page.vue'),
    props: true
  },
  // Catch-all 404
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@renderer/pages/not-found-page.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  }
})

installRouteData(router)

// Navigation guards
router.beforeEach((to, _from) => {
  // Auto-fill `from` query for content entity detail routes
  // Only ContentEntityType (game, anime, character, person, company) needs the from parameter
  // OrganizerType (collection, tag) are containers themselves, not content to be organized
  const entityType = to.meta.entityType as string | undefined
  if (entityType && isContentEntityType(entityType) && !to.query.from) {
    const defaultFromStore = useDefaultFromStore()
    const paramKey = `${entityType}Id` as const
    const entityId = to.params[paramKey] as string | undefined

    if (entityId) {
      const defaultFrom = defaultFromStore.getFrom(entityType, entityId)
      return {
        ...to,
        query: { ...to.query, from: defaultFrom }
      }
    }
  }
  return true
})

router.afterEach((_to, _from) => {
  // Placeholder for analytics or tracking
})
