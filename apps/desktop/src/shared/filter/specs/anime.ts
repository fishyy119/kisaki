import {
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  animeTagLinks,
  animes,
  collectionAnimeLinks
} from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const animeFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'anime',
  table: animes,
  fields: [
    { key: 'isFavorite', kind: 'boolean', column: animes.isFavorite },
    { key: 'isNsfw', kind: 'boolean', column: animes.isNsfw },

    { key: 'status', kind: 'enum', column: animes.status },
    { key: 'format', kind: 'enum', column: animes.format },

    { key: 'score', kind: 'number', column: animes.score },
    { key: 'totalDuration', kind: 'number', column: animes.totalDuration },
    { key: 'totalEpisodes', kind: 'number', column: animes.totalEpisodes },

    { key: 'releaseDate', kind: 'date', mode: 'partialDate', column: animes.releaseDate },
    { key: 'lastActiveAt', kind: 'date', mode: 'timestampMs', column: animes.lastActiveAt },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: animes.createdAt },

    {
      key: 'tags',
      kind: 'relation',
      targetEntity: 'tag',
      link: {
        table: animeTagLinks,
        entityIdColumn: animeTagLinks.animeId,
        relatedIdColumn: animeTagLinks.tagId
      }
    },
    {
      key: 'collections',
      kind: 'relation',
      targetEntity: 'collection',
      link: {
        table: collectionAnimeLinks,
        entityIdColumn: collectionAnimeLinks.animeId,
        relatedIdColumn: collectionAnimeLinks.collectionId
      }
    },
    {
      key: 'persons',
      kind: 'relation',
      targetEntity: 'person',
      link: {
        table: animePersonLinks,
        entityIdColumn: animePersonLinks.animeId,
        relatedIdColumn: animePersonLinks.personId
      }
    },
    {
      key: 'companies',
      kind: 'relation',
      targetEntity: 'company',
      link: {
        table: animeCompanyLinks,
        entityIdColumn: animeCompanyLinks.animeId,
        relatedIdColumn: animeCompanyLinks.companyId
      }
    },
    {
      key: 'characters',
      kind: 'relation',
      targetEntity: 'character',
      link: {
        table: animeCharacterLinks,
        entityIdColumn: animeCharacterLinks.animeId,
        relatedIdColumn: animeCharacterLinks.characterId
      }
    }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: animes.name },
      { key: 'sortName', kind: 'column', column: animes.sortName },
      { key: 'originalName', kind: 'column', column: animes.originalName },
      { key: 'lastActiveAt', kind: 'column', column: animes.lastActiveAt },
      { key: 'totalDuration', kind: 'column', column: animes.totalDuration },
      { key: 'createdAt', kind: 'column', column: animes.createdAt },
      { key: 'releaseDate', kind: 'partialDate', column: animes.releaseDate },
      { key: 'score', kind: 'column', column: animes.score }
    ]
  }
})
