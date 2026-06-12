import './styles/globals.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import Main from './main.vue'
import { router } from './core/router'
import { initI18n } from './core/i18n'
import { eventManager } from './core/event'
import {
  refreshExtensionContributionSnapshot,
  setupExtensionContributionStore,
  setupExtensionWebviewStore
} from './core/extensions'
import { setupDeeplinkHandlers } from './core/deeplink'
import {
  useGameMonitorStore,
  useScannerStore,
  useDefaultFromStore,
  useUpdaterStore,
  useTaskRunStore
} from './stores'
import { createLogger } from '@renderer/core/log'

const log = createLogger('App')

async function initMainWindowRenderer() {
  // ===========================================================================
  // Phase 1: Critical Path (blocking - UI must wait)
  // ===========================================================================
  await initI18n()
  eventManager.init()

  const app = createApp(Main)

  // Pinia with persistence plugin
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  app.use(pinia)

  // Router
  app.use(router)

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
    // Deeplink handlers (must be set up early to receive events)
    setupDeeplinkHandlers()

    // Extension contribution snapshot sync.
    setupExtensionContributionStore()
    void refreshExtensionContributionSnapshot().catch((error) => {
      log.error('Failed to refresh contribution snapshot:', error)
    })

    // Extension webview session sync.
    setupExtensionWebviewStore()

    // Store initialization (registers listeners + fetches initial state)
    await useGameMonitorStore().init()
    await useTaskRunStore().init()
    await useScannerStore().init()
    await useDefaultFromStore().init()
    await useUpdaterStore().init()
  })
}

initMainWindowRenderer()
