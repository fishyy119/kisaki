import type { ExternalId, PartialDate, RelatedSite, JsonObject } from '../../shared'
import type { LibraryBloodType, LibraryCupSize, LibraryGender } from '../../shared/library'

export interface SaveBackup {
  backupAt: number
  note: string
  locked: boolean
  saveFile: string
  sizeBytes?: number
}

export interface LibraryGameSession {
  id: string
  gameId: string
  startedAt: number
  endedAt: number
  createdAt: number
  updatedAt: number
}

export interface LibraryGameSessionCreateInput {
  startedAt: number
  endedAt: number
}

export interface LibraryGameNote {
  id: string
  gameId: string
  name: string
  content?: string
  coverFile?: string
  orderInGame: number
  createdAt: number
  updatedAt: number
}

export interface LibraryGameNoteCreateInput {
  name: string
  content?: string
  coverPath?: string
  createdAt?: number
  updatedAt?: number
  order?: number
}

export type SortDirection = 'asc' | 'desc'

export interface DynamicEntityConfig {
  enabled: boolean
  filter: JsonObject
  sortField: string
  sortDirection: SortDirection
}

export type DynamicCollectionConfig = Record<
  'game' | 'character' | 'person' | 'company',
  DynamicEntityConfig
>

export const LIBRARY_ENTITY_TYPES = [
  'game',
  'character',
  'person',
  'company',
  'collection',
  'tag'
] as const

export type LibraryEntityType = (typeof LIBRARY_ENTITY_TYPES)[number]

export const LIBRARY_CONTENT_ENTITY_TYPES = ['game', 'character', 'person', 'company'] as const

export type LibraryContentEntityType = (typeof LIBRARY_CONTENT_ENTITY_TYPES)[number]

export const LIBRARY_ORGANIZER_ENTITY_TYPES = ['collection', 'tag'] as const

export type LibraryOrganizerEntityType = (typeof LIBRARY_ORGANIZER_ENTITY_TYPES)[number]

export const LIBRARY_GAME_STATUSES = [
  'notStarted',
  'inProgress',
  'partial',
  'completed',
  'multiple',
  'shelved'
] as const

export type LibraryGameStatus = (typeof LIBRARY_GAME_STATUSES)[number]

export const LIBRARY_GAME_LAUNCHER_MODES = ['file', 'url', 'exec'] as const

export type LibraryGameLauncherMode = (typeof LIBRARY_GAME_LAUNCHER_MODES)[number]

export const LIBRARY_GAME_MONITOR_MODES = ['file', 'folder', 'process'] as const

export type LibraryGameMonitorMode = (typeof LIBRARY_GAME_MONITOR_MODES)[number]

export interface LibraryEntityReference<TEntityType extends LibraryEntityType = LibraryEntityType> {
  entityType: TEntityType
  id: string
}

export interface LibraryListQuery {
  ids?: readonly string[]
  search?: string
  limit?: number
  offset?: number
  sort?: {
    field: string
    direction?: SortDirection
  }
}

export interface LibraryEntityBase {
  id: string
  createdAt: number
  updatedAt: number
  name: string
  description?: string
}

export interface LibraryNamedEntityBase extends LibraryEntityBase {
  originalName?: string
  sortName?: string
}

export interface LibraryRankedEntityBase extends LibraryNamedEntityBase {
  score?: number | null
  isFavorite: boolean
  isNsfw: boolean
  relatedSites?: readonly RelatedSite[]
}

export interface LibraryGame extends LibraryRankedEntityBase {
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  iconFile?: string
  releaseDate?: PartialDate
  status: LibraryGameStatus
  lastActiveAt?: number | null
  totalDuration: number
  savePath?: string
  saveBackups?: readonly SaveBackup[]
  maxSaveBackups: number
  launcherMode: LibraryGameLauncherMode
  launcherPath?: string
  monitorMode: LibraryGameMonitorMode
  monitorPath?: string
  gameDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds: readonly ExternalId[]
}

export interface LibraryPerson extends LibraryRankedEntityBase {
  photoFile?: string
  birthDate?: PartialDate
  deathDate?: PartialDate
  gender?: LibraryGender
  externalIds: readonly ExternalId[]
}

export interface LibraryCompany extends LibraryRankedEntityBase {
  foundedDate?: PartialDate
  logoFile?: string
  externalIds: readonly ExternalId[]
}

export interface LibraryCharacter extends LibraryRankedEntityBase {
  photoFile?: string
  birthDate?: PartialDate
  gender?: LibraryGender
  bloodType?: LibraryBloodType
  height?: number
  weight?: number
  bust?: number
  waist?: number
  hips?: number
  cup?: LibraryCupSize
  age?: number
  externalIds: readonly ExternalId[]
}

export interface LibraryCollection extends LibraryEntityBase {
  coverFile?: string
  isNsfw: boolean
  order: number
  isDynamic: boolean
  dynamicConfig?: DynamicCollectionConfig
}

export interface LibraryTag extends LibraryEntityBase {
  isNsfw: boolean
}

export interface LibraryEntityInputBase {
  name: string
  description?: string
}

export interface LibraryNamedEntityInputBase extends LibraryEntityInputBase {
  originalName?: string
  sortName?: string
}

export interface LibraryRankedEntityInputBase extends LibraryNamedEntityInputBase {
  score?: number | null
  isFavorite?: boolean
  isNsfw?: boolean
  relatedSites?: readonly RelatedSite[]
}

export interface LibraryGameCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  iconFile?: string
  releaseDate?: PartialDate
  status?: LibraryGameStatus
  lastActiveAt?: number | null
  totalDuration?: number
  savePath?: string
  saveBackups?: readonly SaveBackup[]
  maxSaveBackups?: number
  launcherMode?: LibraryGameLauncherMode
  launcherPath?: string
  monitorMode?: LibraryGameMonitorMode
  monitorPath?: string
  gameDirPath?: string
  descriptionInlineFiles?: readonly string[]
  externalIds?: readonly ExternalId[]
}

export type LibraryGamePatch = Partial<Omit<LibraryGameCreateInput, 'createdAt' | 'updatedAt'>> & {
  lastActiveAt?: number | null
  totalDuration?: number
}

export interface LibraryPersonCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  photoFile?: string
  birthDate?: PartialDate
  deathDate?: PartialDate
  gender?: LibraryGender
  externalIds?: readonly ExternalId[]
}

export type LibraryPersonPatch = Partial<Omit<LibraryPersonCreateInput, 'createdAt' | 'updatedAt'>>

export interface LibraryCompanyCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  foundedDate?: PartialDate
  logoFile?: string
  externalIds?: readonly ExternalId[]
}

export type LibraryCompanyPatch = Partial<
  Omit<LibraryCompanyCreateInput, 'createdAt' | 'updatedAt'>
>

export interface LibraryCharacterCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  photoFile?: string
  birthDate?: PartialDate
  gender?: LibraryGender
  bloodType?: LibraryBloodType
  height?: number
  weight?: number
  bust?: number
  waist?: number
  hips?: number
  cup?: LibraryCupSize
  age?: number
  externalIds?: readonly ExternalId[]
}

export type LibraryCharacterPatch = Partial<
  Omit<LibraryCharacterCreateInput, 'createdAt' | 'updatedAt'>
>

export interface LibraryCollectionCreateInput extends LibraryEntityInputBase {
  createdAt?: number
  updatedAt?: number
  coverFile?: string
  isNsfw?: boolean
  order?: number
  isDynamic?: boolean
  dynamicConfig?: DynamicCollectionConfig
}

export type LibraryCollectionPatch = Partial<
  Omit<LibraryCollectionCreateInput, 'createdAt' | 'updatedAt'>
>

export interface LibraryTagCreateInput extends LibraryEntityInputBase {
  createdAt?: number
  updatedAt?: number
  isNsfw?: boolean
}

export type LibraryTagPatch = Partial<Omit<LibraryTagCreateInput, 'createdAt' | 'updatedAt'>>

export interface LibraryGameQuery extends LibraryListQuery {
  statuses?: readonly LibraryGameStatus[]
  favoritesOnly?: boolean
  includeNsfw?: boolean
  collectionIds?: readonly string[]
  tagIds?: readonly string[]
}

export interface LibraryPersonQuery extends LibraryListQuery {
  favoritesOnly?: boolean
  includeNsfw?: boolean
  genders?: readonly LibraryGender[]
  tagIds?: readonly string[]
}

export interface LibraryCompanyQuery extends LibraryListQuery {
  favoritesOnly?: boolean
  includeNsfw?: boolean
  tagIds?: readonly string[]
}

export interface LibraryCharacterQuery extends LibraryListQuery {
  favoritesOnly?: boolean
  includeNsfw?: boolean
  genders?: readonly LibraryGender[]
  tagIds?: readonly string[]
}

export interface LibraryCollectionQuery extends LibraryListQuery {
  includeDynamic?: boolean
  includeStatic?: boolean
}

export interface LibraryTagQuery extends LibraryListQuery {
  includeNsfw?: boolean
}
