import { UI_LOCALES, kisaki, type LocalizedText, type UiLocale } from '@kisaki3/extension-sdk'
import { getGbooksMessages, type GbooksMessages } from '../shared/i18n'

/** Returns the message catalog for the current host UI locale. */
export function m(): GbooksMessages {
  return getGbooksMessages(kisaki.runtime.uiLocale)
}

/**
 * Builds a LocalizedText covering every UI locale, for declarative
 * contributions whose text the renderer resolves against its own locale.
 */
export function localizedMessage(select: (messages: GbooksMessages) => string): LocalizedText {
  const text: { en: string } & Partial<Record<UiLocale, string>> = {
    en: select(getGbooksMessages('en'))
  }
  for (const locale of UI_LOCALES) {
    if (locale === 'en') continue
    text[locale] = select(getGbooksMessages(locale))
  }
  return text
}
