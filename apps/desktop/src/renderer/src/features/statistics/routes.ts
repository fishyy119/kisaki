/**
 * Statistics route manifest.
 *
 * The layout provides the statistics context; each child route is one report
 * page whose type is declared as typed route meta. The one statistics loader
 * serves every report page, so it is declared once on the layout record and
 * runs on each report navigation.
 */

import type { RouteRecordRaw } from 'vue-router'
import { statisticsData } from './composables/use-statistics'
import type { ReportType } from './types'

declare module 'vue-router' {
  interface RouteMeta {
    /** Report type of a statistics page; the statistics loader reads it. */
    reportType?: ReportType
  }
}

/** Route names of the report pages; header tabs navigate by them. */
export const STATISTICS_ROUTE_NAMES = {
  overview: 'statistics-overview',
  weekly: 'statistics-weekly',
  monthly: 'statistics-monthly',
  yearly: 'statistics-yearly'
} as const

export const statisticsRoutes: RouteRecordRaw[] = [
  {
    path: '/statistics',
    component: () => import('./pages/statistics-layout.vue'),
    redirect: '/statistics/overview',
    meta: { dataLoaders: [statisticsData] },
    children: [
      {
        path: 'overview',
        name: STATISTICS_ROUTE_NAMES.overview,
        component: () => import('./pages/statistics-overview-page.vue'),
        meta: { reportType: 'overview' }
      },
      {
        path: 'weekly',
        name: STATISTICS_ROUTE_NAMES.weekly,
        component: () => import('./pages/statistics-weekly-page.vue'),
        meta: { reportType: 'weekly' }
      },
      {
        path: 'monthly',
        name: STATISTICS_ROUTE_NAMES.monthly,
        component: () => import('./pages/statistics-monthly-page.vue'),
        meta: { reportType: 'monthly' }
      },
      {
        path: 'yearly',
        name: STATISTICS_ROUTE_NAMES.yearly,
        component: () => import('./pages/statistics-yearly-page.vue'),
        meta: { reportType: 'yearly' }
      }
    ]
  }
]
