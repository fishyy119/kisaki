/**
 * GraphQL documents this extension sends.
 *
 * One media scrape reads the entry in a single request plus bounded pages of
 * its character and staff connections, which keeps the fan-out affordable
 * under the 30-requests-per-minute budget.
 */

const MEDIA_CORE_FIELDS = `
  id
  idMal
  type
  format
  countryOfOrigin
  title { romaji english native }
  synonyms
  description(asHtml: false)
  startDate { year month day }
  episodes
  chapters
  volumes
  coverImage { extraLarge large }
  bannerImage
  genres
  tags { name rank isMediaSpoiler isAdult }
  studios { edges { isMain node { id name } } }
  relations { edges { relationType node { id type format } } }
  externalLinks { site url }
  siteUrl
`

const SEARCH_ITEM_FIELDS = `
  id
  type
  format
  countryOfOrigin
  title { romaji english native }
  startDate { year month day }
  idMal
`

const STAFF_NODE_FIELDS = `
  id
  name { full native alternative }
  image { large }
  description(asHtml: false)
  gender
  dateOfBirth { year month day }
  dateOfDeath { year month day }
  siteUrl
`

const CHARACTER_NODE_FIELDS = `
  id
  name { full native alternative }
  image { large }
  description(asHtml: false)
  gender
  age
  bloodType
  dateOfBirth { year month day }
  siteUrl
`

export const MEDIA_QUERY = `
query ($id: Int) {
  Media(id: $id) {
${MEDIA_CORE_FIELDS}
  }
}`

export const MEDIA_SEARCH_QUERY = `
query ($search: String, $type: MediaType, $formatIn: [MediaFormat], $formatNotIn: [MediaFormat], $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $search, type: $type, format_in: $formatIn, format_not_in: $formatNotIn) {
${SEARCH_ITEM_FIELDS}
    }
  }
}`

export const MEDIA_CHARACTERS_QUERY = `
query ($id: Int, $page: Int, $perPage: Int) {
  Media(id: $id) {
    id
    characters(page: $page, perPage: $perPage, sort: [ROLE, RELEVANCE]) {
      pageInfo { hasNextPage }
      edges {
        role
        voiceActors(language: JAPANESE) {
${STAFF_NODE_FIELDS}
        }
        node {
${CHARACTER_NODE_FIELDS}
        }
      }
    }
  }
}`

export const MEDIA_STAFF_QUERY = `
query ($id: Int, $page: Int, $perPage: Int) {
  Media(id: $id) {
    id
    staff(page: $page, perPage: $perPage, sort: [RELEVANCE]) {
      pageInfo { hasNextPage }
      edges {
        role
        node {
${STAFF_NODE_FIELDS}
        }
      }
    }
  }
}`

export const STAFF_QUERY = `
query ($id: Int) {
  Staff(id: $id) {
${STAFF_NODE_FIELDS}
  }
}`

export const STAFF_SEARCH_QUERY = `
query ($search: String, $perPage: Int) {
  Page(perPage: $perPage) {
    staff(search: $search) {
${STAFF_NODE_FIELDS}
    }
  }
}`

export const CHARACTER_QUERY = `
query ($id: Int) {
  Character(id: $id) {
${CHARACTER_NODE_FIELDS}
  }
}`

export const CHARACTER_SEARCH_QUERY = `
query ($search: String, $perPage: Int) {
  Page(perPage: $perPage) {
    characters(search: $search) {
${CHARACTER_NODE_FIELDS}
    }
  }
}`

export const VIEWER_QUERY = `
query {
  Viewer {
    id
    name
  }
}`

export const MEDIA_LIST_COLLECTION_QUERY = `
query ($userId: Int, $type: MediaType) {
  MediaListCollection(userId: $userId, type: $type) {
    lists {
      entries {
        status
        score(format: POINT_100)
        media {
${SEARCH_ITEM_FIELDS}
        }
      }
    }
  }
}`

export const SAVE_MEDIA_LIST_ENTRY_MUTATION = `
mutation ($mediaId: Int, $status: MediaListStatus, $scoreRaw: Int) {
  SaveMediaListEntry(mediaId: $mediaId, status: $status, scoreRaw: $scoreRaw) {
    id
  }
}`
