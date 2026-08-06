import {
  characterPersonLinks,
  characters,
  characterTagLinks,
  collectionCharacterLinks,
  gameCharacterLinks
} from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const characterFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'character',
  table: characters,
  fields: [
    { key: 'isFavorite', kind: 'boolean', column: characters.isFavorite },
    { key: 'isNsfw', kind: 'boolean', column: characters.isNsfw },

    { key: 'gender', kind: 'enum', column: characters.gender },
    { key: 'bloodType', kind: 'enum', column: characters.bloodType },
    { key: 'cup', kind: 'enum', column: characters.cup },

    { key: 'score', kind: 'number', column: characters.score },
    { key: 'age', kind: 'number', column: characters.age },
    { key: 'height', kind: 'number', column: characters.height },
    { key: 'weight', kind: 'number', column: characters.weight },
    { key: 'bust', kind: 'number', column: characters.bust },
    { key: 'waist', kind: 'number', column: characters.waist },
    { key: 'hips', kind: 'number', column: characters.hips },

    { key: 'birthDate', kind: 'date', mode: 'partialDate', column: characters.birthDate },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: characters.createdAt },

    {
      key: 'games',
      kind: 'relation',
      targetEntity: 'game',
      link: {
        table: gameCharacterLinks,
        entityIdColumn: gameCharacterLinks.characterId,
        relatedIdColumn: gameCharacterLinks.gameId
      }
    },
    {
      key: 'persons',
      kind: 'relation',
      targetEntity: 'person',
      link: {
        table: characterPersonLinks,
        entityIdColumn: characterPersonLinks.characterId,
        relatedIdColumn: characterPersonLinks.personId
      }
    },
    {
      key: 'tags',
      kind: 'relation',
      targetEntity: 'tag',
      link: {
        table: characterTagLinks,
        entityIdColumn: characterTagLinks.characterId,
        relatedIdColumn: characterTagLinks.tagId
      }
    },
    {
      key: 'collections',
      kind: 'relation',
      targetEntity: 'collection',
      link: {
        table: collectionCharacterLinks,
        entityIdColumn: collectionCharacterLinks.characterId,
        relatedIdColumn: collectionCharacterLinks.collectionId
      }
    }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: characters.name },
      { key: 'sortName', kind: 'column', column: characters.sortName },
      { key: 'originalName', kind: 'column', column: characters.originalName },
      { key: 'createdAt', kind: 'column', column: characters.createdAt },
      { key: 'score', kind: 'column', column: characters.score },
      { key: 'age', kind: 'column', column: characters.age },
      { key: 'height', kind: 'column', column: characters.height },
      { key: 'birthDate', kind: 'partialDate', column: characters.birthDate }
    ]
  }
})
