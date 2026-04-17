import type { ExternalId, PartialDate, RelatedSite, SerializableRecord } from '../../shared'

export interface SaveBackup {
  backupAt: number
  note: string
  locked: boolean
  saveFile: string
  sizeBytes?: number
}

export type SortDirection = 'asc' | 'desc'

export interface DynamicEntityConfig {
  enabled: boolean
  filter: SerializableRecord
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

export const LIBRARY_GENDERS = ['male', 'female', 'other'] as const

export type LibraryGender = (typeof LIBRARY_GENDERS)[number]

export const LIBRARY_BLOOD_TYPES = ['a', 'b', 'ab', 'o'] as const

export type LibraryBloodType = (typeof LIBRARY_BLOOD_TYPES)[number]

export const LIBRARY_CUP_SIZES = [
  'aaa',
  'aa',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k'
] as const

export type LibraryCupSize = (typeof LIBRARY_CUP_SIZES)[number]

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
  coverFile?: string
  backdropFile?: string
  logoFile?: string
  iconFile?: string
  releaseDate?: PartialDate
  status?: LibraryGameStatus
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

export type LibraryGamePatch = Partial<LibraryGameCreateInput> & {
  lastActiveAt?: number | null
  totalDuration?: number
}

export interface LibraryPersonCreateInput extends LibraryRankedEntityInputBase {
  photoFile?: string
  birthDate?: PartialDate
  deathDate?: PartialDate
  gender?: LibraryGender
  externalIds?: readonly ExternalId[]
}

export type LibraryPersonPatch = Partial<LibraryPersonCreateInput>

export interface LibraryCompanyCreateInput extends LibraryRankedEntityInputBase {
  foundedDate?: PartialDate
  logoFile?: string
  externalIds?: readonly ExternalId[]
}

export type LibraryCompanyPatch = Partial<LibraryCompanyCreateInput>

export interface LibraryCharacterCreateInput extends LibraryRankedEntityInputBase {
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

export type LibraryCharacterPatch = Partial<LibraryCharacterCreateInput>

export interface LibraryCollectionCreateInput extends LibraryEntityInputBase {
  coverFile?: string
  isNsfw?: boolean
  order?: number
  isDynamic?: boolean
  dynamicConfig?: DynamicCollectionConfig
}

export type LibraryCollectionPatch = Partial<LibraryCollectionCreateInput>

export interface LibraryTagCreateInput extends LibraryEntityInputBase {
  isNsfw?: boolean
}

export type LibraryTagPatch = Partial<LibraryTagCreateInput>

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
