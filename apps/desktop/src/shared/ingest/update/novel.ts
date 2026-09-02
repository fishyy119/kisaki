import type { NovelScraperLookup } from '@shared/scraper'
import {
  defineIngestUpdateSurfaces,
  listIngestUpdateSurfaceKeys,
  listIngestUpdateSurfaceKeysByGroup,
  type IngestBatchUpdateRequest,
  type IngestUpdateRequest,
  type IngestUpdateSelection,
  type IngestUpdateSurfaceKey,
  type IngestUpdateSurfaceKeysByGroup
} from './model'

// Volumes are novel-owned child rows, not satellite links, so they sit in the
// core group next to the other owned collections (externalSites/externalIds/tags)
// rather than in the relation group, whose replace semantics are tied to the
// multi-source link topology.
export const NOVEL_UPDATE_SURFACES = defineIngestUpdateSurfaces([
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'aliases', group: 'core', cardinality: 'collection' },
  { key: 'releaseDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'format', group: 'core', cardinality: 'singular' },
  { key: 'totalVolumes', group: 'core', cardinality: 'singular' },
  { key: 'externalSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'volumes', group: 'core', cardinality: 'collection' },
  { key: 'person', group: 'relation', cardinality: 'collection' },
  { key: 'company', group: 'relation', cardinality: 'collection' },
  { key: 'character', group: 'relation', cardinality: 'collection' },
  { key: 'characterPerson', group: 'relation', cardinality: 'collection' },
  { key: 'relatedEntries', group: 'relation', cardinality: 'collection' },
  { key: 'covers', group: 'media', cardinality: 'singular' },
  { key: 'backdrops', group: 'media', cardinality: 'singular' },
  { key: 'logos', group: 'media', cardinality: 'singular' }
] as const)

export const NOVEL_UPDATE_SURFACE_KEYS = listIngestUpdateSurfaceKeys(NOVEL_UPDATE_SURFACES)
export const NOVEL_UPDATE_CORE_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  NOVEL_UPDATE_SURFACES,
  'core'
)
export const NOVEL_UPDATE_RELATION_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  NOVEL_UPDATE_SURFACES,
  'relation'
)
export const NOVEL_UPDATE_MEDIA_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  NOVEL_UPDATE_SURFACES,
  'media'
)

export type NovelUpdateSurface = IngestUpdateSurfaceKey<typeof NOVEL_UPDATE_SURFACES>
export type NovelUpdateCoreSurface = IngestUpdateSurfaceKeysByGroup<
  typeof NOVEL_UPDATE_SURFACES,
  'core'
>
export type NovelUpdateRelationSurface = IngestUpdateSurfaceKeysByGroup<
  typeof NOVEL_UPDATE_SURFACES,
  'relation'
>
export type NovelUpdateMediaSurface = IngestUpdateSurfaceKeysByGroup<
  typeof NOVEL_UPDATE_SURFACES,
  'media'
>

export type NovelUpdateSelection = IngestUpdateSelection<NovelUpdateSurface>
export type NovelUpdateRequest = IngestUpdateRequest<NovelUpdateSurface, NovelScraperLookup>
export type NovelBatchUpdateRequest = IngestBatchUpdateRequest<NovelUpdateSurface>
