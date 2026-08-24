import { UI_LOCALES, type LocalizedText, type UiLocale } from '@kisaki3/extension-sdk'
import { getYmgalMessages, type YmgalMessages } from '../shared/i18n'

/**
 * Host-process UI locale state. Seeded from `RuntimeInfo.uiLocale` during
 * activation and refreshed through the `app.ui-locale.changed` host event.
 */
let currentLocale: UiLocale = 'en'

export function setHostUiLocale(locale: UiLocale): void {
  currentLocale = locale
}

/** Returns the message catalog for the current host UI locale. */
export function m(): YmgalMessages {
  return getYmgalMessages(currentLocale)
}

/**
 * Builds a LocalizedText covering every UI locale, for declarative
 * contributions whose text the renderer resolves against its own locale.
 */
export function localizedMessage(select: (messages: YmgalMessages) => string): LocalizedText {
  const text: { en: string } & Partial<Record<UiLocale, string>> = {
    en: select(getYmgalMessages('en'))
  }
  for (const locale of UI_LOCALES) {
    text[locale] = select(getYmgalMessages(locale))
  }
  return text
}
