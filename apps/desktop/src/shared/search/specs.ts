import type { AllEntityType } from '@shared/entity-types'
import { collections, tags } from '@shared/db'
import type { SearchQuerySpec } from './spec'

export const gameSearchQuerySpec: SearchQuerySpec = {
  kind: 'fts',
  ftsTable: 'games_fts',
  sourceTable: 'games'
}

export const animeSearchQuerySpec: SearchQuerySpec = {
  kind: 'fts',
  ftsTable: 'animes_fts',
  sourceTable: 'animes'
}

export const comicSearchQuerySpec: SearchQuerySpec = {
  kind: 'fts',
  ftsTable: 'comics_fts',
  sourceTable: 'comics'
}

export const novelSearchQuerySpec: SearchQuerySpec = {
  kind: 'fts',
  ftsTable: 'novels_fts',
  sourceTable: 'novels'
}

export const characterSearchQuerySpec: SearchQuerySpec = {
  kind: 'fts',
  ftsTable: 'characters_fts',
  sourceTable: 'characters'
}

export const personSearchQuerySpec: SearchQuerySpec = {
  kind: 'fts',
  ftsTable: 'persons_fts',
  sourceTable: 'persons'
}

export const companySearchQuerySpec: SearchQuerySpec = {
  kind: 'fts',
  ftsTable: 'companies_fts',
  sourceTable: 'companies'
}

export const collectionSearchQuerySpec: SearchQuerySpec = {
  kind: 'like',
  columns: [collections.name]
}

export const tagSearchQuerySpec: SearchQuerySpec = {
  kind: 'like',
  columns: [tags.name]
}

export function getSearchQuerySpec(entityType: AllEntityType): SearchQuerySpec {
  switch (entityType) {
    case 'game':
      return gameSearchQuerySpec
    case 'anime':
      return animeSearchQuerySpec
    case 'comic':
      return comicSearchQuerySpec
    case 'novel':
      return novelSearchQuerySpec
    case 'character':
      return characterSearchQuerySpec
    case 'person':
      return personSearchQuerySpec
    case 'company':
      return companySearchQuerySpec
    case 'collection':
      return collectionSearchQuerySpec
    case 'tag':
      return tagSearchQuerySpec
  }
}
