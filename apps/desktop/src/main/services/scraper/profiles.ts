import { asc, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db/schema'
import { scraperProfiles, type ScraperProfile } from '@shared/db/schema'
import type { ScraperProfileListQuery, ScraperProfileSummary } from '@shared/scraper'

export class ScraperProfileCatalog {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  list(query: ScraperProfileListQuery = {}): ScraperProfileSummary[] {
    const rows = this.db
      .select()
      .from(scraperProfiles)
      .orderBy(asc(scraperProfiles.order), asc(scraperProfiles.name))
      .all()
    const filtered = query.mediaType
      ? rows.filter((profile) => profile.mediaType === query.mediaType)
      : rows

    return filtered.map((profile) => toScraperProfileSummary(profile))
  }

  get(profileId: string): ScraperProfileSummary | null {
    const profile =
      this.db
        .select()
        .from(scraperProfiles)
        .where(eq(scraperProfiles.id, profileId))
        .limit(1)
        .get() ?? null

    return profile ? toScraperProfileSummary(profile) : null
  }
}

function toScraperProfileSummary(profile: ScraperProfile): ScraperProfileSummary {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    mediaType: profile.mediaType,
    searchProviderId: profile.searchProviderId,
    defaultLocale: profile.defaultLocale,
    providerSlots: Object.entries(profile.slotConfigs).map(([slot, config]) => ({
      slot,
      providerIds: config.providers
        .filter((provider) => provider.enabled)
        .sort((left, right) => left.priority - right.priority)
        .map((provider) => provider.providerId)
    }))
  }
}
