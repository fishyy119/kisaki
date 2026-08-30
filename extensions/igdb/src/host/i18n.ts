import { UI_LOCALES, kisaki, type LocalizedText, type UiLocale } from '@kisaki3/extension-sdk'
import { getIgdbMessages, type IgdbMessages } from '../shared/i18n'

/** Returns the message catalog for the current host UI locale. */
export function m(): IgdbMessages {
  return getIgdbMessages(kisaki.runtime.uiLocale)
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
    if (locale === 'en') continue
    text[locale] = select(getIgdbMessages(locale))
  }
  return text
}
