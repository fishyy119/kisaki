import {
  collectionMovieLinks,
  movieCharacterLinks,
  movieCompanyLinks,
  moviePersonLinks,
  movieTagLinks,
  movies
} from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const movieFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'movie',
  table: movies,
  fields: [
    { key: 'isFavorite', kind: 'boolean', column: movies.isFavorite },
    { key: 'isNsfw', kind: 'boolean', column: movies.isNsfw },
    { key: 'watched', kind: 'boolean', column: movies.watched },

    { key: 'status', kind: 'enum', column: movies.status },
    { key: 'format', kind: 'enum', column: movies.format },

    { key: 'score', kind: 'number', column: movies.score },
    { key: 'totalDuration', kind: 'number', column: movies.totalDuration },
    { key: 'runtimeMs', kind: 'number', column: movies.runtimeMs },
    { key: 'playCount', kind: 'number', column: movies.playCount },

    { key: 'releaseDate', kind: 'date', mode: 'partialDate', column: movies.releaseDate },
    { key: 'watchedAt', kind: 'date', mode: 'timestampMs', column: movies.watchedAt },
    { key: 'lastActiveAt', kind: 'date', mode: 'timestampMs', column: movies.lastActiveAt },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: movies.createdAt },

    {
      key: 'tags',
      kind: 'relation',
      targetEntity: 'tag',
      link: {
        table: movieTagLinks,
        entityIdColumn: movieTagLinks.movieId,
        relatedIdColumn: movieTagLinks.tagId
      }
    },
    {
      key: 'collections',
      kind: 'relation',
      targetEntity: 'collection',
      link: {
        table: collectionMovieLinks,
        entityIdColumn: collectionMovieLinks.movieId,
        relatedIdColumn: collectionMovieLinks.collectionId
      }
    },
    {
      key: 'persons',
      kind: 'relation',
      targetEntity: 'person',
      link: {
        table: moviePersonLinks,
        entityIdColumn: moviePersonLinks.movieId,
        relatedIdColumn: moviePersonLinks.personId
      }
    },
    {
      key: 'companies',
      kind: 'relation',
      targetEntity: 'company',
      link: {
        table: movieCompanyLinks,
        entityIdColumn: movieCompanyLinks.movieId,
        relatedIdColumn: movieCompanyLinks.companyId
      }
    },
    {
      key: 'characters',
      kind: 'relation',
      targetEntity: 'character',
      link: {
        table: movieCharacterLinks,
        entityIdColumn: movieCharacterLinks.movieId,
        relatedIdColumn: movieCharacterLinks.characterId
      }
    }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: movies.name },
      { key: 'sortName', kind: 'column', column: movies.sortName },
      { key: 'originalName', kind: 'column', column: movies.originalName },
      { key: 'lastActiveAt', kind: 'column', column: movies.lastActiveAt },
      { key: 'watchedAt', kind: 'column', column: movies.watchedAt },
      { key: 'totalDuration', kind: 'column', column: movies.totalDuration },
      { key: 'createdAt', kind: 'column', column: movies.createdAt },
      { key: 'releaseDate', kind: 'partialDate', column: movies.releaseDate },
      { key: 'score', kind: 'column', column: movies.score }
    ]
  }
})
