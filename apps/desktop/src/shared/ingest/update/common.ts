import { normalizeExternalIds, normalizeKeyText, type ExternalId } from '@shared/identity'
import type { ScraperLookup } from '@shared/scraper'

export type IngestUpdateSurfaceGroup = 'core' | 'media' | 'relation'
export type IngestUpdateSurfaceCardinality = 'singular' | 'collection'

export interface IngestUpdatePolicy {
  singularUpdate: 'ifMissing' | 'overwrite'
  collectionUpdate: 'merge' | 'replace'
}

export interface IngestUpdateSurfaceDefinition<TKey extends string = string> {
  key: TKey
  group: IngestUpdateSurfaceGroup
  cardinality: IngestUpdateSurfaceCardinality
}

type IngestUpdateSurfaceDefinitions = readonly IngestUpdateSurfaceDefinition<string>[]

export type IngestUpdateSurfaceKey<TDefinitions extends IngestUpdateSurfaceDefinitions> =
  TDefinitions[number]['key']

export type IngestUpdateSurfaceKeysByGroup<
  TDefinitions extends IngestUpdateSurfaceDefinitions,
  TGroup extends IngestUpdateSurfaceGroup
> = Extract<TDefinitions[number], { group: TGroup }>['key']

export type IngestUpdateSurfaceKeysByCardinality<
  TDefinitions extends IngestUpdateSurfaceDefinitions,
  TCardinality extends IngestUpdateSurfaceCardinality
> = Extract<TDefinitions[number], { cardinality: TCardinality }>['key']

function defineIngestUpdateSurfaces<const TDefinitions extends IngestUpdateSurfaceDefinitions>(
  surfaces: TDefinitions
): TDefinitions {
  return surfaces
}

export function listIngestUpdateSurfaceKeys<
  const TDefinitions extends IngestUpdateSurfaceDefinitions
>(surfaces: TDefinitions): IngestUpdateSurfaceKey<TDefinitions>[] {
  return surfaces.map((surface) => surface.key) as IngestUpdateSurfaceKey<TDefinitions>[]
}

export function listIngestUpdateSurfaceKeysByGroup<
  const TDefinitions extends IngestUpdateSurfaceDefinitions,
  const TGroup extends IngestUpdateSurfaceGroup
>(surfaces: TDefinitions, group: TGroup): IngestUpdateSurfaceKeysByGroup<TDefinitions, TGroup>[] {
  return surfaces
    .filter((surface) => surface.group === group)
    .map((surface) => surface.key) as IngestUpdateSurfaceKeysByGroup<TDefinitions, TGroup>[]
}

export function listIngestUpdateSurfaceKeysByCardinality<
  const TDefinitions extends IngestUpdateSurfaceDefinitions,
  const TCardinality extends IngestUpdateSurfaceCardinality
>(
  surfaces: TDefinitions,
  cardinality: TCardinality
): IngestUpdateSurfaceKeysByCardinality<TDefinitions, TCardinality>[] {
  return surfaces
    .filter((surface) => surface.cardinality === cardinality)
    .map((surface) => surface.key) as IngestUpdateSurfaceKeysByCardinality<
    TDefinitions,
    TCardinality
  >[]
}

export interface IngestUpdateSelection<TSurface extends string> {
  surfaces: TSurface[]
}

export interface IngestUpdateRequest<
  TSurface extends string,
  TLookup extends ScraperLookup = ScraperLookup
> {
  rootId: string
  profileId: string
  lookup: TLookup
  selection: IngestUpdateSelection<TSurface>
  policy: IngestUpdatePolicy
}

export interface IngestBatchUpdateRequest<TSurface extends string> {
  rootIds: string[]
  profileId: string
  selection: IngestUpdateSelection<TSurface>
  policy: IngestUpdatePolicy
  useCurrentExternalIdsAsKnownIds?: boolean
}

/**
 * Known ids for an update lookup.
 *
 * The picked scraper result owns its sources: re-picking an entry rebinds those
 * ids instead of letting the stored ones pull the update back to the entry the
 * library already recorded. The entry's remaining stored ids still ride along so
 * providers the search never touched stay identified.
 */
export function mergeUpdateLookupKnownIds(
  selectionKnownIds: readonly ExternalId[] | undefined,
  storedKnownIds: readonly ExternalId[] | undefined
): ExternalId[] {
  const selection = normalizeExternalIds(selectionKnownIds)
  const selectionSources = new Set(
    selection.map((externalId) => normalizeKeyText(externalId.source))
  )
  const stored = (storedKnownIds ?? []).filter(
    (externalId) => !selectionSources.has(normalizeKeyText(externalId.source))
  )

  return normalizeExternalIds([...selection, ...stored])
}

export { defineIngestUpdateSurfaces }
