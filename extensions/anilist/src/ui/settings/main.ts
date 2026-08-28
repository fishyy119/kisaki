import { createApp, watchEffect } from 'vue'
import App from './app.vue'
import { m } from './i18n'
import './style.css'

watchEffect(() => {
  document.title = m.value.settings.webviewTitle
})

createApp(App).mount('#app')
