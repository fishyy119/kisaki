import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createRouter, createWebHashHistory, type Router } from 'vue-router'
import Main from './main.vue'
import { installRouteData } from './core/route-data'
import { initI18n } from './core/i18n'
import {
  EXTENSION_PAGE_ROUTE_NAME,
  EXTENSION_PAGE_ROUTE_PATTERN,
  refreshExtensionContributionSnapshot,
  setupExtensionContributionStore,
  setupExtensionDevelopmentStore,
  setupExtensionWebviewNavigation,
  setupExtensionWebviewStore
} from './core/extensions'
import { setupDeeplink } from './core/deeplink'
import { libraryRoutes, libraryFromAutofillGuard } from './features/library/routes'
import { statisticsRoutes } from './features/statistics/routes'
import { scannerRoutes } from './features/scanner/routes'
import { automationRoutes } from './features/automation/routes'
import { extensionRoutes } from './features/extension/routes'
import { LIBRARY_HOME_PATH } from './utils/entity-routes'
import {
  useAnimeActivityStore,
  useGameActivityStore,
  useReadingActivityStore,
  useScannerStore,
  useDefaultFromStore,
  useUpdaterStore,
  useTaskRunStore
} from './stores'
import { createLogger } from '@renderer/core/log'

const log = createLogger('App')

// =============================================================================
// Router assembly (composition root)
// =============================================================================

// The instance stays local to the entry: components use useRouter() and setup
// modules receive an injected Router, so no module can import the singleton.
function createAppRouter(): Router {
  const router = createRouter({
    // Hash history for Electron compatibility
    history: createWebHashHistory(),
    routes: [
      { path: '/', redirect: LIBRARY_HOME_PATH },
      ...libraryRoutes,
      ...statisticsRoutes,
      ...scannerRoutes,
      ...automationRoutes,
      ...extensionRoutes,
      // Extension declared page surface; core/extensions owns the contract
      {
        path: EXTENSION_PAGE_ROUTE_PATTERN,
        name: EXTENSION_PAGE_ROUTE_NAME,
        component: () => import('./pages/extension-webview-page.vue'),
        props: true
      },
      // Catch-all 404
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('./pages/not-found-page.vue')
      }
    ],
    scrollBehavior(_to, _from, savedPosition) {
      if (savedPosition) {
        return savedPosition
      }
      return { top: 0 }
    }
  })

  installRouteData(router)
  // The library feature owns the browse-context autofill policy.
  router.beforeEach(libraryFromAutofillGuard)
  return router
}

async function initMainWindowRenderer() {
  // ===========================================================================
  // Phase 1: Critical Path (blocking - UI must wait)
  // ===========================================================================
  await initI18n()

  const app = createApp(Main)

  // Pinia with persistence plugin
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  app.use(pinia)

  // Router
  const router = createAppRouter()
  app.use(router)

  // Deeplink destinations must listen before load finishes: the main process
  // gates `deeplink:open` sends on the document's load event.
  setupDeeplink(router)

  // Global error handler
  app.config.errorHandler = (err, _instance, info) => {
    log.error('Vue Error:', err, info)
  }

  // ===========================================================================
  // Phase 2: Mount (UI becomes visible immediately)
  // ===========================================================================
  app.mount('#root')

  // ===========================================================================
  // Phase 3: Non-blocking Initialization
  // Deferred to idle time to avoid blocking first paint
  // ===========================================================================
  requestIdleCallback(async () => {
    // Extension contribution snapshot sync.
    setupExtensionContributionStore()
    void refreshExtensionContributionSnapshot().catch((error) => {
      log.error('Failed to refresh contribution snapshot:', error)
    })

    // Development extension change tracking (pending-reload nudges).
    setupExtensionDevelopmentStore()

    // Extension webview session sync and page-surface navigation.
    setupExtensionWebviewStore()
    setupExtensionWebviewNavigation(router)

    // Store initialization (registers listeners + fetches initial state)
    await useGameActivityStore().init()
    await useAnimeActivityStore().init()
    await useReadingActivityStore().init()
    await useTaskRunStore().init()
    await useScannerStore().init()
    await useDefaultFromStore().init()
    await useUpdaterStore().init()
  })
}

initMainWindowRenderer()
