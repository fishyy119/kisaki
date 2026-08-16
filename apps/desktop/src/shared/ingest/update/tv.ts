import type { TvScraperLookup } from '@shared/scraper'
import {
  defineIngestUpdateSurfaces,
  listIngestUpdateSurfaceKeys,
  listIngestUpdateSurfaceKeysByGroup,
  type IngestBatchUpdateRequest,
  type IngestUpdateRequest,
  type IngestUpdateSelection,
  type IngestUpdateSurfaceKey,
  type IngestUpdateSurfaceKeysByGroup
} from './common'

// Seasons and episodes are show-owned child rows, not satellite links, so they
// sit in the core group next to the other owned collections rather than in the
// relation group, whose replace semantics are tied to the multi-source link
// topology. They stay separate surfaces because a source can revise a season's
// poster without republishing its episode list.
export const TV_UPDATE_SURFACES = defineIngestUpdateSurfaces([
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'releaseDate', group: 'core', cardinality: 'singular' },
  { key: 'endDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'format', group: 'core', cardinality: 'singular' },
  { key: 'totalSeasons', group: 'core', cardinality: 'singular' },
  { key: 'totalEpisodes', group: 'core', cardinality: 'singular' },
  { key: 'externalSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'seasons', group: 'core', cardinality: 'collection' },
  { key: 'episodes', group: 'core', cardinality: 'collection' },
  { key: 'person', group: 'relation', cardinality: 'collection' },
  { key: 'company', group: 'relation', cardinality: 'collection' },
  { key: 'character', group: 'relation', cardinality: 'collection' },
  { key: 'characterPerson', group: 'relation', cardinality: 'collection' },
  { key: 'relatedEntries', group: 'relation', cardinality: 'collection' },
  { key: 'covers', group: 'media', cardinality: 'singular' },
  { key: 'backdrops', group: 'media', cardinality: 'singular' },
  { key: 'logos', group: 'media', cardinality: 'singular' }
] as const)

export const TV_UPDATE_SURFACE_KEYS = listIngestUpdateSurfaceKeys(TV_UPDATE_SURFACES)
export const TV_UPDATE_CORE_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  TV_UPDATE_SURFACES,
  'core'
)
export const TV_UPDATE_RELATION_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  TV_UPDATE_SURFACES,
  'relation'
)
export const TV_UPDATE_MEDIA_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  TV_UPDATE_SURFACES,
  'media'
)

export type TvUpdateSurface = IngestUpdateSurfaceKey<typeof TV_UPDATE_SURFACES>
export type TvUpdateCoreSurface = IngestUpdateSurfaceKeysByGroup<typeof TV_UPDATE_SURFACES, 'core'>
export type TvUpdateRelationSurface = IngestUpdateSurfaceKeysByGroup<
  typeof TV_UPDATE_SURFACES,
  'relation'
>
export type TvUpdateMediaSurface = IngestUpdateSurfaceKeysByGroup<
  typeof TV_UPDATE_SURFACES,
  'media'
>

export type TvUpdateSelection = IngestUpdateSelection<TvUpdateSurface>
export type TvUpdateRequest = IngestUpdateRequest<TvUpdateSurface, TvScraperLookup>
export type TvBatchUpdateRequest = IngestBatchUpdateRequest<TvUpdateSurface>
