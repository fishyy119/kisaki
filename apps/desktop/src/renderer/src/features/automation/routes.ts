/**
 * Automation route manifest.
 */

import type { RouteRecordRaw } from 'vue-router'
import { automationsData } from './composables/use-automations'

export const automationRoutes: RouteRecordRaw[] = [
  {
    path: '/automation',
    name: 'automation',
    component: () => import('./pages/automation-page.vue'),
    meta: { dataLoaders: [automationsData] }
  }
]
