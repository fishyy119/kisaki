import type { ContentLocale } from '@kisaki3/extension-sdk'
import type { VndbClient } from '../api/client'
import type { VndbSettingsV1 } from '../config/schema'
import type { VndbNameOptions } from './format/names'

/** What every VNDB scraper provider is built on: the API and live settings. */
export interface VndbRuntime {
  readonly client: VndbClient
  getSettings(): Promise<VndbSettingsV1>
}

/**
 * Request shaping for one invocation: how names are chosen and how the work is
 * cancelled.
 *
 * Settings are read per invocation rather than captured at registration, so
 * changing a preference takes effect on the next scrape instead of at the next
 * app start.
 */
export interface VndbRequestContext extends VndbNameOptions {
  signal: AbortSignal
}

export async function createRequestContext(
  runtime: VndbRuntime,
  locale: ContentLocale,
  signal: AbortSignal
): Promise<VndbRequestContext> {
  const settings = await runtime.getSettings()

  return {
    locale,
    preferRomanizedTitles: settings.naming.preferRomanizedTitles,
    signal
  }
}
