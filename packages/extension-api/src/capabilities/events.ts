import type {
  AppLocale,
  Disposable,
  ExternalId,
  LibraryBloodType,
  LibraryCupSize,
  LibraryGender,
  MaybePromise,
  PartialDate,
  RelatedSite,
  SerializableRecord,
  SerializableValue
} from '../shared'
import type { CommandExecutionProgress } from './commands'
import type { DynamicCollectionConfig, LibraryGameStatus } from './library/entities'

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

export interface LibraryGameRelationSnapshot {
  personLinkIds: readonly string[]
  companyLinkIds: readonly string[]
  characterLinkIds: readonly string[]
}

export type LibraryGameChange =
  | {
      facet: 'status'
      before: { status: LibraryGameStatus }
      after: { status: LibraryGameStatus }
      fields?: readonly ['status']
    }
  | {
      facet: 'score'
      before: { score: number | null }
      after: { score: number | null }
      fields?: readonly ['score']
    }
  | {
      facet: 'identity'
      before: { externalIds: readonly ExternalId[] }
      after: { externalIds: readonly ExternalId[] }
      fields?: readonly string[]
    }
  | {
      facet: 'activity'
      before: { totalDuration?: number; lastActiveAt?: number | null }
      after: { totalDuration?: number; lastActiveAt?: number | null }
      fields?: readonly string[]
    }
  | {
      facet: 'tags'
      before: { tagIds: readonly string[] }
      after: { tagIds: readonly string[] }
      fields?: readonly string[]
    }
  | {
      facet: 'collections'
      before: { collectionIds: readonly string[] }
      after: { collectionIds: readonly string[] }
      fields?: readonly string[]
    }
  | {
      facet: 'assets'
      before: Partial<LibraryGameAssetSnapshot>
      after: Partial<LibraryGameAssetSnapshot>
      fields?: readonly string[]
    }
  | {
      facet: 'relations'
      before: LibraryGameRelationSnapshot
      after: LibraryGameRelationSnapshot
      fields?: readonly string[]
    }
  | {
      facet: 'core'
      before: Partial<LibraryGameCoreSnapshot>
      after: Partial<LibraryGameCoreSnapshot>
      fields?: readonly string[]
    }

export interface LibraryGameCreatedEvent {
  gameId: string
  name: string
  occurredAt: number
}

export interface LibraryGameUpdatedEvent {
  gameId: string
  changes: readonly LibraryGameChange[]
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
  gender?: LibraryGender | null
  relatedSites?: readonly RelatedSite[]
}

export interface LibraryCompanyCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  foundedDate?: PartialDate | null
  relatedSites?: readonly RelatedSite[]
}

export interface LibraryCharacterCoreSnapshot {
  name?: string
  originalName?: string | null
  sortName?: string | null
  description?: string | null
  isFavorite?: boolean
  isNsfw?: boolean
  birthDate?: PartialDate | null
  gender?: LibraryGender | null
  bloodType?: LibraryBloodType | null
  height?: number | null
  weight?: number | null
  bust?: number | null
  waist?: number | null
  hips?: number | null
  cup?: LibraryCupSize | null
  age?: number | null
  relatedSites?: readonly RelatedSite[]
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
  gameIds?: readonly string[]
  personIds?: readonly string[]
  companyIds?: readonly string[]
  characterIds?: readonly string[]
}

export type LibraryCoreChange<TSnapshot extends object> = {
  facet: 'core'
  before: Partial<TSnapshot>
  after: Partial<TSnapshot>
  fields?: readonly string[]
}

export type LibraryScoreChange = {
  facet: 'score'
  before: { score: number | null }
  after: { score: number | null }
  fields?: readonly ['score']
}

export type LibraryIdentityChange = {
  facet: 'identity'
  before: { externalIds: readonly ExternalId[] }
  after: { externalIds: readonly ExternalId[] }
  fields?: readonly string[]
}

export type LibraryTagsChange = {
  facet: 'tags'
  before: { tagIds: readonly string[] }
  after: { tagIds: readonly string[] }
  fields?: readonly string[]
}

export type LibraryAssetChange<TSnapshot extends object> = {
  facet: 'assets'
  before: Partial<TSnapshot>
  after: Partial<TSnapshot>
  fields?: readonly string[]
}

export type LibraryRelationsChange<TSnapshot extends object> = {
  facet: 'relations'
  before: TSnapshot
  after: TSnapshot
  fields?: readonly string[]
}

export type LibraryMembershipChange<TSnapshot extends object> = {
  facet: 'membership'
  before: TSnapshot
  after: TSnapshot
  fields?: readonly string[]
}

export type LibraryDynamicConfigChange = {
  facet: 'dynamicConfig'
  before: Partial<LibraryCollectionDynamicConfigSnapshot>
  after: Partial<LibraryCollectionDynamicConfigSnapshot>
  fields?: readonly string[]
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

export interface LibraryPersonCreatedEvent {
  personId: string
  name?: string
  occurredAt: number
}

export interface LibraryPersonUpdatedEvent {
  personId: string
  changes: readonly LibraryPersonChange[]
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
  changes: readonly LibraryCompanyChange[]
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
  changes: readonly LibraryCharacterChange[]
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
  changes: readonly LibraryCollectionChange[]
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
  changes: readonly LibraryTagChange[]
  occurredAt: number
}

export interface LibraryTagDeletedEvent {
  tagId: string
  occurredAt: number
}

export interface HostEvents {
  'app.ready': Record<string, never>
  'app.locale.changed': { locale: AppLocale | null }
  'app.settings.changed': { key: string; value: SerializableValue | undefined }
  'theme.changed': { themeId: string; mode: 'light' | 'dark' | 'system' }
  'extension.enabled': { extensionId: string }
  'extension.disabled': { extensionId: string }
  'library.game.created': LibraryGameCreatedEvent
  'library.game.updated': LibraryGameUpdatedEvent
  'library.game.deleted': LibraryGameDeletedEvent
  'library.person.created': LibraryPersonCreatedEvent
  'library.person.updated': LibraryPersonUpdatedEvent
  'library.person.deleted': LibraryPersonDeletedEvent
  'library.character.created': LibraryCharacterCreatedEvent
  'library.character.updated': LibraryCharacterUpdatedEvent
  'library.character.deleted': LibraryCharacterDeletedEvent
  'library.company.created': LibraryCompanyCreatedEvent
  'library.company.updated': LibraryCompanyUpdatedEvent
  'library.company.deleted': LibraryCompanyDeletedEvent
  'library.collection.created': LibraryCollectionCreatedEvent
  'library.collection.updated': LibraryCollectionUpdatedEvent
  'library.collection.deleted': LibraryCollectionDeletedEvent
  'library.tag.created': LibraryTagCreatedEvent
  'library.tag.updated': LibraryTagUpdatedEvent
  'library.tag.deleted': LibraryTagDeletedEvent
  'command.progress': CommandExecutionProgress
  'scanner.completed': { scannerId: string; stats: Record<string, number> }
  'scanner.failed': { scannerId: string; error: string }
}

export type HostEventTopic = keyof HostEvents

export type ExtensionEventTopic = `ext.${string}`

export type HostEventListener<K extends HostEventTopic> = (
  payload: HostEvents[K]
) => MaybePromise<void>

export type ExtensionEventPayload = SerializableRecord

export type ExtensionEventListener<TPayload extends ExtensionEventPayload = ExtensionEventPayload> =
  (payload: TPayload) => MaybePromise<void>

export interface EventsCapability {
  on<K extends HostEventTopic>(topic: K, listener: HostEventListener<K>): Promise<Disposable>
  once<K extends HostEventTopic>(topic: K, listener: HostEventListener<K>): Promise<Disposable>
  onExtension<TPayload extends ExtensionEventPayload = ExtensionEventPayload>(
    topic: ExtensionEventTopic,
    listener: ExtensionEventListener<TPayload>
  ): Promise<Disposable>
  emit<TPayload extends ExtensionEventPayload = ExtensionEventPayload>(
    topic: ExtensionEventTopic,
    payload: TPayload
  ): Promise<void>
}

export function isExtensionEventTopic(value: string): value is ExtensionEventTopic {
  return /^ext\.[a-z0-9.-]+(\.[a-z0-9.-]+)+$/i.test(value)
}
