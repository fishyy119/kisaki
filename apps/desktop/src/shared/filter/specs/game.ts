import {
  collectionGameLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  games,
  gameTagLinks
} from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const gameFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'game',
  table: games,
  fields: [
    { key: 'isFavorite', kind: 'boolean', column: games.isFavorite },
    { key: 'isNsfw', kind: 'boolean', column: games.isNsfw },

    { key: 'status', kind: 'enum', column: games.status },

    { key: 'score', kind: 'number', column: games.score },
    { key: 'totalDuration', kind: 'number', column: games.totalDuration },

    { key: 'releaseDate', kind: 'date', mode: 'partialDate', column: games.releaseDate },
    { key: 'lastActiveAt', kind: 'date', mode: 'timestampMs', column: games.lastActiveAt },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: games.createdAt },

    {
      key: 'tags',
      kind: 'relation',
      targetEntity: 'tag',
      link: {
        table: gameTagLinks,
        entityIdColumn: gameTagLinks.gameId,
        relatedIdColumn: gameTagLinks.tagId
      }
    },
    {
      key: 'collections',
      kind: 'relation',
      targetEntity: 'collection',
      link: {
        table: collectionGameLinks,
        entityIdColumn: collectionGameLinks.gameId,
        relatedIdColumn: collectionGameLinks.collectionId
      }
    },
    {
      key: 'persons',
      kind: 'relation',
      targetEntity: 'person',
      link: {
        table: gamePersonLinks,
        entityIdColumn: gamePersonLinks.gameId,
        relatedIdColumn: gamePersonLinks.personId
      }
    },
    {
      key: 'companies',
      kind: 'relation',
      targetEntity: 'company',
      link: {
        table: gameCompanyLinks,
        entityIdColumn: gameCompanyLinks.gameId,
        relatedIdColumn: gameCompanyLinks.companyId
      }
    },
    {
      key: 'characters',
      kind: 'relation',
      targetEntity: 'character',
      link: {
        table: gameCharacterLinks,
        entityIdColumn: gameCharacterLinks.gameId,
        relatedIdColumn: gameCharacterLinks.characterId
      }
    }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: games.name },
      { key: 'sortName', kind: 'column', column: games.sortName },
      { key: 'originalName', kind: 'column', column: games.originalName },
      { key: 'lastActiveAt', kind: 'column', column: games.lastActiveAt },
      { key: 'totalDuration', kind: 'column', column: games.totalDuration },
      { key: 'createdAt', kind: 'column', column: games.createdAt },
      { key: 'releaseDate', kind: 'partialDate', column: games.releaseDate },
      { key: 'score', kind: 'column', column: games.score }
    ]
  }
})
