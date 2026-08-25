import {
  animeCastLinks,
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  animes,
  animeTagLinks,
  characters,
  characterPersonLinks,
  characterTagLinks,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionComicLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionNovelLinks,
  collectionPersonLinks,
  collections,
  comicCharacterLinks,
  comicCompanyLinks,
  comicPersonLinks,
  comics,
  comicTagLinks,
  companies,
  companyTagLinks,
  gameCastLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  games,
  gameTagLinks,
  novelCharacterLinks,
  novelCompanyLinks,
  novelPersonLinks,
  novels,
  novelTagLinks,
  persons,
  personTagLinks,
  tags
} from '@shared/db'
import type { AllEntityType } from '@shared/common'
import {
  animeExternalIdLink,
  characterExternalIdLink,
  comicExternalIdLink,
  companyExternalIdLink,
  gameExternalIdLink,
  novelExternalIdLink,
  personExternalIdLink
} from '../external-id'
import type { EntityMergeConfig, ExternalIdMergeConfig, RelationMergeConfig } from './types'

const gameExternalIdConfig: ExternalIdMergeConfig = {
  link: gameExternalIdLink,
  entityIdField: 'gameId',
  orderField: 'orderInGame'
}

const animeExternalIdConfig: ExternalIdMergeConfig = {
  link: animeExternalIdLink,
  entityIdField: 'animeId',
  orderField: 'orderInAnime'
}

const comicExternalIdConfig: ExternalIdMergeConfig = {
  link: comicExternalIdLink,
  entityIdField: 'comicId',
  orderField: 'orderInComic'
}

const novelExternalIdConfig: ExternalIdMergeConfig = {
  link: novelExternalIdLink,
  entityIdField: 'novelId',
  orderField: 'orderInNovel'
}

const personExternalIdConfig: ExternalIdMergeConfig = {
  link: personExternalIdLink,
  entityIdField: 'personId',
  orderField: 'orderInPerson'
}

const companyExternalIdConfig: ExternalIdMergeConfig = {
  link: companyExternalIdLink,
  entityIdField: 'companyId',
  orderField: 'orderInCompany'
}

const characterExternalIdConfig: ExternalIdMergeConfig = {
  link: characterExternalIdLink,
  entityIdField: 'characterId',
  orderField: 'orderInCharacter'
}

function relation(config: RelationMergeConfig): RelationMergeConfig {
  return config
}

export const ENTITY_MERGE_CONFIGS: Record<AllEntityType, EntityMergeConfig> = {
  game: {
    entityType: 'game',
    table: games,
    idColumn: games.id,
    externalIds: gameExternalIdConfig,
    relations: [
      relation({
        table: gamePersonLinks,
        mergeField: 'gameId',
        mergeColumn: gamePersonLinks.gameId,
        uniqueKeyFields: ['gameId', 'personId', 'role'],
        orderField: 'orderInGame',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: gameCompanyLinks,
        mergeField: 'gameId',
        mergeColumn: gameCompanyLinks.gameId,
        uniqueKeyFields: ['gameId', 'companyId', 'role'],
        orderField: 'orderInGame',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: gameCharacterLinks,
        mergeField: 'gameId',
        mergeColumn: gameCharacterLinks.gameId,
        uniqueKeyFields: ['gameId', 'characterId', 'role'],
        orderField: 'orderInGame',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: gameCastLinks,
        mergeField: 'gameId',
        mergeColumn: gameCastLinks.gameId,
        uniqueKeyFields: ['gameId', 'characterId', 'personId'],
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
  anime: {
    entityType: 'anime',
    table: animes,
    idColumn: animes.id,
    externalIds: animeExternalIdConfig,
    relations: [
      relation({
        table: animePersonLinks,
        mergeField: 'animeId',
        mergeColumn: animePersonLinks.animeId,
        uniqueKeyFields: ['animeId', 'personId', 'role'],
        orderField: 'orderInAnime',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: animeCompanyLinks,
        mergeField: 'animeId',
        mergeColumn: animeCompanyLinks.animeId,
        uniqueKeyFields: ['animeId', 'companyId', 'role'],
        orderField: 'orderInAnime',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: animeCharacterLinks,
        mergeField: 'animeId',
        mergeColumn: animeCharacterLinks.animeId,
        uniqueKeyFields: ['animeId', 'characterId', 'role'],
        orderField: 'orderInAnime',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: animeCastLinks,
        mergeField: 'animeId',
        mergeColumn: animeCastLinks.animeId,
        uniqueKeyFields: ['animeId', 'characterId', 'personId'],
        noteField: 'note'
      }),
      relation({
        table: animeTagLinks,
        mergeField: 'animeId',
        mergeColumn: animeTagLinks.animeId,
        uniqueKeyFields: ['animeId', 'tagId'],
        orderField: 'orderInAnime',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: collectionAnimeLinks,
        mergeField: 'animeId',
        mergeColumn: collectionAnimeLinks.animeId,
        uniqueKeyFields: ['collectionId', 'animeId'],
        noteField: 'note'
      })
    ]
  },
  comic: {
    entityType: 'comic',
    table: comics,
    idColumn: comics.id,
    externalIds: comicExternalIdConfig,
    relations: [
      relation({
        table: comicPersonLinks,
        mergeField: 'comicId',
        mergeColumn: comicPersonLinks.comicId,
        uniqueKeyFields: ['comicId', 'personId', 'role'],
        orderField: 'orderInComic',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: comicCompanyLinks,
        mergeField: 'comicId',
        mergeColumn: comicCompanyLinks.comicId,
        uniqueKeyFields: ['comicId', 'companyId', 'role'],
        orderField: 'orderInComic',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: comicCharacterLinks,
        mergeField: 'comicId',
        mergeColumn: comicCharacterLinks.comicId,
        uniqueKeyFields: ['comicId', 'characterId', 'role'],
        orderField: 'orderInComic',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: comicTagLinks,
        mergeField: 'comicId',
        mergeColumn: comicTagLinks.comicId,
        uniqueKeyFields: ['comicId', 'tagId'],
        orderField: 'orderInComic',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: collectionComicLinks,
        mergeField: 'comicId',
        mergeColumn: collectionComicLinks.comicId,
        uniqueKeyFields: ['collectionId', 'comicId'],
        noteField: 'note'
      })
    ]
  },
  novel: {
    entityType: 'novel',
    table: novels,
    idColumn: novels.id,
    externalIds: novelExternalIdConfig,
    relations: [
      relation({
        table: novelPersonLinks,
        mergeField: 'novelId',
        mergeColumn: novelPersonLinks.novelId,
        uniqueKeyFields: ['novelId', 'personId', 'role'],
        orderField: 'orderInNovel',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: novelCompanyLinks,
        mergeField: 'novelId',
        mergeColumn: novelCompanyLinks.novelId,
        uniqueKeyFields: ['novelId', 'companyId', 'role'],
        orderField: 'orderInNovel',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: novelCharacterLinks,
        mergeField: 'novelId',
        mergeColumn: novelCharacterLinks.novelId,
        uniqueKeyFields: ['novelId', 'characterId', 'role'],
        orderField: 'orderInNovel',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: novelTagLinks,
        mergeField: 'novelId',
        mergeColumn: novelTagLinks.novelId,
        uniqueKeyFields: ['novelId', 'tagId'],
        orderField: 'orderInNovel',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: collectionNovelLinks,
        mergeField: 'novelId',
        mergeColumn: collectionNovelLinks.novelId,
        uniqueKeyFields: ['collectionId', 'novelId'],
        noteField: 'note'
      })
    ]
  },
  character: {
    entityType: 'character',
    table: characters,
    idColumn: characters.id,
    externalIds: characterExternalIdConfig,
    relations: [
      relation({
        table: gameCharacterLinks,
        mergeField: 'characterId',
        mergeColumn: gameCharacterLinks.characterId,
        uniqueKeyFields: ['gameId', 'characterId', 'role'],
        orderField: 'orderInCharacter',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: animeCharacterLinks,
        mergeField: 'characterId',
        mergeColumn: animeCharacterLinks.characterId,
        uniqueKeyFields: ['animeId', 'characterId', 'role'],
        orderField: 'orderInCharacter',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: comicCharacterLinks,
        mergeField: 'characterId',
        mergeColumn: comicCharacterLinks.characterId,
        uniqueKeyFields: ['comicId', 'characterId', 'role'],
        orderField: 'orderInCharacter',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: novelCharacterLinks,
        mergeField: 'characterId',
        mergeColumn: novelCharacterLinks.characterId,
        uniqueKeyFields: ['novelId', 'characterId', 'role'],
        orderField: 'orderInCharacter',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: gameCastLinks,
        mergeField: 'characterId',
        mergeColumn: gameCastLinks.characterId,
        uniqueKeyFields: ['gameId', 'characterId', 'personId'],
        noteField: 'note'
      }),
      relation({
        table: animeCastLinks,
        mergeField: 'characterId',
        mergeColumn: animeCastLinks.characterId,
        uniqueKeyFields: ['animeId', 'characterId', 'personId'],
        noteField: 'note'
      }),
      relation({
        table: characterPersonLinks,
        mergeField: 'characterId',
        mergeColumn: characterPersonLinks.characterId,
        uniqueKeyFields: ['characterId', 'personId', 'role'],
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
    externalIds: personExternalIdConfig,
    relations: [
      relation({
        table: gamePersonLinks,
        mergeField: 'personId',
        mergeColumn: gamePersonLinks.personId,
        uniqueKeyFields: ['gameId', 'personId', 'role'],
        orderField: 'orderInPerson',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: animePersonLinks,
        mergeField: 'personId',
        mergeColumn: animePersonLinks.personId,
        uniqueKeyFields: ['animeId', 'personId', 'role'],
        orderField: 'orderInPerson',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: comicPersonLinks,
        mergeField: 'personId',
        mergeColumn: comicPersonLinks.personId,
        uniqueKeyFields: ['comicId', 'personId', 'role'],
        orderField: 'orderInPerson',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: novelPersonLinks,
        mergeField: 'personId',
        mergeColumn: novelPersonLinks.personId,
        uniqueKeyFields: ['novelId', 'personId', 'role'],
        orderField: 'orderInPerson',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: gameCastLinks,
        mergeField: 'personId',
        mergeColumn: gameCastLinks.personId,
        uniqueKeyFields: ['gameId', 'characterId', 'personId'],
        noteField: 'note'
      }),
      relation({
        table: animeCastLinks,
        mergeField: 'personId',
        mergeColumn: animeCastLinks.personId,
        uniqueKeyFields: ['animeId', 'characterId', 'personId'],
        noteField: 'note'
      }),
      relation({
        table: characterPersonLinks,
        mergeField: 'personId',
        mergeColumn: characterPersonLinks.personId,
        uniqueKeyFields: ['characterId', 'personId', 'role'],
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
    externalIds: companyExternalIdConfig,
    relations: [
      relation({
        table: gameCompanyLinks,
        mergeField: 'companyId',
        mergeColumn: gameCompanyLinks.companyId,
        uniqueKeyFields: ['gameId', 'companyId', 'role'],
        orderField: 'orderInCompany',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: animeCompanyLinks,
        mergeField: 'companyId',
        mergeColumn: animeCompanyLinks.companyId,
        uniqueKeyFields: ['animeId', 'companyId', 'role'],
        orderField: 'orderInCompany',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: comicCompanyLinks,
        mergeField: 'companyId',
        mergeColumn: comicCompanyLinks.companyId,
        uniqueKeyFields: ['comicId', 'companyId', 'role'],
        orderField: 'orderInCompany',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: novelCompanyLinks,
        mergeField: 'companyId',
        mergeColumn: novelCompanyLinks.companyId,
        uniqueKeyFields: ['novelId', 'companyId', 'role'],
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
        table: collectionAnimeLinks,
        mergeField: 'collectionId',
        mergeColumn: collectionAnimeLinks.collectionId,
        uniqueKeyFields: ['collectionId', 'animeId'],
        orderField: 'orderInCollection',
        noteField: 'note'
      }),
      relation({
        table: collectionComicLinks,
        mergeField: 'collectionId',
        mergeColumn: collectionComicLinks.collectionId,
        uniqueKeyFields: ['collectionId', 'comicId'],
        orderField: 'orderInCollection',
        noteField: 'note'
      }),
      relation({
        table: collectionNovelLinks,
        mergeField: 'collectionId',
        mergeColumn: collectionNovelLinks.collectionId,
        uniqueKeyFields: ['collectionId', 'novelId'],
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
        table: animeTagLinks,
        mergeField: 'tagId',
        mergeColumn: animeTagLinks.tagId,
        uniqueKeyFields: ['animeId', 'tagId'],
        orderField: 'orderInTag',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: comicTagLinks,
        mergeField: 'tagId',
        mergeColumn: comicTagLinks.tagId,
        uniqueKeyFields: ['comicId', 'tagId'],
        orderField: 'orderInTag',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: novelTagLinks,
        mergeField: 'tagId',
        mergeColumn: novelTagLinks.tagId,
        uniqueKeyFields: ['novelId', 'tagId'],
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
