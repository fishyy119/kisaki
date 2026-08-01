/**
 * Library change contracts.
 *
 * Facet-level change descriptors computed by the main-process db change feed
 * and consumed by the `library.changed` / `library.entity-merged` hook points.
 */

import type { BloodType, CupSize, Gender, Status } from './db/contracts/enums'
import type { DynamicCollectionConfig, PartialDate, RelatedSite } from './db/contracts/json'
import type { ExternalId } from './identity'
import type { AllEntityType } from './common'

export type LibraryEntityTopic = 'game' | 'person' | 'company' | 'character' | 'collection' | 'tag'

export type LibraryChangeKind = 'created' | 'updated' | 'deleted'

export interface LibraryGameCoreSnapshot {
  name?: string
  originalName?: string | null
  description?: string | null
  releaseDate?: PartialDate | null
}

export interface LibraryGameAssetSnapshot {
  coverFile?: string | null
  backdropFile?: string | null
  logoFile?: string | null
  iconFile?: string | null
}

export interface LibraryGameActivitySnapshot {
  totalDuration?: number
  lastActiveAt?: number | null
}

export interface LibraryGameRelationSnapshot {
  personLinkIds: string[]
  companyLinkIds: string[]
  characterLinkIds: string[]
}

export type LibraryGameChange =
  | {
      facet: 'status'
      before: { status: Status }
      after: { status: Status }
      fields?: ['status']
    }
  | {
      facet: 'score'
      before: { score: number | null }
      after: { score: number | null }
      fields?: ['score']
    }
  | {
      facet: 'identity'
      before: { externalIds: ExternalId[] }
      after: { externalIds: ExternalId[] }
      fields?: string[]
    }
  | {
      facet: 'activity'
      before: LibraryGameActivitySnapshot
      after: LibraryGameActivitySnapshot
      fields?: string[]
    }
  | {
      facet: 'tags'
      before: { tagIds: string[] }
      after: { tagIds: string[] }
      fields?: string[]
    }
  | {
      facet: 'collections'
      before: { collectionIds: string[] }
      after: { collectionIds: string[] }
      fields?: string[]
    }
  | {
      facet: 'assets'
      before: Partial<LibraryGameAssetSnapshot>
      after: Partial<LibraryGameAssetSnapshot>
      fields?: string[]
    }
  | {
      facet: 'relations'
      before: LibraryGameRelationSnapshot
      after: LibraryGameRelationSnapshot
      fields?: string[]
    }
  | {
      facet: 'core'
      before: Partial<LibraryGameCoreSnapshot>
      after: Partial<LibraryGameCoreSnapshot>
      fields?: string[]
    }

export interface LibraryPersonCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  birthDate?: PartialDate | null
  deathDate?: PartialDate | null
  gender?: Gender | null
  relatedSites?: RelatedSite[]
}

export interface LibraryCompanyCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  foundedDate?: PartialDate | null
  relatedSites?: RelatedSite[]
}

export interface LibraryCharacterCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  birthDate?: PartialDate | null
  gender?: Gender | null
  bloodType?: BloodType | null
  height?: number | null
  weight?: number | null
  bust?: number | null
  waist?: number | null
  hips?: number | null
  cup?: CupSize | null
  age?: number | null
  relatedSites?: RelatedSite[]
}

export interface LibraryCollectionCoreSnapshot {
  name?: string
  description?: string | null
  isNsfw?: boolean
  order?: number
}

export interface LibraryCollectionDynamicConfigSnapshot {
  isDynamic?: boolean
  dynamicConfig?: DynamicCollectionConfig | null
}

export interface LibraryTagCoreSnapshot {
  name?: string
  description?: string | null
  isNsfw?: boolean
}

export interface LibraryPersonAssetSnapshot {
  photoFile?: string | null
}

export interface LibraryCompanyAssetSnapshot {
  logoFile?: string | null
}

export interface LibraryCharacterAssetSnapshot {
  photoFile?: string | null
}

export interface LibraryCollectionAssetSnapshot {
  coverFile?: string | null
}

export interface LibraryCollectionMembershipSnapshot {
  gameIds?: string[]
  personIds?: string[]
  companyIds?: string[]
  characterIds?: string[]
}

export type LibraryCoreChange<TSnapshot extends object> = {
  facet: 'core'
  before: Partial<TSnapshot>
  after: Partial<TSnapshot>
  fields?: string[]
}

export type LibraryScoreChange = {
  facet: 'score'
  before: { score: number | null }
  after: { score: number | null }
  fields?: ['score']
}

export type LibraryIdentityChange = {
  facet: 'identity'
  before: { externalIds: ExternalId[] }
  after: { externalIds: ExternalId[] }
  fields?: string[]
}

export type LibraryTagsChange = {
  facet: 'tags'
  before: { tagIds: string[] }
  after: { tagIds: string[] }
  fields?: string[]
}

export type LibraryAssetChange<TSnapshot extends object> = {
  facet: 'assets'
  before: Partial<TSnapshot>
  after: Partial<TSnapshot>
  fields?: string[]
}

export type LibraryRelationsChange<TSnapshot extends object> = {
  facet: 'relations'
  before: TSnapshot
  after: TSnapshot
  fields?: string[]
}

export type LibraryMembershipChange<TSnapshot extends object> = {
  facet: 'membership'
  before: TSnapshot
  after: TSnapshot
  fields?: string[]
}

export type LibraryDynamicConfigChange = {
  facet: 'dynamicConfig'
  before: Partial<LibraryCollectionDynamicConfigSnapshot>
  after: Partial<LibraryCollectionDynamicConfigSnapshot>
  fields?: string[]
}

export type LibraryPersonChange =
  | LibraryCoreChange<LibraryPersonCoreSnapshot>
  | LibraryScoreChange
  | LibraryIdentityChange
  | LibraryTagsChange
  | LibraryAssetChange<LibraryPersonAssetSnapshot>

export type LibraryCompanyChange =
  | LibraryCoreChange<LibraryCompanyCoreSnapshot>
  | LibraryScoreChange
  | LibraryIdentityChange
  | LibraryTagsChange
  | LibraryAssetChange<LibraryCompanyAssetSnapshot>

export type LibraryCharacterChange =
  | LibraryCoreChange<LibraryCharacterCoreSnapshot>
  | LibraryScoreChange
  | LibraryIdentityChange
  | LibraryTagsChange
  | LibraryAssetChange<LibraryCharacterAssetSnapshot>

export type LibraryCollectionChange =
  | LibraryCoreChange<LibraryCollectionCoreSnapshot>
  | LibraryAssetChange<LibraryCollectionAssetSnapshot>
  | LibraryDynamicConfigChange
  | LibraryMembershipChange<LibraryCollectionMembershipSnapshot>

export type LibraryTagChange = LibraryCoreChange<LibraryTagCoreSnapshot>

export type LibraryEntityChange =
  | LibraryPersonChange
  | LibraryCompanyChange
  | LibraryCharacterChange
  | LibraryCollectionChange
  | LibraryTagChange

export type LibraryChange = LibraryGameChange | LibraryEntityChange

/** One debounced, entity-grouped change carried by the `library.changed` hook. */
export interface LibraryEntityChangeSummary {
  entity: LibraryEntityTopic
  id: string
  kind: LibraryChangeKind
  /** Present for created entities when a name is known. */
  name?: string
  /** Facet-level changes; present for updated entities. */
  changes?: LibraryChange[]
  occurredAt: number
}

export interface LibraryChangedPayload {
  changes: LibraryEntityChangeSummary[]
}

export interface LibraryEntityMergedEvent {
  entityType: AllEntityType
  targetId: string
  sourceId: string
  occurredAt: number
}
