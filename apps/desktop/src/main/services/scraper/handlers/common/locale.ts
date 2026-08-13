/**
 * Content-locale resolution shared by every scraper handler.
 */

import type { ContentLocale } from '@shared/i18n'

/**
 * Effective content locale for one scraper step: the explicit request wins,
 * then the profile default, then the app UI locale.
 */
export function resolveContentLocale(
  explicit: ContentLocale | null | undefined,
  profile: { defaultLocale: ContentLocale | null },
  fallback: ContentLocale
): ContentLocale {
  return explicit ?? profile.defaultLocale ?? fallback
}
