import type { ScraperProfileSummary } from '@kisaki3/extension-sdk'

export function createProfileOptions(profiles: readonly ScraperProfileSummary[]) {
  return profiles.map((profile) => ({
    value: profile.id,
    label: profile.name,
    ...(profile.description ? { description: profile.description } : {})
  }))
}
