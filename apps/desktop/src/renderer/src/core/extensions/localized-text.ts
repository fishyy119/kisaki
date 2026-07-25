/**
 * Resolves extension-facing localized text against the current UI locale.
 * Reactive when called inside computed contexts (reads the locale ref).
 */

import { resolveLocalizedText, type LocalizedText } from '@kisaki3/extension-api'
import { uiLocale } from '@renderer/core/i18n'

export function resolveExtensionText(text: LocalizedText): string
export function resolveExtensionText(text: LocalizedText | undefined): string | undefined
export function resolveExtensionText(text: LocalizedText | undefined): string | undefined {
  return text === undefined ? undefined : resolveLocalizedText(text, uiLocale.value)
}
