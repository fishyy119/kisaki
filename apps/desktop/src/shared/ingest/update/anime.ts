import type { AnimeScraperLookup } from '@shared/scraper'
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

// Episodes are anime-owned child rows, not satellite links, so they sit in the
// core group next to the other owned collections (externalSites/externalIds/tags)
// rather than in the relation group, whose replace semantics are tied to the
// multi-source link topology.
export const ANIME_UPDATE_SURFACES = defineIngestUpdateSurfaces([
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'aliases', group: 'core', cardinality: 'collection' },
  { key: 'releaseDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'format', group: 'core', cardinality: 'singular' },
  { key: 'totalEpisodes', group: 'core', cardinality: 'singular' },
  { key: 'externalSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
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

export const ANIME_UPDATE_SURFACE_KEYS = listIngestUpdateSurfaceKeys(ANIME_UPDATE_SURFACES)
export const ANIME_UPDATE_CORE_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  ANIME_UPDATE_SURFACES,
  'core'
)
export const ANIME_UPDATE_RELATION_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  ANIME_UPDATE_SURFACES,
  'relation'
)
export const ANIME_UPDATE_MEDIA_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  ANIME_UPDATE_SURFACES,
  'media'
)

export type AnimeUpdateSurface = IngestUpdateSurfaceKey<typeof ANIME_UPDATE_SURFACES>
export type AnimeUpdateCoreSurface = IngestUpdateSurfaceKeysByGroup<
  typeof ANIME_UPDATE_SURFACES,
  'core'
>
export type AnimeUpdateRelationSurface = IngestUpdateSurfaceKeysByGroup<
  typeof ANIME_UPDATE_SURFACES,
  'relation'
>
export type AnimeUpdateMediaSurface = IngestUpdateSurfaceKeysByGroup<
  typeof ANIME_UPDATE_SURFACES,
  'media'
>

export type AnimeUpdateSelection = IngestUpdateSelection<AnimeUpdateSurface>
export type AnimeUpdateRequest = IngestUpdateRequest<AnimeUpdateSurface, AnimeScraperLookup>
export type AnimeBatchUpdateRequest = IngestBatchUpdateRequest<AnimeUpdateSurface>
