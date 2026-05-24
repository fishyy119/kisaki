import { buildEntityCanonicalIdentityKey } from '@shared/identity'
import type { CorePersonMetadata } from '@shared/metadata'
import type { ScrapedPersonBundle, ScraperLookup } from '@shared/scraper'
import type { IngestPersonGraph } from './types'
import { firstNonEmpty, mergeExternalIds, normalizePersonCore, pickFirstUrl } from './common'

function toPersonRootCore(bundle: ScrapedPersonBundle, lookup: ScraperLookup): CorePersonMetadata {
  const normalized = normalizePersonCore({
    ...(bundle.core ?? {}),
    name: firstNonEmpty(bundle.core?.name, lookup.name),
    externalIds: mergeExternalIds(bundle.identity.externalIds, lookup.knownIds)
  })

  if (!normalized) {
    throw new Error('Ingest requires a non-empty person name')
  }

  return normalized
}

export function buildPersonGraph(
  bundle: ScrapedPersonBundle,
  lookup: ScraperLookup
): IngestPersonGraph {
  const core = toPersonRootCore(bundle, lookup)
  const photoUrl = pickFirstUrl(bundle.mediaCandidates?.photoUrls)
  const identityKey = buildEntityCanonicalIdentityKey(core)

  return {
    person: {
      identityKey,
      core,
      photoUrls: photoUrl ? [photoUrl] : undefined
    }
  }
}
