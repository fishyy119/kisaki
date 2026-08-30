import { UI_LOCALES, kisaki, type LocalizedText, type UiLocale } from '@kisaki3/extension-sdk'
import { getVndbMessages, type VndbMessages } from '../shared/i18n'

/** Returns the message catalog for the current host UI locale. */
export function m(): VndbMessages {
  return getVndbMessages(kisaki.runtime.uiLocale)
}

/**
 * Builds a LocalizedText covering every UI locale, for declarative
 * contributions whose text the renderer resolves against its own locale.
 */
export function localizedMessage(select: (messages: VndbMessages) => string): LocalizedText {
  const text: { en: string } & Partial<Record<UiLocale, string>> = {
    en: select(getVndbMessages('en'))
  }
  for (const locale of UI_LOCALES) {
    if (locale === 'en') continue
    text[locale] = select(getVndbMessages(locale))
  }
  return text
}
