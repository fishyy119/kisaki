import {
  animePersonLinks,
  characterPersonLinks,
  collectionPersonLinks,
  gamePersonLinks,
  persons,
  personTagLinks
} from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const personFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'person',
  table: persons,
  fields: [
    { key: 'isFavorite', kind: 'boolean', column: persons.isFavorite },
    { key: 'isNsfw', kind: 'boolean', column: persons.isNsfw },

    { key: 'gender', kind: 'enum', column: persons.gender },

    { key: 'score', kind: 'number', column: persons.score },

    { key: 'birthDate', kind: 'date', mode: 'partialDate', column: persons.birthDate },
    { key: 'deathDate', kind: 'date', mode: 'partialDate', column: persons.deathDate },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: persons.createdAt },

    {
      key: 'games',
      kind: 'relation',
      targetEntity: 'game',
      link: {
        table: gamePersonLinks,
        entityIdColumn: gamePersonLinks.personId,
        relatedIdColumn: gamePersonLinks.gameId
      }
    },
    {
      key: 'animes',
      kind: 'relation',
      targetEntity: 'anime',
      link: {
        table: animePersonLinks,
        entityIdColumn: animePersonLinks.personId,
        relatedIdColumn: animePersonLinks.animeId
      }
    },
    {
      key: 'characters',
      kind: 'relation',
      targetEntity: 'character',
      link: {
        table: characterPersonLinks,
        entityIdColumn: characterPersonLinks.personId,
        relatedIdColumn: characterPersonLinks.characterId
      }
    },
    {
      key: 'tags',
      kind: 'relation',
      targetEntity: 'tag',
      link: {
        table: personTagLinks,
        entityIdColumn: personTagLinks.personId,
        relatedIdColumn: personTagLinks.tagId
      }
    },
    {
      key: 'collections',
      kind: 'relation',
      targetEntity: 'collection',
      link: {
        table: collectionPersonLinks,
        entityIdColumn: collectionPersonLinks.personId,
        relatedIdColumn: collectionPersonLinks.collectionId
      }
    }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: persons.name },
      { key: 'sortName', kind: 'column', column: persons.sortName },
      { key: 'originalName', kind: 'column', column: persons.originalName },
      { key: 'createdAt', kind: 'column', column: persons.createdAt },
      { key: 'score', kind: 'column', column: persons.score },
      { key: 'birthDate', kind: 'partialDate', column: persons.birthDate }
    ]
  }
})
