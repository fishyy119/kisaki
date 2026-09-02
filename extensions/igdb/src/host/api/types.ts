/**
 * IGDB API response models.
 *
 * Based on the official docs at https://api-docs.igdb.com. Only the fields
 * this extension reads are modeled. Reference fields are plain numeric ids
 * unless the query expands them.
 */

export interface IgdbTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

export interface IgdbNamedRow {
  id: number
  name?: string | null
}

export interface IgdbGameType {
  id?: number
  type?: string | null
}

export interface IgdbGameStatus {
  id?: number
  status?: string | null
}

export interface IgdbGame {
  id: number
  name: string
  first_release_date?: number | null
  summary?: string | null
  storyline?: string | null
  url?: string | null
  game_type?: IgdbGameType | null
  game_status?: IgdbGameStatus | null
  websites?: number[] | null
  external_games?: number[] | null
  videos?: number[] | null
  release_dates?: number[] | null
  genres?: number[] | null
  themes?: number[] | null
  keywords?: number[] | null
  game_modes?: number[] | null
  player_perspectives?: number[] | null
  platforms?: number[] | null
  language_supports?: number[] | null
  cover?: number | null
  parent_game?: number | null
  version_parent?: number | null
  dlcs?: number[] | null
  expansions?: number[] | null
  standalone_expansions?: number[] | null
  expanded_games?: number[] | null
  remakes?: number[] | null
  remasters?: number[] | null
  ports?: number[] | null
  forks?: number[] | null
  bundles?: number[] | null
}

export interface IgdbGameSearchItem {
  id: number
  name: string
  first_release_date?: number | null
}

export interface IgdbSearchResult {
  game?: number | null
  name?: string | null
  alternative_name?: string | null
}

export interface IgdbWebsite {
  id: number
  type?: number | null
  url?: string | null
  trusted?: boolean | null
}

export interface IgdbWebsiteType {
  id: number
  type?: string | null
}

export interface IgdbExternalGame {
  id: number
  uid?: string | null
  url?: string | null
  external_game_source?: number | null
}

export interface IgdbGameVideo {
  id: number
  name?: string | null
  video_id?: string | null
}

export interface IgdbReleaseDate {
  id: number
  date?: number | null
  y?: number | null
  m?: number | null
  status?: number | null
}

export interface IgdbLanguageSupport {
  id: number
  language?: number | null
  language_support_type?: number | null
}

export interface IgdbLanguage {
  id: number
  name?: string | null
  native_name?: string | null
  locale?: string | null
}

export interface IgdbImageRow {
  id: number
  image_id?: string | null
  url?: string | null
}

export interface IgdbCharacter {
  id: number
  name: string
  akas?: string[] | null
  description?: string | null
  country_name?: string | null
  character_gender?: number | null
  character_species?: number | null
  mug_shot?: number | null
  url?: string | null
}

export interface IgdbInvolvedCompany {
  id: number
  company?: number | null
  developer?: boolean | null
  publisher?: boolean | null
  porting?: boolean | null
  supporting?: boolean | null
}

export interface IgdbCompany {
  id: number
  name?: string | null
  description?: string | null
  url?: string | null
  logo?: number | null
  websites?: number[] | null
  start_date?: number | null
  country?: number | null
}
