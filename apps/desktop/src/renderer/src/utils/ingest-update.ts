import { normalizeExternalIds, normalizeKeyText, type ExternalId } from '@shared/identity'
import type { IngestUpdateLookup } from '@shared/ingest/update'

interface BuildIngestUpdateLookupOptions {
  name: string
  baseKnownIds?: ExternalId[]
  selectionKnownIds?: ExternalId[]
}

export interface BatchProgressState {
  total: number
  processed: number
  successCount: number
  failureCount: number
  currentItem: string
}

export function buildIngestUpdateLookup(
  options: BuildIngestUpdateLookupOptions
): IngestUpdateLookup {
  const selectionKnownIds = normalizeExternalIds(options.selectionKnownIds ?? [])
  const selectionSources = new Set(
    selectionKnownIds.map((externalId) => normalizeKeyText(externalId.source))
  )
  const baseKnownIds = (options.baseKnownIds ?? []).filter(
    (externalId) => !selectionSources.has(normalizeKeyText(externalId.source))
  )

  return {
    name: options.name,
    knownIds: normalizeExternalIds([...selectionKnownIds, ...baseKnownIds])
  }
}
