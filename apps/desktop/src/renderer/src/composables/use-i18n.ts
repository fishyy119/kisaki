/**
 * i18n composable.
 *
 * Reactive access to the message catalog, Intl formatters, and UI locale
 * state inside Vue components:
 *
 *   const { m, f } = useI18n()
 *   // template: {{ m.actions.save }}  {{ f.date(game.releaseDate) }}
 */

import type { ComputedRef, ShallowRef } from 'vue'
import type { I18nFormatters, Messages, UiLocale } from '@shared/i18n'
import {
  formatters,
  messages,
  setUiLocalePreference,
  uiLocale,
  uiLocalePreference
} from '@renderer/core/i18n'

interface UseI18nReturn {
  /** Message catalog for the current UI locale. */
  m: ComputedRef<Messages>
  /** Intl formatters for the current UI locale. */
  f: ComputedRef<I18nFormatters>
  /** Effective UI locale. */
  locale: Readonly<ShallowRef<UiLocale>>
  /** Persisted preference; null means follow the system language. */
  preference: Readonly<ShallowRef<UiLocale | null>>
  /** Persist a new UI language preference (null = follow system). */
  setPreference(preference: UiLocale | null): Promise<void>
}

export function useI18n(): UseI18nReturn {
  return {
    m: messages,
    f: formatters,
    locale: uiLocale,
    preference: uiLocalePreference,
    setPreference: setUiLocalePreference
  }
}
