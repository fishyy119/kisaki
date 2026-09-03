/**
 * Extension route manifest.
 *
 * The extension manager shell and its four tab pages.
 */

import type { RouteRecordRaw } from 'vue-router'
import {
  discoverSearchData,
  installedExtensionsData,
  extensionRepositoriesData,
  extensionSignersData
} from './composables/loaders'

/** Route names of the extension manager pages; header tabs navigate by them. */
export const EXTENSION_ROUTE_NAMES = {
  discover: 'extension-discover',
  installed: 'extension-installed',
  repositories: 'extension-repositories',
  signers: 'extension-signers'
} as const

export const extensionRoutes: RouteRecordRaw[] = [
  {
    path: '/extension',
    component: () => import('./pages/extension-layout.vue'),
    redirect: '/extension/discover',
    children: [
      {
        path: 'discover',
        name: EXTENSION_ROUTE_NAMES.discover,
        component: () => import('./pages/extension-discover-page.vue'),
        // The filter bar's repository list is the repositories resource.
        meta: {
          routeData: [discoverSearchData, installedExtensionsData, extensionRepositoriesData]
        }
      },
      {
        path: 'installed',
        name: EXTENSION_ROUTE_NAMES.installed,
        component: () => import('./pages/extension-installed-page.vue'),
        meta: { routeData: [installedExtensionsData] }
      },
      {
        path: 'repositories',
        name: EXTENSION_ROUTE_NAMES.repositories,
        component: () => import('./pages/extension-repositories-page.vue'),
        meta: { routeData: [extensionRepositoriesData] }
      },
      {
        path: 'signers',
        name: EXTENSION_ROUTE_NAMES.signers,
        component: () => import('./pages/extension-signers-page.vue'),
        meta: { routeData: [extensionSignersData] }
      }
    ]
  }
]
