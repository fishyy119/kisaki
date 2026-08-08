import { customType } from 'drizzle-orm/sqlite-core'

import { parseContentLocale } from '@shared/i18n/locales'
import type { ScraperProviderEntry, ScraperSlotConfigs, SlotConfig } from '../../contracts/json'
import { matchesFiniteNumber, matchesPlainObject, requireCanonicalJsonValue } from './utils'

function parseProviderEntry(value: unknown): ScraperProviderEntry | undefined {
  if (!matchesPlainObject(value)) return undefined

  const providerId = typeof value.providerId === 'string' ? value.providerId.trim() : ''
  if (!providerId) return undefined

  const entry: ScraperProviderEntry = {
    providerId,
    enabled: value.enabled === true,
    priority: matchesFiniteNumber(value.priority) ? value.priority : 0
  }

  // `locale` distinguishes three states: absent (inherit), null (explicitly no
  // preference), and a supported content locale.
  if ('locale' in value && value.locale !== undefined) {
    entry.locale = parseContentLocale(value.locale)
  }

  return entry
}

function parseSlotConfig(value: unknown): SlotConfig | undefined {
  if (!matchesPlainObject(value)) return undefined

  const providers = Array.isArray(value.providers)
    ? value.providers.flatMap((entry) => {
        const parsed = parseProviderEntry(entry)
        return parsed ? [parsed] : []
      })
    : []

  const config: SlotConfig = {
    providers,
    strategy: value.strategy === 'enrich' ? 'enrich' : 'first'
  }

  // Whether a slot is a relation collection is a property of the slot name for
  // the profile's media type, which this generic column does not know, so the
  // key is preserved as given.
  if ('unmatchedEntityPolicy' in value) {
    return {
      ...config,
      unmatchedEntityPolicy: value.unmatchedEntityPolicy === 'append' ? 'append' : 'ignore'
    }
  }

  return config
}

/** Canonical form of stored slot configurations; unusable slots are dropped. */
export function parseScraperSlotConfigs(value: unknown): ScraperSlotConfigs {
  if (!matchesPlainObject(value)) return {}

  const configs: ScraperSlotConfigs = {}
  for (const [slot, config] of Object.entries(value)) {
    const parsed = parseSlotConfig(config)
    if (parsed) {
      configs[slot] = parsed
    }
  }
  return configs
}

/**
 * ScraperSlotConfigs JSON column.
 *
 * Lenient read: unrecognized slots, providers, and enum values degrade so a
 * corrupt profile still opens. Strict write: the value must already be
 * canonical, so no profile is silently saved with slots the app dropped.
 */
export const scraperSlotConfigs = customType<{
  data: ScraperSlotConfigs
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): ScraperSlotConfigs {
    if (!value) return {}
    try {
      return parseScraperSlotConfigs(JSON.parse(value))
    } catch {
      return {}
    }
  },

  toDriver(value: ScraperSlotConfigs): string {
    return JSON.stringify(
      requireCanonicalJsonValue('scraperSlotConfigs', value, parseScraperSlotConfigs(value))
    )
  }
})
