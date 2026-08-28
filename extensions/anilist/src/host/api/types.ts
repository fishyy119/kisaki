/**
 * AniList GraphQL response models.
 *
 * Shapes verified against the live API; only the fields this extension reads
 * are modeled. Every field is optional-tolerant because GraphQL nulls any
 * member the server cannot answer.
 */

export interface AnilistFuzzyDate {
  year?: number | null
  month?: number | null
  day?: number | null
}

export interface AnilistTitle {
  romaji?: string | null
  english?: string | null
  native?: string | null
}

export interface AnilistImage {
  extraLarge?: string | null
  large?: string | null
  medium?: string | null
}

export interface AnilistName {
  full?: string | null
  native?: string | null
  alternative?: string[] | null
}

export interface AnilistTag {
  name?: string | null
  rank?: number | null
  isMediaSpoiler?: boolean | null
  isAdult?: boolean | null
}

export interface AnilistExternalLink {
  site?: string | null
  url?: string | null
}

export interface AnilistStudioEdge {
  isMain?: boolean | null
  node?: {
    id: number
    name?: string | null
  } | null
}

export interface AnilistStaffNode {
  id: number
  name?: AnilistName | null
  image?: AnilistImage | null
  description?: string | null
  gender?: string | null
  dateOfBirth?: AnilistFuzzyDate | null
  dateOfDeath?: AnilistFuzzyDate | null
  siteUrl?: string | null
}

export interface AnilistStaffEdge {
  role?: string | null
  node?: AnilistStaffNode | null
}

export interface AnilistCharacterNode {
  id: number
  name?: AnilistName | null
  image?: AnilistImage | null
  description?: string | null
  gender?: string | null
  /** Free text such as `"17"` or `"1000+"`. */
  age?: string | null
  bloodType?: string | null
  dateOfBirth?: AnilistFuzzyDate | null
  siteUrl?: string | null
}

export interface AnilistCharacterEdge {
  role?: string | null
  voiceActors?: AnilistStaffNode[] | null
  node?: AnilistCharacterNode | null
}

export interface AnilistRelationEdge {
  relationType?: string | null
  node?: {
    id: number
    type?: string | null
    format?: string | null
  } | null
}

export interface AnilistPageInfo {
  hasNextPage?: boolean | null
}

export interface AnilistCharacterConnection {
  pageInfo?: AnilistPageInfo | null
  edges?: AnilistCharacterEdge[] | null
}

export interface AnilistStaffConnection {
  pageInfo?: AnilistPageInfo | null
  edges?: AnilistStaffEdge[] | null
}

export interface AnilistMedia {
  id: number
  idMal?: number | null
  type?: string | null
  format?: string | null
  countryOfOrigin?: string | null
  title?: AnilistTitle | null
  synonyms?: string[] | null
  description?: string | null
  startDate?: AnilistFuzzyDate | null
  episodes?: number | null
  chapters?: number | null
  volumes?: number | null
  coverImage?: AnilistImage | null
  bannerImage?: string | null
  genres?: string[] | null
  tags?: AnilistTag[] | null
  studios?: { edges?: AnilistStudioEdge[] | null } | null
  relations?: { edges?: AnilistRelationEdge[] | null } | null
  externalLinks?: AnilistExternalLink[] | null
  siteUrl?: string | null
}

export interface AnilistMediaSearchItem {
  id: number
  type?: string | null
  format?: string | null
  countryOfOrigin?: string | null
  title?: AnilistTitle | null
  startDate?: AnilistFuzzyDate | null
  idMal?: number | null
}

export interface AnilistViewer {
  id: number
  name?: string | null
}

export interface AnilistMediaListEntry {
  status?: string | null
  /** Requested as `score(format: POINT_100)`, so always on the 100 scale. */
  score?: number | null
  media?: AnilistMediaSearchItem | null
}

export interface AnilistMediaListGroup {
  entries?: AnilistMediaListEntry[] | null
}

export interface AnilistMediaListCollection {
  lists?: AnilistMediaListGroup[] | null
}

export interface AnilistSaveMediaListEntryResult {
  id?: number | null
}
