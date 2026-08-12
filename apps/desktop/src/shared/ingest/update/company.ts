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

export const COMPANY_UPDATE_SURFACES = defineIngestUpdateSurfaces([
  { key: 'name', group: 'core', cardinality: 'singular' },
  { key: 'originalName', group: 'core', cardinality: 'singular' },
  { key: 'foundedDate', group: 'core', cardinality: 'singular' },
  { key: 'description', group: 'core', cardinality: 'singular' },
  { key: 'externalSites', group: 'core', cardinality: 'collection' },
  { key: 'externalIds', group: 'core', cardinality: 'collection' },
  { key: 'tags', group: 'core', cardinality: 'collection' },
  { key: 'logos', group: 'media', cardinality: 'singular' }
] as const)

export const COMPANY_UPDATE_SURFACE_KEYS = listIngestUpdateSurfaceKeys(COMPANY_UPDATE_SURFACES)
export const COMPANY_UPDATE_CORE_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  COMPANY_UPDATE_SURFACES,
  'core'
)
export const COMPANY_UPDATE_RELATION_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  COMPANY_UPDATE_SURFACES,
  'relation'
)
export const COMPANY_UPDATE_MEDIA_SURFACES = listIngestUpdateSurfaceKeysByGroup(
  COMPANY_UPDATE_SURFACES,
  'media'
)

export type CompanyUpdateSurface = IngestUpdateSurfaceKey<typeof COMPANY_UPDATE_SURFACES>
export type CompanyUpdateCoreSurface = IngestUpdateSurfaceKeysByGroup<
  typeof COMPANY_UPDATE_SURFACES,
  'core'
>
export type CompanyUpdateRelationSurface = IngestUpdateSurfaceKeysByGroup<
  typeof COMPANY_UPDATE_SURFACES,
  'relation'
>
export type CompanyUpdateMediaSurface = IngestUpdateSurfaceKeysByGroup<
  typeof COMPANY_UPDATE_SURFACES,
  'media'
>

export type CompanyUpdateSelection = IngestUpdateSelection<CompanyUpdateSurface>
export type CompanyUpdateRequest = IngestUpdateRequest<CompanyUpdateSurface>
export type CompanyBatchUpdateRequest = IngestBatchUpdateRequest<CompanyUpdateSurface>
