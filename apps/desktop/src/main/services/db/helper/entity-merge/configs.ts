import {
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
  collectionCompanyLinks,
  collectionGameLinks,
  collectionMovieLinks,
  collectionPersonLinks,
  collections,
  collectionTvLinks,
  companies,
  companyTagLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  games,
  gameTagLinks,
  movieCharacterLinks,
  movieCompanyLinks,
  moviePersonLinks,
  movies,
  movieTagLinks,
  persons,
  personTagLinks,
  tags,
  tvCharacterLinks,
  tvCompanyLinks,
  tvPersonLinks,
  tvs,
  tvTagLinks
} from '@shared/db'
import type { AllEntityType } from '@shared/common'
import {
  animeExternalIdLink,
  characterExternalIdLink,
  companyExternalIdLink,
  gameExternalIdLink,
  movieExternalIdLink,
  personExternalIdLink,
  tvExternalIdLink
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

const tvExternalIdConfig: ExternalIdMergeConfig = {
  link: tvExternalIdLink,
  entityIdField: 'tvId',
  orderField: 'orderInTv'
}

const movieExternalIdConfig: ExternalIdMergeConfig = {
  link: movieExternalIdLink,
  entityIdField: 'movieId',
  orderField: 'orderInMovie'
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
  tv: {
    entityType: 'tv',
    table: tvs,
    idColumn: tvs.id,
    externalIds: tvExternalIdConfig,
    relations: [
      relation({
        table: tvPersonLinks,
        mergeField: 'tvId',
        mergeColumn: tvPersonLinks.tvId,
        uniqueKeyFields: ['tvId', 'personId', 'role'],
        orderField: 'orderInTv',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: tvCompanyLinks,
        mergeField: 'tvId',
        mergeColumn: tvCompanyLinks.tvId,
        uniqueKeyFields: ['tvId', 'companyId', 'role'],
        orderField: 'orderInTv',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: tvCharacterLinks,
        mergeField: 'tvId',
        mergeColumn: tvCharacterLinks.tvId,
        uniqueKeyFields: ['tvId', 'characterId', 'role'],
        orderField: 'orderInTv',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: tvTagLinks,
        mergeField: 'tvId',
        mergeColumn: tvTagLinks.tvId,
        uniqueKeyFields: ['tvId', 'tagId'],
        orderField: 'orderInTv',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: collectionTvLinks,
        mergeField: 'tvId',
        mergeColumn: collectionTvLinks.tvId,
        uniqueKeyFields: ['collectionId', 'tvId'],
        noteField: 'note'
      })
    ]
  },
  movie: {
    entityType: 'movie',
    table: movies,
    idColumn: movies.id,
    externalIds: movieExternalIdConfig,
    relations: [
      relation({
        table: moviePersonLinks,
        mergeField: 'movieId',
        mergeColumn: moviePersonLinks.movieId,
        uniqueKeyFields: ['movieId', 'personId', 'role'],
        orderField: 'orderInMovie',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: movieCompanyLinks,
        mergeField: 'movieId',
        mergeColumn: movieCompanyLinks.movieId,
        uniqueKeyFields: ['movieId', 'companyId', 'role'],
        orderField: 'orderInMovie',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: movieCharacterLinks,
        mergeField: 'movieId',
        mergeColumn: movieCharacterLinks.movieId,
        uniqueKeyFields: ['movieId', 'characterId', 'role'],
        orderField: 'orderInMovie',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: movieTagLinks,
        mergeField: 'movieId',
        mergeColumn: movieTagLinks.movieId,
        uniqueKeyFields: ['movieId', 'tagId'],
        orderField: 'orderInMovie',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: collectionMovieLinks,
        mergeField: 'movieId',
        mergeColumn: collectionMovieLinks.movieId,
        uniqueKeyFields: ['collectionId', 'movieId'],
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
        table: tvCharacterLinks,
        mergeField: 'characterId',
        mergeColumn: tvCharacterLinks.characterId,
        uniqueKeyFields: ['tvId', 'characterId', 'role'],
        orderField: 'orderInCharacter',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: movieCharacterLinks,
        mergeField: 'characterId',
        mergeColumn: movieCharacterLinks.characterId,
        uniqueKeyFields: ['movieId', 'characterId', 'role'],
        orderField: 'orderInCharacter',
        spoilerField: 'isSpoiler',
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
        table: tvPersonLinks,
        mergeField: 'personId',
        mergeColumn: tvPersonLinks.personId,
        uniqueKeyFields: ['tvId', 'personId', 'role'],
        orderField: 'orderInPerson',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: moviePersonLinks,
        mergeField: 'personId',
        mergeColumn: moviePersonLinks.personId,
        uniqueKeyFields: ['movieId', 'personId', 'role'],
        orderField: 'orderInPerson',
        spoilerField: 'isSpoiler',
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
        table: tvCompanyLinks,
        mergeField: 'companyId',
        mergeColumn: tvCompanyLinks.companyId,
        uniqueKeyFields: ['tvId', 'companyId', 'role'],
        orderField: 'orderInCompany',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: movieCompanyLinks,
        mergeField: 'companyId',
        mergeColumn: movieCompanyLinks.companyId,
        uniqueKeyFields: ['movieId', 'companyId', 'role'],
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
        table: collectionTvLinks,
        mergeField: 'collectionId',
        mergeColumn: collectionTvLinks.collectionId,
        uniqueKeyFields: ['collectionId', 'tvId'],
        orderField: 'orderInCollection',
        noteField: 'note'
      }),
      relation({
        table: collectionMovieLinks,
        mergeField: 'collectionId',
        mergeColumn: collectionMovieLinks.collectionId,
        uniqueKeyFields: ['collectionId', 'movieId'],
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
        table: tvTagLinks,
        mergeField: 'tagId',
        mergeColumn: tvTagLinks.tagId,
        uniqueKeyFields: ['tvId', 'tagId'],
        orderField: 'orderInTag',
        spoilerField: 'isSpoiler',
        noteField: 'note'
      }),
      relation({
        table: movieTagLinks,
        mergeField: 'tagId',
        mergeColumn: movieTagLinks.tagId,
        uniqueKeyFields: ['movieId', 'tagId'],
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
