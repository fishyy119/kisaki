import type {
  CompanyUpdateCoreSurface,
  CompanyUpdateMediaSurface,
  CompanyUpdateRelationSurface,
  CompanyUpdateSurface,
  IngestUpdatePolicy
} from '@shared/ingest/update'
import type { ExternalId } from '@shared/identity'
import type { CoreCompanyMetadata, Tag } from '@shared/metadata'
import type { Company } from '@shared/db'
import type { UpdateIncomingAvailability, UpdateIncomingBuildResult, UpdateResolvedSelection } from '../types'

export interface CompanyIncomingMediaCandidates {
  logoUrls?: string[]
}

export type CompanyIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingAvailability<CompanyUpdateSurface>,
  CoreCompanyMetadata,
  Record<never, never>,
  CompanyIncomingMediaCandidates
>

export interface CompanyCurrentState {
  company: Company
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface CompanyUpdatePlan {
  patch: Partial<Company>
  externalIds?: ExternalId[]
  tags?: Tag[]
  logoUrl?: string
}

export interface CompanyPlanContext {
  current: CompanyCurrentState
  incoming: CompanyIncomingBuildResult
  selection: UpdateResolvedSelection<
    CompanyUpdateSurface,
    CompanyUpdateCoreSurface,
    CompanyUpdateMediaSurface,
    CompanyUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}
