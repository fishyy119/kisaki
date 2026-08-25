import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import ReaderApp from './reader.vue'
import { initI18n } from './core/i18n'
import { useThemeStore } from './stores/theme'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Reader')

async function initReaderWindowRenderer() {
  await initI18n()

  const app = createApp(ReaderApp)

  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  app.use(pinia)

  // Shares the persisted theme selection with the main window.
  useThemeStore(pinia)

  app.config.errorHandler = (err, _instance, info) => {
    log.error('Vue Error:', err, info)
  }

  app.mount('#root')
}

initReaderWindowRenderer()
