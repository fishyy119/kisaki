import {
  animeCompanyLinks,
  collectionCompanyLinks,
  companies,
  companyTagLinks,
  gameCompanyLinks,
  movieCompanyLinks,
  tvCompanyLinks
} from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const companyFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'company',
  table: companies,
  fields: [
    { key: 'isFavorite', kind: 'boolean', column: companies.isFavorite },
    { key: 'isNsfw', kind: 'boolean', column: companies.isNsfw },

    { key: 'score', kind: 'number', column: companies.score },

    { key: 'foundedDate', kind: 'date', mode: 'partialDate', column: companies.foundedDate },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: companies.createdAt },

    {
      key: 'games',
      kind: 'relation',
      targetEntity: 'game',
      link: {
        table: gameCompanyLinks,
        entityIdColumn: gameCompanyLinks.companyId,
        relatedIdColumn: gameCompanyLinks.gameId
      }
    },
    {
      key: 'animes',
      kind: 'relation',
      targetEntity: 'anime',
      link: {
        table: animeCompanyLinks,
        entityIdColumn: animeCompanyLinks.companyId,
        relatedIdColumn: animeCompanyLinks.animeId
      }
    },
    {
      key: 'tvs',
      kind: 'relation',
      targetEntity: 'tv',
      link: {
        table: tvCompanyLinks,
        entityIdColumn: tvCompanyLinks.companyId,
        relatedIdColumn: tvCompanyLinks.tvId
      }
    },
    {
      key: 'movies',
      kind: 'relation',
      targetEntity: 'movie',
      link: {
        table: movieCompanyLinks,
        entityIdColumn: movieCompanyLinks.companyId,
        relatedIdColumn: movieCompanyLinks.movieId
      }
    },
    {
      key: 'tags',
      kind: 'relation',
      targetEntity: 'tag',
      link: {
        table: companyTagLinks,
        entityIdColumn: companyTagLinks.companyId,
        relatedIdColumn: companyTagLinks.tagId
      }
    },
    {
      key: 'collections',
      kind: 'relation',
      targetEntity: 'collection',
      link: {
        table: collectionCompanyLinks,
        entityIdColumn: collectionCompanyLinks.companyId,
        relatedIdColumn: collectionCompanyLinks.collectionId
      }
    }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: companies.name },
      { key: 'sortName', kind: 'column', column: companies.sortName },
      { key: 'originalName', kind: 'column', column: companies.originalName },
      { key: 'createdAt', kind: 'column', column: companies.createdAt },
      { key: 'score', kind: 'column', column: companies.score },
      { key: 'foundedDate', kind: 'partialDate', column: companies.foundedDate }
    ]
  }
})
