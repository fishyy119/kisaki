import type { ScraperProfileSummary } from '@kisaki/extension-sdk'

export function createProfileOptions(profiles: readonly ScraperProfileSummary[]) {
  return profiles.map((profile) => ({
    value: profile.id,
    label: profile.name,
    ...(profile.description ? { description: profile.description } : {})
  }))
}
