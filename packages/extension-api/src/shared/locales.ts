/**
 * Extension protocol locale vocabulary.
 *
 * Two independent locale axes:
 * - `UiLocale` is the host application interface language. Extensions receive it
 *   through `RuntimeInfo` and locale-change events, and use it to localize
 *   runtime contributions and webview UI.
 * - `ContentLocale` is the media metadata language used by scraper contracts.
 *
 * The host application declares its own equivalent vocabulary internally; the two
 * are bridged only at the extension host boundary.
 */

import { isPlainObject, type ValidationIssue } from './validation'

/** Host interface languages. */
export const UI_LOCALES = ['en', 'ja', 'zh-Hans', 'zh-Hant'] as const

export type UiLocale = (typeof UI_LOCALES)[number]

/** Media metadata languages (BCP 47) used by scraper contracts. */
export const CONTENT_LOCALES = [
  'en',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'pt',
  'it',
  'ru',
  'vi',
  'th',
  'id',
  'pl',
  'tr',
  'ar',
  'uk'
] as const

export type ContentLocale = (typeof CONTENT_LOCALES)[number]

/**
 * Localizable display text in manifests and registry documents.
 *
 * A plain string is a language-neutral default. The object form requires `en`
 * as the resolution baseline and may add any supported UI locale.
 */
export type LocalizedText = string | ({ en: string } & Partial<Record<UiLocale, string>>)

/**
 * Preferred fallback order per UI locale, before the `en` baseline.
 * Han-script locales prefer the sibling Han variant over English.
 */
const LOCALIZED_TEXT_FALLBACKS: Record<UiLocale, readonly UiLocale[]> = {
  en: ['en'],
  ja: ['ja', 'en'],
  'zh-Hans': ['zh-Hans', 'zh-Hant', 'en'],
  'zh-Hant': ['zh-Hant', 'zh-Hans', 'en']
}

/**
 * Resolve a localized text value for a UI locale.
 * @returns The best available variant following the locale fallback chain.
 */
export function resolveLocalizedText(text: LocalizedText, locale: UiLocale): string {
  if (typeof text === 'string') {
    return text
  }

  for (const candidate of LOCALIZED_TEXT_FALLBACKS[locale]) {
    const value = text[candidate]
    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }

  return text.en
}

interface LocalizedTextValidationOptions {
  /** Require non-empty variants. Defaults to true. */
  minLength?: number
  typeMessage?: string
  valueMessage?: string
}

/**
 * Validate an untrusted localized text value.
 * @remarks Accepts a plain string or an object keyed by supported UI locales
 * with a required `en` variant. Unknown keys are rejected.
 */
export function validateLocalizedTextShape(
  value: unknown,
  path: string,
  options: LocalizedTextValidationOptions = {}
): ValidationIssue[] {
  const minLength = options.minLength ?? 1
  const typeMessage =
    options.typeMessage ?? 'Field must be a string or an object of locale variants.'
  const valueMessage = options.valueMessage ?? 'Field must be a non-empty string.'

  if (typeof value === 'string') {
    return value.length >= minLength ? [] : [{ path, message: valueMessage }]
  }

  if (!isPlainObject(value)) {
    return [{ path, message: typeMessage }]
  }

  const issues: ValidationIssue[] = []

  for (const key of Object.keys(value)) {
    if (!(UI_LOCALES as readonly string[]).includes(key)) {
      issues.push({
        path: `${path}.${key}`,
        message: 'Unknown locale key.'
      })
    }
  }

  if (typeof value.en !== 'string' || value.en.length < minLength) {
    issues.push({
      path: `${path}.en`,
      message: 'Localized text requires a non-empty en variant.'
    })
  }

  for (const locale of UI_LOCALES) {
    const variant = value[locale]
    if (variant === undefined || locale === 'en') {
      continue
    }
    if (typeof variant !== 'string' || variant.length < minLength) {
      issues.push({
        path: `${path}.${locale}`,
        message: valueMessage
      })
    }
  }

  return issues
}

/**
 * Validate an untrusted localized text value that may be absent.
 */
export function validateOptionalLocalizedTextShape(
  value: unknown,
  path: string,
  options: LocalizedTextValidationOptions = {}
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateLocalizedTextShape(value, path, options)
}
