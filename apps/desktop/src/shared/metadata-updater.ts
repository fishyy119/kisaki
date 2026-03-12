/**
 * Metadata updater service contracts.
 */

import type {
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CorePersonMetadata
} from './metadata'

export type MetadataUpdateApply = 'always' | 'ifMissing'

export type MetadataUpdateStrategy = 'replace' | 'merge'

export interface BaseMetadataUpdateOptions {
  apply?: MetadataUpdateApply
  strategy?: MetadataUpdateStrategy
}

export const GAME_METADATA_UPDATE_FIELDS = [
  'name',
  'originalName',
  'releaseDate',
  'description',
  'relatedSites',
  'externalIds',
  'tags',
  'covers',
  'backdrops',
  'logos',
  'icons'
] as const

export type GameMetadataUpdateField = (typeof GAME_METADATA_UPDATE_FIELDS)[number]

export const PERSON_METADATA_UPDATE_FIELDS = [
  'name',
  'originalName',
  'birthDate',
  'deathDate',
  'gender',
  'description',
  'relatedSites',
  'externalIds',
  'tags',
  'photos'
] as const

export type PersonMetadataUpdateField = (typeof PERSON_METADATA_UPDATE_FIELDS)[number]

export const COMPANY_METADATA_UPDATE_FIELDS = [
  'name',
  'originalName',
  'foundedDate',
  'description',
  'relatedSites',
  'externalIds',
  'tags',
  'logos'
] as const

export type CompanyMetadataUpdateField = (typeof COMPANY_METADATA_UPDATE_FIELDS)[number]

export const CHARACTER_METADATA_UPDATE_FIELDS = [
  'name',
  'originalName',
  'birthDate',
  'gender',
  'age',
  'bloodType',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'cup',
  'description',
  'relatedSites',
  'externalIds',
  'tags',
  'photos'
] as const

export type CharacterMetadataUpdateField = (typeof CHARACTER_METADATA_UPDATE_FIELDS)[number]

/**
 * Game metadata payload accepted by the updater boundary.
 */
export interface GameMetadataUpdatePayload extends CoreGameMetadata {
  covers?: string[]
  backdrops?: string[]
  logos?: string[]
  icons?: string[]
}

/**
 * Person metadata payload accepted by the updater boundary.
 */
export interface PersonMetadataUpdatePayload extends CorePersonMetadata {
  photos?: string[]
}

/**
 * Company metadata payload accepted by the updater boundary.
 */
export interface CompanyMetadataUpdatePayload extends CoreCompanyMetadata {
  logos?: string[]
}

/**
 * Character metadata payload accepted by the updater boundary.
 */
export interface CharacterMetadataUpdatePayload extends CoreCharacterMetadata {
  photos?: string[]
}

type MetadataUpdateInput<Payload, Field extends keyof Payload> = Partial<Pick<Payload, Field>>

export type GameMetadataUpdateInput = MetadataUpdateInput<
  GameMetadataUpdatePayload,
  GameMetadataUpdateField
>

export type PersonMetadataUpdateInput = MetadataUpdateInput<
  PersonMetadataUpdatePayload,
  PersonMetadataUpdateField
>

export type CompanyMetadataUpdateInput = MetadataUpdateInput<
  CompanyMetadataUpdatePayload,
  CompanyMetadataUpdateField
>

export type CharacterMetadataUpdateInput = MetadataUpdateInput<
  CharacterMetadataUpdatePayload,
  CharacterMetadataUpdateField
>

export interface UpdateGameMetadataOptions extends BaseMetadataUpdateOptions {
  fields?: GameMetadataUpdateField[] | '#all'
}

export interface UpdatePersonMetadataOptions extends BaseMetadataUpdateOptions {
  fields?: PersonMetadataUpdateField[] | '#all'
}

export interface UpdateCompanyMetadataOptions extends BaseMetadataUpdateOptions {
  fields?: CompanyMetadataUpdateField[] | '#all'
}

export interface UpdateCharacterMetadataOptions extends BaseMetadataUpdateOptions {
  fields?: CharacterMetadataUpdateField[] | '#all'
}

export interface UpdateGameMetadataResult {
  gameId: string
  updatedFields: GameMetadataUpdateField[]
}

export interface UpdatePersonMetadataResult {
  personId: string
  updatedFields: PersonMetadataUpdateField[]
}

export interface UpdateCompanyMetadataResult {
  companyId: string
  updatedFields: CompanyMetadataUpdateField[]
}

export interface UpdateCharacterMetadataResult {
  characterId: string
  updatedFields: CharacterMetadataUpdateField[]
}
