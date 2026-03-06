/**
 * Metadata updater service types.
 */

import type {
  ScrapedCharacterMetadata,
  ScrapedCompanyMetadata,
  ScrapedGameMetadata,
  ScrapedPersonMetadata
} from './scraper'

/**
 * TEMP: Metadata updater currently reuses Scraped*Metadata as update payload shapes.
 * Remove when the metadata-updater rewrite lands with dedicated updater contracts.
 */

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

export type GameMetadataUpdateInput = Partial<Pick<ScrapedGameMetadata, GameMetadataUpdateField>>

export type PersonMetadataUpdateInput = Partial<
  Pick<ScrapedPersonMetadata, PersonMetadataUpdateField>
>

export type CompanyMetadataUpdateInput = Partial<
  Pick<ScrapedCompanyMetadata, CompanyMetadataUpdateField>
>

export type CharacterMetadataUpdateInput = Partial<
  Pick<ScrapedCharacterMetadata, CharacterMetadataUpdateField>
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
