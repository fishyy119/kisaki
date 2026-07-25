import type { UiLocale } from '@kisaki3/extension-sdk'
import { getBangumiMessages, type BangumiMessages } from '../shared/i18n'

/**
 * Host-process UI locale state. Seeded from `RuntimeInfo.uiLocale` during
 * activation and refreshed through the `app.ui-locale.changed` host event.
 */
let currentLocale: UiLocale = 'en'

export function setHostUiLocale(locale: UiLocale): void {
  currentLocale = locale
}

export function getHostUiLocale(): UiLocale {
  return currentLocale
}

/** Returns the message catalog for the current host UI locale. */
export function m(): BangumiMessages {
  return getBangumiMessages(currentLocale)
}
