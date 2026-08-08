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

export const GAME_UPDATE_SURFACES = defineIngestUpdateSurfaces([
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'releaseDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'relatedSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'person', group: 'relation', cardinality: 'collection' },
  { key: 'company', group: 'relation', cardinality: 'collection' },
  { key: 'character', group: 'relation', cardinality: 'collection' },
  { key: 'characterPerson', group: 'relation', cardinality: 'collection' },
  { key: 'covers', group: 'media', cardinality: 'singular' },
  { key: 'backdrops', group: 'media', cardinality: 'singular' },
  { key: 'logos', group: 'media', cardinality: 'singular' },
  { key: 'icons', group: 'media', cardinality: 'singular' }
] as const)

export const GAME_UPDATE_SURFACE_KEYS = listIngestUpdateSurfaceKeys(GAME_UPDATE_SURFACES)
export const GAME_UPDATE_CORE_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  GAME_UPDATE_SURFACES,
  'core'
)
export const GAME_UPDATE_RELATION_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  GAME_UPDATE_SURFACES,
  'relation'
)
export const GAME_UPDATE_MEDIA_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  GAME_UPDATE_SURFACES,
  'media'
)

export type GameUpdateSurface = IngestUpdateSurfaceKey<typeof GAME_UPDATE_SURFACES>
export type GameUpdateCoreSurface = IngestUpdateSurfaceKeysByGroup<
  typeof GAME_UPDATE_SURFACES,
  'core'
>
export type GameUpdateRelationSurface = IngestUpdateSurfaceKeysByGroup<
  typeof GAME_UPDATE_SURFACES,
  'relation'
>
export type GameUpdateMediaSurface = IngestUpdateSurfaceKeysByGroup<
  typeof GAME_UPDATE_SURFACES,
  'media'
>

export type GameUpdateSelection = IngestUpdateSelection<GameUpdateSurface>
export type GameUpdateRequest = IngestUpdateRequest<GameUpdateSurface>
export type GameBatchUpdateRequest = IngestBatchUpdateRequest<GameUpdateSurface>
