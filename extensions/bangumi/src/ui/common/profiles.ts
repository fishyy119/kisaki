import { kisaki, type ScraperProfileSummary } from '@kisaki/extension-sdk'

export function createProfileOptions(profiles: readonly ScraperProfileSummary[]) {
  return profiles.map((profile) => ({
    value: profile.id,
    label: profile.name,
    ...(profile.description ? { description: profile.description } : {})
  }))
}

export async function listGameScraperProfiles(): Promise<readonly ScraperProfileSummary[]> {
  try {
    return await kisaki.scrapers.profiles.list({ mediaType: 'game' })
  } catch {
    return []
  }
}
