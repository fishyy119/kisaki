import { buildEntityCanonicalIdentityKey } from '@shared/identity'
import type { CoreCompanyMetadata } from '@shared/metadata'
import type { ScrapedCompanyBundle, ScraperLookup } from '@shared/scraper'
import type { IngestCompanyGraph } from './types'
import { firstNonEmpty, mergeExternalIds, normalizeCompanyCore, pickFirstUrl } from './common'

function toCompanyRootCore(
  bundle: ScrapedCompanyBundle,
  lookup: ScraperLookup
): CoreCompanyMetadata {
  const normalized = normalizeCompanyCore({
    ...(bundle.core ?? {}),
    name: firstNonEmpty(bundle.core?.name, lookup.name),
    externalIds: mergeExternalIds(bundle.identity.externalIds, lookup.knownIds)
  })

  if (!normalized) {
    throw new Error('Ingest requires a non-empty company name')
  }

  return normalized
}

export function buildCompanyGraph(
  bundle: ScrapedCompanyBundle,
  lookup: ScraperLookup
): IngestCompanyGraph {
  const core = toCompanyRootCore(bundle, lookup)
  const logoUrl = pickFirstUrl(bundle.mediaCandidates?.logoUrls)
  const identityKey = buildEntityCanonicalIdentityKey(core)

  return {
    company: {
      identityKey,
      core,
      logoUrls: logoUrl ? [logoUrl] : undefined
    }
  }
}
