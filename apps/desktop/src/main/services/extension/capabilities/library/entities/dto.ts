import type { ExternalId, LibraryRankedEntityBase, RelatedSite } from '@kisaki/extension-api'
import type { Character, Company, Game, Person } from '@shared/db'
import { optionalArray, optionalValue, toTimestampMs } from './utils'

type RankedEntityRow = Pick<
  Game | Character | Person | Company,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'name'
  | 'description'
  | 'originalName'
  | 'sortName'
  | 'score'
  | 'isFavorite'
  | 'isNsfw'
  | 'relatedSites'
>

export type RankedEntityDtoBase = LibraryRankedEntityBase & {
  externalIds: readonly ExternalId[]
}

export function buildRankedEntityDtoBase(
  row: RankedEntityRow,
  externalIds: readonly ExternalId[]
): RankedEntityDtoBase {
  return {
    id: row.id,
    createdAt: toTimestampMs(row.createdAt),
    updatedAt: toTimestampMs(row.updatedAt),
    name: row.name,
    description: optionalValue(row.description),
    originalName: optionalValue(row.originalName),
    sortName: optionalValue(row.sortName),
    score: row.score,
    isFavorite: row.isFavorite,
    isNsfw: row.isNsfw,
    relatedSites: optionalArray<RelatedSite>(row.relatedSites),
    externalIds
  }
}
