/**
 * Scanner route manifest.
 */

import type { RouteRecordRaw } from 'vue-router'
import { scannersData } from './composables/use-scanners'

export const scannerRoutes: RouteRecordRaw[] = [
  {
    path: '/scanner',
    name: 'scanner',
    component: () => import('./pages/scanner-page.vue'),
    meta: { routeData: [scannersData] }
  }
]
