import {
  defineIngestUpdateSurfaces,
  listIngestUpdateSurfaceKeys,
  listIngestUpdateSurfaceKeysByGroup,
  type IngestUpdateRequest,
  type IngestUpdateSelection,
  type IngestUpdateSurfaceKey,
  type IngestUpdateSurfaceKeysByGroup
} from './common'

export const PERSON_UPDATE_SURFACES = defineIngestUpdateSurfaces([
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'birthDate', group: 'core', cardinality: 'singular' },
  { key: 'deathDate', group: 'core', cardinality: 'singular' },
  { key: 'gender', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'relatedSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'photos', group: 'media', cardinality: 'singular' }
] as const)

export const PERSON_UPDATE_SURFACE_KEYS = listIngestUpdateSurfaceKeys(PERSON_UPDATE_SURFACES)
export const PERSON_UPDATE_CORE_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  PERSON_UPDATE_SURFACES,
  'core'
)
export const PERSON_UPDATE_RELATION_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  PERSON_UPDATE_SURFACES,
  'relation'
)
export const PERSON_UPDATE_MEDIA_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  PERSON_UPDATE_SURFACES,
  'media'
)

export type PersonUpdateSurface = IngestUpdateSurfaceKey<typeof PERSON_UPDATE_SURFACES>
export type PersonUpdateCoreSurface = IngestUpdateSurfaceKeysByGroup<
  typeof PERSON_UPDATE_SURFACES,
  'core'
>
export type PersonUpdateRelationSurface = IngestUpdateSurfaceKeysByGroup<
  typeof PERSON_UPDATE_SURFACES,
  'relation'
>
export type PersonUpdateMediaSurface = IngestUpdateSurfaceKeysByGroup<
  typeof PERSON_UPDATE_SURFACES,
  'media'
>

export type PersonUpdateSelection = IngestUpdateSelection<PersonUpdateSurface>
export type PersonUpdateRequest = IngestUpdateRequest<PersonUpdateSurface>
