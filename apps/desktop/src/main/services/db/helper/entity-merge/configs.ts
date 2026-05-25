import {
  characters,
  characterExternalIds,
  characterPersonLinks,
  characterTagLinks,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionPersonLinks,
  collections,
  companies,
  companyExternalIds,
  companyTagLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gameExternalIds,
  gamePersonLinks,
  games,
  gameTagLinks,
  personExternalIds,
  persons,
  personTagLinks,
  tags
} from '@shared/db'
import type { AllEntityType } from '@shared/common'
import type { EntityMergeConfig, ExternalIdMergeConfig, RelationMergeConfig } from './types'

const gameExternalIdConfig: ExternalIdMergeConfig = {
  table: gameExternalIds,
  entityIdField: 'gameId',
  entityIdColumn: gameExternalIds.gameId,
  orderField: 'orderInGame',
  sourceColumn: gameExternalIds.source,
  externalIdColumn: gameExternalIds.externalId
}

const personExternalIdConfig: ExternalIdMergeConfig = {
  table: personExternalIds,
  entityIdField: 'personId',
  entityIdColumn: personExternalIds.personId,
  orderField: 'orderInPerson',
  sourceColumn: personExternalIds.source,
  externalIdColumn: personExternalIds.externalId
}

const companyExternalIdConfig: ExternalIdMergeConfig = {
  table: companyExternalIds,
  entityIdField: 'companyId',
  entityIdColumn: companyExternalIds.companyId,
  orderField: 'orderInCompany',
  sourceColumn: companyExternalIds.source,
  externalIdColumn: companyExternalIds.externalId
}

const characterExternalIdConfig: ExternalIdMergeConfig = {
  table: characterExternalIds,
  entityIdField: 'characterId',
  entityIdColumn: characterExternalIds.characterId,
  orderField: 'orderInCharacter',
  sourceColumn: characterExternalIds.source,
  externalIdColumn: characterExternalIds.externalId
}

function relation(config: RelationMergeConfig): RelationMergeConfig {
  return config
}

export const ENTITY_MERGE_CONFIGS: Record<AllEntityType, EntityMergeConfig> = {
  game: {
    entityType: 'game',
    table: games,
    idColumn: games.id,
    tableName: 'games',
    externalIds: gameExternalIdConfig,
    relations: [
      relation({
        table: gamePersonLinks,
        mergeField: 'gameId',
        mergeColumn: gamePersonLinks.gameId,
        uniqueKeyFields: ['gameId', 'personId', 'type'],
        orderField: 'orderInGame',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: gameCompanyLinks,
        mergeField: 'gameId',
        mergeColumn: gameCompanyLinks.gameId,
        uniqueKeyFields: ['gameId', 'companyId', 'type'],
        orderField: 'orderInGame',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: gameCharacterLinks,
        mergeField: 'gameId',
        mergeColumn: gameCharacterLinks.gameId,
        uniqueKeyFields: ['gameId', 'characterId', 'type'],
        orderField: 'orderInGame',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: gameTagLinks,
        mergeField: 'gameId',
        mergeColumn: gameTagLinks.gameId,
        uniqueKeyFields: ['gameId', 'tagId'],
        orderField: 'orderInGame',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: collectionGameLinks,
        mergeField: 'gameId',
        mergeColumn: collectionGameLinks.gameId,
        uniqueKeyFields: ['collectionId', 'gameId'],
        noteField: 'note'
      })
    ]
  },
  character: {
    entityType: 'character',
    table: characters,
    idColumn: characters.id,
    tableName: 'characters',
    externalIds: characterExternalIdConfig,
    relations: [
      relation({
        table: gameCharacterLinks,
        mergeField: 'characterId',
        mergeColumn: gameCharacterLinks.characterId,
        uniqueKeyFields: ['gameId', 'characterId', 'type'],
        orderField: 'orderInCharacter',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: characterPersonLinks,
        mergeField: 'characterId',
        mergeColumn: characterPersonLinks.characterId,
        uniqueKeyFields: ['characterId', 'personId', 'type'],
        orderField: 'orderInCharacter',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: collectionCharacterLinks,
        mergeField: 'characterId',
        mergeColumn: collectionCharacterLinks.characterId,
        uniqueKeyFields: ['collectionId', 'characterId'],
        noteField: 'note'
      }),
      relation({
        table: characterTagLinks,
        mergeField: 'characterId',
        mergeColumn: characterTagLinks.characterId,
        uniqueKeyFields: ['characterId', 'tagId'],
        orderField: 'orderInCharacter',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      })
    ]
  },
  person: {
    entityType: 'person',
    table: persons,
    idColumn: persons.id,
    tableName: 'persons',
    externalIds: personExternalIdConfig,
    relations: [
      relation({
        table: gamePersonLinks,
        mergeField: 'personId',
        mergeColumn: gamePersonLinks.personId,
        uniqueKeyFields: ['gameId', 'personId', 'type'],
        orderField: 'orderInPerson',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: characterPersonLinks,
        mergeField: 'personId',
        mergeColumn: characterPersonLinks.personId,
        uniqueKeyFields: ['characterId', 'personId', 'type'],
        orderField: 'orderInPerson',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: collectionPersonLinks,
        mergeField: 'personId',
        mergeColumn: collectionPersonLinks.personId,
        uniqueKeyFields: ['collectionId', 'personId'],
        noteField: 'note'
      }),
      relation({
        table: personTagLinks,
        mergeField: 'personId',
        mergeColumn: personTagLinks.personId,
        uniqueKeyFields: ['personId', 'tagId'],
        orderField: 'orderInPerson',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      })
    ]
  },
  company: {
    entityType: 'company',
    table: companies,
    idColumn: companies.id,
    tableName: 'companies',
    externalIds: companyExternalIdConfig,
    relations: [
      relation({
        table: gameCompanyLinks,
        mergeField: 'companyId',
        mergeColumn: gameCompanyLinks.companyId,
        uniqueKeyFields: ['gameId', 'companyId', 'type'],
        orderField: 'orderInCompany',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: collectionCompanyLinks,
        mergeField: 'companyId',
        mergeColumn: collectionCompanyLinks.companyId,
        uniqueKeyFields: ['collectionId', 'companyId'],
        noteField: 'note'
      }),
      relation({
        table: companyTagLinks,
        mergeField: 'companyId',
        mergeColumn: companyTagLinks.companyId,
        uniqueKeyFields: ['companyId', 'tagId'],
        orderField: 'orderInCompany',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      })
    ]
  },
  collection: {
    entityType: 'collection',
    table: collections,
    idColumn: collections.id,
    tableName: 'collections',
    relations: [
      relation({
        table: collectionGameLinks,
        mergeField: 'collectionId',
        mergeColumn: collectionGameLinks.collectionId,
        uniqueKeyFields: ['collectionId', 'gameId'],
        orderField: 'orderInCollection',
        noteField: 'note'
      }),
      relation({
        table: collectionCharacterLinks,
        mergeField: 'collectionId',
        mergeColumn: collectionCharacterLinks.collectionId,
        uniqueKeyFields: ['collectionId', 'characterId'],
        orderField: 'orderInCollection',
        noteField: 'note'
      }),
      relation({
        table: collectionPersonLinks,
        mergeField: 'collectionId',
        mergeColumn: collectionPersonLinks.collectionId,
        uniqueKeyFields: ['collectionId', 'personId'],
        orderField: 'orderInCollection',
        noteField: 'note'
      }),
      relation({
        table: collectionCompanyLinks,
        mergeField: 'collectionId',
        mergeColumn: collectionCompanyLinks.collectionId,
        uniqueKeyFields: ['collectionId', 'companyId'],
        orderField: 'orderInCollection',
        noteField: 'note'
      })
    ]
  },
  tag: {
    entityType: 'tag',
    table: tags,
    idColumn: tags.id,
    tableName: 'tags',
    relations: [
      relation({
        table: gameTagLinks,
        mergeField: 'tagId',
        mergeColumn: gameTagLinks.tagId,
        uniqueKeyFields: ['gameId', 'tagId'],
        orderField: 'orderInTag',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: characterTagLinks,
        mergeField: 'tagId',
        mergeColumn: characterTagLinks.tagId,
        uniqueKeyFields: ['characterId', 'tagId'],
        orderField: 'orderInTag',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: personTagLinks,
        mergeField: 'tagId',
        mergeColumn: personTagLinks.tagId,
        uniqueKeyFields: ['personId', 'tagId'],
        orderField: 'orderInTag',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: companyTagLinks,
        mergeField: 'tagId',
        mergeColumn: companyTagLinks.tagId,
        uniqueKeyFields: ['companyId', 'tagId'],
        orderField: 'orderInTag',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      })
    ]
  }
}
