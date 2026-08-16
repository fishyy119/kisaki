import {
  collectionTvLinks,
  tvCharacterLinks,
  tvCompanyLinks,
  tvPersonLinks,
  tvTagLinks,
  tvs
} from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const tvFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'tv',
  table: tvs,
  fields: [
    { key: 'isFavorite', kind: 'boolean', column: tvs.isFavorite },
    { key: 'isNsfw', kind: 'boolean', column: tvs.isNsfw },

    { key: 'status', kind: 'enum', column: tvs.status },
    { key: 'format', kind: 'enum', column: tvs.format },

    { key: 'score', kind: 'number', column: tvs.score },
    { key: 'totalDuration', kind: 'number', column: tvs.totalDuration },
    { key: 'totalSeasons', kind: 'number', column: tvs.totalSeasons },
    { key: 'totalEpisodes', kind: 'number', column: tvs.totalEpisodes },

    { key: 'releaseDate', kind: 'date', mode: 'partialDate', column: tvs.releaseDate },
    { key: 'endDate', kind: 'date', mode: 'partialDate', column: tvs.endDate },
    { key: 'lastActiveAt', kind: 'date', mode: 'timestampMs', column: tvs.lastActiveAt },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: tvs.createdAt },

    {
      key: 'tags',
      kind: 'relation',
      targetEntity: 'tag',
      link: {
        table: tvTagLinks,
        entityIdColumn: tvTagLinks.tvId,
        relatedIdColumn: tvTagLinks.tagId
      }
    },
    {
      key: 'collections',
      kind: 'relation',
      targetEntity: 'collection',
      link: {
        table: collectionTvLinks,
        entityIdColumn: collectionTvLinks.tvId,
        relatedIdColumn: collectionTvLinks.collectionId
      }
    },
    {
      key: 'persons',
      kind: 'relation',
      targetEntity: 'person',
      link: {
        table: tvPersonLinks,
        entityIdColumn: tvPersonLinks.tvId,
        relatedIdColumn: tvPersonLinks.personId
      }
    },
    {
      key: 'companies',
      kind: 'relation',
      targetEntity: 'company',
      link: {
        table: tvCompanyLinks,
        entityIdColumn: tvCompanyLinks.tvId,
        relatedIdColumn: tvCompanyLinks.companyId
      }
    },
    {
      key: 'characters',
      kind: 'relation',
      targetEntity: 'character',
      link: {
        table: tvCharacterLinks,
        entityIdColumn: tvCharacterLinks.tvId,
        relatedIdColumn: tvCharacterLinks.characterId
      }
    }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: tvs.name },
      { key: 'sortName', kind: 'column', column: tvs.sortName },
      { key: 'originalName', kind: 'column', column: tvs.originalName },
      { key: 'lastActiveAt', kind: 'column', column: tvs.lastActiveAt },
      { key: 'totalDuration', kind: 'column', column: tvs.totalDuration },
      { key: 'createdAt', kind: 'column', column: tvs.createdAt },
      { key: 'releaseDate', kind: 'partialDate', column: tvs.releaseDate },
      { key: 'score', kind: 'column', column: tvs.score }
    ]
  }
})
