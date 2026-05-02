import type { BloodType, CupSize, Gender, Status } from '../db/enums'
import type { DynamicCollectionConfig, PartialDate, RelatedSite } from '../db/json-types'
import type { TableName } from '../db/table-names'
import type { ExternalId } from '../identity'

export type RawDbChangeOperation = 'inserted' | 'updated' | 'deleted'

export interface RawDbChangeEvent {
  operation: RawDbChangeOperation
  table: TableName
  id: string
  old?: Record<string, unknown>
  next?: Record<string, unknown>
  occurredAt: number
}

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

export interface LibraryGameCreatedEvent {
  gameId: string
  name: string
  occurredAt: number
}

export interface LibraryGameUpdatedEvent {
  gameId: string
  changes: LibraryGameChange[]
  occurredAt: number
}

export interface LibraryGameDeletedEvent {
  gameId: string
  occurredAt: number
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

export interface LibraryPersonCreatedEvent {
  personId: string
  name?: string
  occurredAt: number
}

export interface LibraryPersonUpdatedEvent {
  personId: string
  changes: LibraryPersonChange[]
  occurredAt: number
}

export interface LibraryPersonDeletedEvent {
  personId: string
  occurredAt: number
}

export interface LibraryCompanyCreatedEvent {
  companyId: string
  name?: string
  occurredAt: number
}

export interface LibraryCompanyUpdatedEvent {
  companyId: string
  changes: LibraryCompanyChange[]
  occurredAt: number
}

export interface LibraryCompanyDeletedEvent {
  companyId: string
  occurredAt: number
}

export interface LibraryCharacterCreatedEvent {
  characterId: string
  name?: string
  occurredAt: number
}

export interface LibraryCharacterUpdatedEvent {
  characterId: string
  changes: LibraryCharacterChange[]
  occurredAt: number
}

export interface LibraryCharacterDeletedEvent {
  characterId: string
  occurredAt: number
}

export interface LibraryCollectionCreatedEvent {
  collectionId: string
  name?: string
  occurredAt: number
}

export interface LibraryCollectionUpdatedEvent {
  collectionId: string
  changes: LibraryCollectionChange[]
  occurredAt: number
}

export interface LibraryCollectionDeletedEvent {
  collectionId: string
  occurredAt: number
}

export interface LibraryTagCreatedEvent {
  tagId: string
  name?: string
  occurredAt: number
}

export interface LibraryTagUpdatedEvent {
  tagId: string
  changes: LibraryTagChange[]
  occurredAt: number
}

export interface LibraryTagDeletedEvent {
  tagId: string
  occurredAt: number
}
