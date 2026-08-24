import type { ContentLocale } from '@kisaki3/extension-sdk'
import type { YmgalClient } from '../api/client'
import type { YmgalSettingsV1 } from '../config/schema'
import type { YmgalNameOptions } from './format/names'

/** What every YMGal scraper provider is built on: the API and live settings. */
export interface YmgalRuntime {
  readonly client: YmgalClient
  getSettings(): Promise<YmgalSettingsV1>
}

/**
 * Request shaping for one invocation: how names are chosen and how the work is
 * cancelled.
 *
 * Settings are read per invocation rather than captured at registration, so
 * changing a preference takes effect on the next scrape instead of at the next
 * app start.
 */
export interface YmgalRequestContext extends YmgalNameOptions {
  signal: AbortSignal
}

export async function createRequestContext(
  runtime: YmgalRuntime,
  locale: ContentLocale,
  signal: AbortSignal
): Promise<YmgalRequestContext> {
  const settings = await runtime.getSettings()

  return {
    locale,
    preferChineseNames: settings.naming.preferChineseNames,
    signal
  }
}
