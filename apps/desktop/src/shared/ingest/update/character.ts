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

export const CHARACTER_UPDATE_SURFACES = defineIngestUpdateSurfaces([
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'birthDate', group: 'core', cardinality: 'singular' },
  { key: 'gender', group: 'core', cardinality: 'singular' },
  { key: 'age', group: 'core', cardinality: 'singular' },
  { key: 'bloodType', group: 'core', cardinality: 'singular' },
  { key: 'height', group: 'core', cardinality: 'singular' },
  { key: 'weight', group: 'core', cardinality: 'singular' },
  { key: 'bust', group: 'core', cardinality: 'singular' },
  { key: 'waist', group: 'core', cardinality: 'singular' },
  { key: 'hips', group: 'core', cardinality: 'singular' },
  { key: 'cup', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'relatedSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'person', group: 'relation', cardinality: 'collection' },
  { key: 'photos', group: 'media', cardinality: 'singular' }
] as const)

export const CHARACTER_UPDATE_SURFACE_KEYS = listIngestUpdateSurfaceKeys(CHARACTER_UPDATE_SURFACES)
export const CHARACTER_UPDATE_CORE_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  CHARACTER_UPDATE_SURFACES,
  'core'
)
export const CHARACTER_UPDATE_RELATION_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  CHARACTER_UPDATE_SURFACES,
  'relation'
)
export const CHARACTER_UPDATE_MEDIA_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  CHARACTER_UPDATE_SURFACES,
  'media'
)

export type CharacterUpdateSurface = IngestUpdateSurfaceKey<typeof CHARACTER_UPDATE_SURFACES>
export type CharacterUpdateCoreSurface = IngestUpdateSurfaceKeysByGroup<
  typeof CHARACTER_UPDATE_SURFACES,
  'core'
>
export type CharacterUpdateRelationSurface = IngestUpdateSurfaceKeysByGroup<
  typeof CHARACTER_UPDATE_SURFACES,
  'relation'
>
export type CharacterUpdateMediaSurface = IngestUpdateSurfaceKeysByGroup<
  typeof CHARACTER_UPDATE_SURFACES,
  'media'
>

export type CharacterUpdateSelection = IngestUpdateSelection<CharacterUpdateSurface>
export type CharacterUpdateRequest = IngestUpdateRequest<CharacterUpdateSurface>
export type CharacterBatchUpdateRequest = IngestBatchUpdateRequest<CharacterUpdateSurface>
