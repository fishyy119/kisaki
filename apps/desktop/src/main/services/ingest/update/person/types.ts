import type {
  IngestUpdatePolicy,
  PersonUpdateCoreSurface,
  PersonUpdateMediaSurface,
  PersonUpdateRelationSurface,
  PersonUpdateSurface
} from '@shared/ingest/update'
import type { ExternalId } from '@shared/identity'
import type { CorePersonMetadata, Tag } from '@shared/metadata'
import type { Person } from '@shared/db'
import type {
  UpdateIncomingAvailability,
  UpdateIncomingBuildResult,
  UpdateResolvedSelection
} from '../types'

export interface PersonIncomingMediaCandidates {
  photoUrls?: string[]
}

export type PersonIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingAvailability<PersonUpdateSurface>,
  CorePersonMetadata,
  Record<never, never>,
  PersonIncomingMediaCandidates
>

export interface PersonCurrentState {
  person: Person
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface PersonUpdatePlan {
  patch: Partial<Person>
  externalIds?: ExternalId[]
  tags?: Tag[]
  photoUrl?: string
}

export interface PersonPlanContext {
  current: PersonCurrentState
  incoming: PersonIncomingBuildResult
  selection: UpdateResolvedSelection<
    PersonUpdateSurface,
    PersonUpdateCoreSurface,
    PersonUpdateMediaSurface,
    PersonUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}
