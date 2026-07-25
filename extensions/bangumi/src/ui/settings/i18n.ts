import { computed, ref } from 'vue'
import { webview } from '@kisaki3/extension-sdk/webview'
import { getBangumiMessages } from '../../shared/i18n'

/**
 * Webview UI locale state. Seeded from the webview bootstrap payload and kept
 * in sync with host UI locale changes pushed by the embedder.
 */
const locale = ref(webview.uiLocale)

webview.onUiLocaleChange((next) => {
  locale.value = next
})

export const uiLocale = computed(() => locale.value)

/** Reactive message catalog for the current UI locale. */
export const m = computed(() => getBangumiMessages(locale.value))
