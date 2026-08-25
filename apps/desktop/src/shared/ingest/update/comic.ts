import type { ComicScraperLookup } from '@shared/scraper'
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

// Chapters are comic-owned child rows, not satellite links, so they sit in the
// core group next to the other owned collections (externalSites/externalIds/tags)
// rather than in the relation group, whose replace semantics are tied to the
// multi-source link topology.
export const COMIC_UPDATE_SURFACES = defineIngestUpdateSurfaces([
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'aliases', group: 'core', cardinality: 'collection' },
  { key: 'releaseDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'format', group: 'core', cardinality: 'singular' },
  { key: 'totalVolumes', group: 'core', cardinality: 'singular' },
  { key: 'totalChapters', group: 'core', cardinality: 'singular' },
  { key: 'externalSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'chapters', group: 'core', cardinality: 'collection' },
  { key: 'person', group: 'relation', cardinality: 'collection' },
  { key: 'company', group: 'relation', cardinality: 'collection' },
  { key: 'character', group: 'relation', cardinality: 'collection' },
  { key: 'characterPerson', group: 'relation', cardinality: 'collection' },
  { key: 'relatedEntries', group: 'relation', cardinality: 'collection' },
  { key: 'covers', group: 'media', cardinality: 'singular' },
  { key: 'backdrops', group: 'media', cardinality: 'singular' },
  { key: 'logos', group: 'media', cardinality: 'singular' }
] as const)

export const COMIC_UPDATE_SURFACE_KEYS = listIngestUpdateSurfaceKeys(COMIC_UPDATE_SURFACES)
export const COMIC_UPDATE_CORE_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  COMIC_UPDATE_SURFACES,
  'core'
)
export const COMIC_UPDATE_RELATION_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  COMIC_UPDATE_SURFACES,
  'relation'
)
export const COMIC_UPDATE_MEDIA_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  COMIC_UPDATE_SURFACES,
  'media'
)

export type ComicUpdateSurface = IngestUpdateSurfaceKey<typeof COMIC_UPDATE_SURFACES>
export type ComicUpdateCoreSurface = IngestUpdateSurfaceKeysByGroup<
  typeof COMIC_UPDATE_SURFACES,
  'core'
>
export type ComicUpdateRelationSurface = IngestUpdateSurfaceKeysByGroup<
  typeof COMIC_UPDATE_SURFACES,
  'relation'
>
export type ComicUpdateMediaSurface = IngestUpdateSurfaceKeysByGroup<
  typeof COMIC_UPDATE_SURFACES,
  'media'
>

export type ComicUpdateSelection = IngestUpdateSelection<ComicUpdateSurface>
export type ComicUpdateRequest = IngestUpdateRequest<ComicUpdateSurface, ComicScraperLookup>
export type ComicBatchUpdateRequest = IngestBatchUpdateRequest<ComicUpdateSurface>
