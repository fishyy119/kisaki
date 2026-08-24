import { UI_LOCALES, type LocalizedText, type UiLocale } from '@kisaki3/extension-sdk'
import { getIgdbMessages, type IgdbMessages } from '../shared/i18n'

/**
 * Host-process UI locale state. Seeded from `RuntimeInfo.uiLocale` during
 * activation and refreshed through the `app.ui-locale.changed` host event.
 */
let currentLocale: UiLocale = 'en'

export function setHostUiLocale(locale: UiLocale): void {
  currentLocale = locale
}

/** Returns the message catalog for the current host UI locale. */
export function m(): IgdbMessages {
  return getIgdbMessages(currentLocale)
}

/**
 * Builds a LocalizedText covering every UI locale, for declarative
 * contributions whose text the renderer resolves against its own locale.
 */
export function localizedMessage(select: (messages: IgdbMessages) => string): LocalizedText {
  const text: { en: string } & Partial<Record<UiLocale, string>> = {
    en: select(getIgdbMessages('en'))
  }
  for (const locale of UI_LOCALES) {
    text[locale] = select(getIgdbMessages(locale))
  }
  return text
}
