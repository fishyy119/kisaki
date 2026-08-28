/**
 * Steam API response models.
 *
 * Shapes verified against the live store and Web APIs; only fields this
 * extension reads are modeled, and every field is optional-tolerant.
 */

export interface SteamSearchItem {
  id: number
  name?: string | null
  tiny_image?: string | null
}

export interface SteamSearchResponse {
  items?: SteamSearchItem[] | null
}

export interface SteamNamedRef {
  id?: number | string | null
  description?: string | null
}

export interface SteamAppDetails {
  type?: string | null
  name?: string | null
  steam_appid?: number | null
  detailed_description?: string | null
  short_description?: string | null
  about_the_game?: string | null
  header_image?: string | null
  website?: string | null
  developers?: string[] | null
  publishers?: string[] | null
  genres?: SteamNamedRef[] | null
  categories?: SteamNamedRef[] | null
  release_date?: {
    coming_soon?: boolean | null
    /** Localized display string, e.g. "24 Feb, 2017" or "2017 年 2 月 24 日". */
    date?: string | null
  } | null
  screenshots?: { path_full?: string | null }[] | null
  background_raw?: string | null
  /** App ids of this game's DLC. */
  dlc?: number[] | null
  /** Present on DLC apps: the game they belong to. */
  fullgame?: { appid?: number | string | null; name?: string | null } | null
}

/** appdetails envelope: one entry keyed by the requested app id. */
export type SteamAppDetailsResponse = Record<
  string,
  { success?: boolean; data?: SteamAppDetails | null } | undefined
>

export interface SteamOwnedGame {
  appid: number
  name?: string | null
  playtime_forever?: number | null
}

export interface SteamOwnedGamesResponse {
  response?: {
    game_count?: number | null
    games?: SteamOwnedGame[] | null
  } | null
}
