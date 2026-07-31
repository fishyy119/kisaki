/**
 * Vue Router Configuration
 *
 * Hash history for Electron compatibility
 */

import { h } from 'vue'
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useDefaultFromStore } from '@renderer/stores'
import { isContentEntityType } from '@shared/common'
import { installRouteData } from '@renderer/core/route-data'
import {
  gameDetailData,
  characterDetailData,
  personDetailData,
  companyDetailData,
  collectionDetailData,
  tagDetailData
} from '@renderer/composables'

// Library pages
import {
  LibraryLayout,
  ShowcasePage,
  GameDetailPage,
  PersonDetailPage,
  CharacterDetailPage,
  CompanyDetailPage,
  CollectionDetailPage,
  TagDetailPage,
  CollectionsPage,
  UncategorizedPage,
  FavoritesPage,
  showcaseSectionsData,
  favoritesData,
  uncategorizedData,
  collectionsListData
} from '@renderer/features/library'

// Scanner page
import { ScannerPage, scannersData } from '@renderer/features/scanner'

// Automation page
import { AutomationPage, automationsData } from '@renderer/features/automation'

// Extension page
import {
  ExtensionDiscoverPage,
  ExtensionInstalledPage,
  ExtensionLayout,
  ExtensionRepositoriesPage,
  ExtensionSignersPage,
  discoverSearchData,
  installedExtensionsData,
  extensionRepositoriesData,
  extensionSignersData
} from '@renderer/features/extension'

// Statistics pages
import {
  StatisticsLayout,
  StatisticsOverviewPage,
  StatisticsWeeklyPage,
  StatisticsMonthlyPage,
  StatisticsYearlyPage,
  statisticsData
} from '@renderer/features/statistics'

// Extension declared page surface
import ExtensionPage from '@renderer/pages/extension-page.vue'

// Placeholder component for routes during development
const PlaceholderPage = {
  name: 'PlaceholderPage',
  render() {
    return h(
      'div',
      { class: 'flex items-center justify-center h-full text-muted-foreground' },
      'Page under construction'
    )
  }
}

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
    component: LibraryLayout,
    children: [
      {
        path: '',
        name: 'showcase',
        component: ShowcasePage,
        meta: { dataLoaders: [showcaseSectionsData] }
      },
      {
        path: 'game/:gameId',
        name: 'game-detail',
        component: GameDetailPage,
        props: true,
        meta: { entityType: 'game', dataLoaders: [gameDetailData] }
      },
      {
        path: 'person/:personId',
        name: 'person-detail',
        component: PersonDetailPage,
        props: true,
        meta: { entityType: 'person', dataLoaders: [personDetailData] }
      },
      {
        path: 'character/:characterId',
        name: 'character-detail',
        component: CharacterDetailPage,
        props: true,
        meta: { entityType: 'character', dataLoaders: [characterDetailData] }
      },
      {
        path: 'company/:companyId',
        name: 'company-detail',
        component: CompanyDetailPage,
        props: true,
        meta: { entityType: 'company', dataLoaders: [companyDetailData] }
      },
      {
        path: 'collection/:collectionId',
        name: 'collection-detail',
        component: CollectionDetailPage,
        props: true,
        meta: { entityType: 'collection', dataLoaders: [collectionDetailData] }
      },
      {
        path: 'tag/:tagId',
        name: 'tag-detail',
        component: TagDetailPage,
        props: true,
        meta: { entityType: 'tag', dataLoaders: [tagDetailData] }
      },
      {
        path: 'collections',
        name: 'collections',
        component: CollectionsPage,
        meta: { dataLoaders: [collectionsListData] }
      },
      {
        path: 'uncategorized/:entityType',
        name: 'uncategorized',
        component: UncategorizedPage,
        props: true,
        meta: { dataLoaders: [uncategorizedData] }
      },
      {
        path: 'favorites',
        name: 'favorites',
        component: FavoritesPage,
        meta: { dataLoaders: [favoritesData] }
      }
    ]
  },
  // Statistics routes
  {
    path: '/statistics',
    component: StatisticsLayout,
    redirect: '/statistics/overview',
    children: [
      {
        path: 'overview',
        name: 'statistics-overview',
        component: StatisticsOverviewPage,
        meta: { dataLoaders: [statisticsData] }
      },
      {
        path: 'weekly',
        name: 'statistics-weekly',
        component: StatisticsWeeklyPage,
        meta: { dataLoaders: [statisticsData] }
      },
      {
        path: 'monthly',
        name: 'statistics-monthly',
        component: StatisticsMonthlyPage,
        meta: { dataLoaders: [statisticsData] }
      },
      {
        path: 'yearly',
        name: 'statistics-yearly',
        component: StatisticsYearlyPage,
        meta: { dataLoaders: [statisticsData] }
      }
    ]
  },
  // Scanner
  {
    path: '/scanner',
    name: 'scanner',
    component: ScannerPage,
    meta: { dataLoaders: [scannersData] }
  },
  // automations
  {
    path: '/automation',
    name: 'automation',
    component: AutomationPage,
    meta: { dataLoaders: [automationsData] }
  },
  // Extension
  {
    path: '/extension',
    component: ExtensionLayout,
    redirect: '/extension/discover',
    children: [
      {
        path: 'discover',
        name: 'extension-discover',
        component: ExtensionDiscoverPage,
        meta: { dataLoaders: [discoverSearchData, installedExtensionsData] }
      },
      {
        path: 'installed',
        name: 'extension-installed',
        component: ExtensionInstalledPage,
        meta: { dataLoaders: [installedExtensionsData] }
      },
      {
        path: 'repositories',
        name: 'extension-repositories',
        component: ExtensionRepositoriesPage,
        meta: { dataLoaders: [extensionRepositoriesData] }
      },
      {
        path: 'signers',
        name: 'extension-signers',
        component: ExtensionSignersPage,
        meta: { dataLoaders: [extensionSignersData] }
      }
    ]
  },
  // Extension declared page surface
  {
    path: '/extension-page/:extensionId/:pageId',
    name: 'extension-page',
    component: ExtensionPage,
    props: true
  },
  // Updater
  {
    path: '/updater',
    name: 'updater',
    component: PlaceholderPage
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
  // Only ContentEntityType (game, character, person, company) needs the from parameter
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
