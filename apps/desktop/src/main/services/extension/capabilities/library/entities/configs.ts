import type {
  LibraryAnime,
  LibraryAnimeCreateInput,
  LibraryAnimePatch,
  LibraryAnimeQuery,
  LibraryCharacter,
  LibraryCharacterCreateInput,
  LibraryCharacterPatch,
  LibraryCharacterQuery,
  LibraryCollection,
  LibraryCollectionCreateInput,
  LibraryCollectionPatch,
  LibraryCollectionQuery,
  LibraryComic,
  LibraryComicCreateInput,
  LibraryComicPatch,
  LibraryComicQuery,
  LibraryCompany,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryCompanyQuery,
  LibraryGame,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGameQuery,
  LibraryNovel,
  LibraryNovelCreateInput,
  LibraryNovelPatch,
  LibraryNovelQuery,
  LibraryPerson,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryPersonQuery,
  LibraryTag,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTagQuery
} from '@kisaki3/extension-api'
import { eq, sql } from 'drizzle-orm'
import {
  animeExternalIds,
  animes,
  characterExternalIds,
  characters,
  collections,
  comicExternalIds,
  comics,
  companies,
  companyExternalIds,
  gameExternalIds,
  games,
  novelExternalIds,
  novels,
  personExternalIds,
  persons,
  tags
} from '@shared/db'
import {
  animeFilterQuerySpec,
  characterFilterQuerySpec,
  collectionFilterQuerySpec,
  comicFilterQuerySpec,
  companyFilterQuerySpec,
  gameFilterQuerySpec,
  novelFilterQuerySpec,
  personFilterQuerySpec,
  tagFilterQuerySpec
} from '@shared/filter'
import {
  animeSearchQuerySpec,
  characterSearchQuerySpec,
  collectionSearchQuerySpec,
  comicSearchQuerySpec,
  companySearchQuerySpec,
  gameSearchQuerySpec,
  novelSearchQuerySpec,
  personSearchQuerySpec,
  tagSearchQuerySpec
} from '@shared/search/specs'
import { createEmptyFilter } from '@shared/filter'
import { buildRankedEntityDtoBase } from './dto'
import {
  anyOfCondition,
  conditionsFilter,
  hasAnyOfCondition,
  isCondition,
  toApiDynamicCollectionConfig,
  toDbDynamicCollectionConfig
} from './filters'
import type { EntityConfig, ExternalIdConfig } from './types'
import {
  copyReadonlyArray,
  optionalArray,
  optionalValue,
  stripUndefined,
  toNullableTimestampMs,
  toTimestampMs
} from './utils'

const GAME_EXTERNAL_IDS_CONFIG = {
  table: gameExternalIds,
  entityIdColumn: gameExternalIds.gameId,
  sourceColumn: gameExternalIds.source,
  externalIdColumn: gameExternalIds.externalId,
  orderColumn: gameExternalIds.orderInGame,
  toEntityId(row) {
    return row.gameId
  },
  toExternalId(row) {
    return { source: row.source, id: row.externalId }
  },
  buildInsertValue(entityId, externalId, order) {
    return {
      gameId: entityId,
      source: externalId.source,
      externalId: externalId.id,
      orderInGame: order
    }
  }
} satisfies ExternalIdConfig<typeof gameExternalIds>

const ANIME_EXTERNAL_IDS_CONFIG = {
  table: animeExternalIds,
  entityIdColumn: animeExternalIds.animeId,
  sourceColumn: animeExternalIds.source,
  externalIdColumn: animeExternalIds.externalId,
  orderColumn: animeExternalIds.orderInAnime,
  toEntityId(row) {
    return row.animeId
  },
  toExternalId(row) {
    return { source: row.source, id: row.externalId }
  },
  buildInsertValue(entityId, externalId, order) {
    return {
      animeId: entityId,
      source: externalId.source,
      externalId: externalId.id,
      orderInAnime: order
    }
  }
} satisfies ExternalIdConfig<typeof animeExternalIds>

const COMIC_EXTERNAL_IDS_CONFIG = {
  table: comicExternalIds,
  entityIdColumn: comicExternalIds.comicId,
  sourceColumn: comicExternalIds.source,
  externalIdColumn: comicExternalIds.externalId,
  orderColumn: comicExternalIds.orderInComic,
  toEntityId(row) {
    return row.comicId
  },
  toExternalId(row) {
    return { source: row.source, id: row.externalId }
  },
  buildInsertValue(entityId, externalId, order) {
    return {
      comicId: entityId,
      source: externalId.source,
      externalId: externalId.id,
      orderInComic: order
    }
  }
} satisfies ExternalIdConfig<typeof comicExternalIds>

const NOVEL_EXTERNAL_IDS_CONFIG = {
  table: novelExternalIds,
  entityIdColumn: novelExternalIds.novelId,
  sourceColumn: novelExternalIds.source,
  externalIdColumn: novelExternalIds.externalId,
  orderColumn: novelExternalIds.orderInNovel,
  toEntityId(row) {
    return row.novelId
  },
  toExternalId(row) {
    return { source: row.source, id: row.externalId }
  },
  buildInsertValue(entityId, externalId, order) {
    return {
      novelId: entityId,
      source: externalId.source,
      externalId: externalId.id,
      orderInNovel: order
    }
  }
} satisfies ExternalIdConfig<typeof novelExternalIds>

const PERSON_EXTERNAL_IDS_CONFIG = {
  table: personExternalIds,
  entityIdColumn: personExternalIds.personId,
  sourceColumn: personExternalIds.source,
  externalIdColumn: personExternalIds.externalId,
  orderColumn: personExternalIds.orderInPerson,
  toEntityId(row) {
    return row.personId
  },
  toExternalId(row) {
    return { source: row.source, id: row.externalId }
  },
  buildInsertValue(entityId, externalId, order) {
    return {
      personId: entityId,
      source: externalId.source,
      externalId: externalId.id,
      orderInPerson: order
    }
  }
} satisfies ExternalIdConfig<typeof personExternalIds>

const COMPANY_EXTERNAL_IDS_CONFIG = {
  table: companyExternalIds,
  entityIdColumn: companyExternalIds.companyId,
  sourceColumn: companyExternalIds.source,
  externalIdColumn: companyExternalIds.externalId,
  orderColumn: companyExternalIds.orderInCompany,
  toEntityId(row) {
    return row.companyId
  },
  toExternalId(row) {
    return { source: row.source, id: row.externalId }
  },
  buildInsertValue(entityId, externalId, order) {
    return {
      companyId: entityId,
      source: externalId.source,
      externalId: externalId.id,
      orderInCompany: order
    }
  }
} satisfies ExternalIdConfig<typeof companyExternalIds>

const CHARACTER_EXTERNAL_IDS_CONFIG = {
  table: characterExternalIds,
  entityIdColumn: characterExternalIds.characterId,
  sourceColumn: characterExternalIds.source,
  externalIdColumn: characterExternalIds.externalId,
  orderColumn: characterExternalIds.orderInCharacter,
  toEntityId(row) {
    return row.characterId
  },
  toExternalId(row) {
    return { source: row.source, id: row.externalId }
  },
  buildInsertValue(entityId, externalId, order) {
    return {
      characterId: entityId,
      source: externalId.source,
      externalId: externalId.id,
      orderInCharacter: order
    }
  }
} satisfies ExternalIdConfig<typeof characterExternalIds>

export const GAME_CONFIG = {
  table: games,
  filterSpec: gameFilterQuerySpec,
  searchSpec: gameSearchQuerySpec,
  externalIds: GAME_EXTERNAL_IDS_CONFIG,
  toFilter(query) {
    return conditionsFilter([
      isCondition('isFavorite', query?.favoritesOnly ? true : undefined),
      anyOfCondition('status', query?.statuses),
      hasAnyOfCondition('tags', query?.tagIds),
      hasAnyOfCondition('collections', query?.collectionIds)
    ])
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      coverFile: optionalValue(row.coverFile),
      backdropFile: optionalValue(row.backdropFile),
      logoFile: optionalValue(row.logoFile),
      iconFile: optionalValue(row.iconFile),
      aliases: optionalArray(row.aliases),
      releaseDate: optionalValue(row.releaseDate),
      status: row.status,
      lastActiveAt: toNullableTimestampMs(row.lastActiveAt),
      totalDuration: row.totalDuration,
      savePath: optionalValue(row.savePath),
      saveBackups: optionalArray(row.saveBackups),
      maxSaveBackups: row.maxSaveBackups,
      launcherMode: row.launcherMode,
      launcherPath: optionalValue(row.launcherPath),
      monitorMode: row.monitorMode,
      monitorPath: optionalValue(row.monitorPath),
      dirPath: optionalValue(row.dirPath),
      descriptionInlineFiles: optionalArray(row.descriptionInlineFiles)
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      createdAt: input.createdAt === undefined ? undefined : new Date(input.createdAt),
      updatedAt: input.updatedAt === undefined ? undefined : new Date(input.updatedAt),
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      coverFile: input.coverFile,
      backdropFile: input.backdropFile,
      logoFile: input.logoFile,
      iconFile: input.iconFile,
      aliases: copyReadonlyArray(input.aliases),
      releaseDate: input.releaseDate,
      status: input.status,
      lastActiveAt:
        input.lastActiveAt === undefined
          ? undefined
          : input.lastActiveAt === null
            ? null
            : new Date(input.lastActiveAt),
      totalDuration: input.totalDuration,
      savePath: input.savePath,
      saveBackups: copyReadonlyArray(input.saveBackups),
      maxSaveBackups: input.maxSaveBackups,
      launcherMode: input.launcherMode,
      launcherPath: input.launcherPath,
      monitorMode: input.monitorMode,
      monitorPath: input.monitorPath,
      dirPath: input.dirPath,
      descriptionInlineFiles: copyReadonlyArray(input.descriptionInlineFiles),
      score: input.score,
      isFavorite: input.isFavorite,
      isNsfw: input.isNsfw,
      externalSites: copyReadonlyArray(input.externalSites)
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      originalName: patch.originalName,
      sortName: patch.sortName,
      coverFile: patch.coverFile,
      backdropFile: patch.backdropFile,
      logoFile: patch.logoFile,
      iconFile: patch.iconFile,
      aliases: copyReadonlyArray(patch.aliases),
      releaseDate: patch.releaseDate,
      status: patch.status,
      savePath: patch.savePath,
      saveBackups: copyReadonlyArray(patch.saveBackups),
      maxSaveBackups: patch.maxSaveBackups,
      launcherMode: patch.launcherMode,
      launcherPath: patch.launcherPath,
      monitorMode: patch.monitorMode,
      monitorPath: patch.monitorPath,
      dirPath: patch.dirPath,
      descriptionInlineFiles: copyReadonlyArray(patch.descriptionInlineFiles),
      score: patch.score,
      isFavorite: patch.isFavorite,
      isNsfw: patch.isNsfw,
      externalSites: copyReadonlyArray(patch.externalSites),
      lastActiveAt:
        patch.lastActiveAt === undefined
          ? undefined
          : patch.lastActiveAt === null
            ? null
            : new Date(patch.lastActiveAt),
      totalDuration: patch.totalDuration
    })
  },
  buildExtraConditions(query) {
    return query?.includeNsfw ? [] : [eq(games.isNsfw, false)]
  }
} satisfies EntityConfig<
  LibraryGame,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGameQuery,
  typeof games,
  typeof gameExternalIds
>

export const ANIME_CONFIG = {
  table: animes,
  filterSpec: animeFilterQuerySpec,
  searchSpec: animeSearchQuerySpec,
  externalIds: ANIME_EXTERNAL_IDS_CONFIG,
  toFilter(query) {
    return conditionsFilter([
      isCondition('isFavorite', query?.favoritesOnly ? true : undefined),
      anyOfCondition('status', query?.statuses),
      anyOfCondition('format', query?.formats),
      hasAnyOfCondition('tags', query?.tagIds),
      hasAnyOfCondition('collections', query?.collectionIds)
    ])
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      coverFile: optionalValue(row.coverFile),
      backdropFile: optionalValue(row.backdropFile),
      logoFile: optionalValue(row.logoFile),
      aliases: optionalArray(row.aliases),
      releaseDate: optionalValue(row.releaseDate),
      status: row.status,
      format: row.format,
      totalEpisodes: row.totalEpisodes,
      lastActiveAt: toNullableTimestampMs(row.lastActiveAt),
      totalDuration: row.totalDuration,
      dirPath: optionalValue(row.dirPath),
      descriptionInlineFiles: optionalArray(row.descriptionInlineFiles)
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      createdAt: input.createdAt === undefined ? undefined : new Date(input.createdAt),
      updatedAt: input.updatedAt === undefined ? undefined : new Date(input.updatedAt),
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      coverFile: input.coverFile,
      backdropFile: input.backdropFile,
      logoFile: input.logoFile,
      aliases: copyReadonlyArray(input.aliases),
      releaseDate: input.releaseDate,
      status: input.status,
      format: input.format,
      totalEpisodes: input.totalEpisodes,
      lastActiveAt:
        input.lastActiveAt === undefined
          ? undefined
          : input.lastActiveAt === null
            ? null
            : new Date(input.lastActiveAt),
      totalDuration: input.totalDuration,
      dirPath: input.dirPath,
      descriptionInlineFiles: copyReadonlyArray(input.descriptionInlineFiles),
      score: input.score,
      isFavorite: input.isFavorite,
      isNsfw: input.isNsfw,
      externalSites: copyReadonlyArray(input.externalSites)
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      originalName: patch.originalName,
      sortName: patch.sortName,
      coverFile: patch.coverFile,
      backdropFile: patch.backdropFile,
      logoFile: patch.logoFile,
      aliases: copyReadonlyArray(patch.aliases),
      releaseDate: patch.releaseDate,
      status: patch.status,
      format: patch.format,
      totalEpisodes: patch.totalEpisodes,
      dirPath: patch.dirPath,
      descriptionInlineFiles: copyReadonlyArray(patch.descriptionInlineFiles),
      score: patch.score,
      isFavorite: patch.isFavorite,
      isNsfw: patch.isNsfw,
      externalSites: copyReadonlyArray(patch.externalSites),
      lastActiveAt:
        patch.lastActiveAt === undefined
          ? undefined
          : patch.lastActiveAt === null
            ? null
            : new Date(patch.lastActiveAt),
      totalDuration: patch.totalDuration
    })
  },
  buildExtraConditions(query) {
    return query?.includeNsfw ? [] : [eq(animes.isNsfw, false)]
  }
} satisfies EntityConfig<
  LibraryAnime,
  LibraryAnimeCreateInput,
  LibraryAnimePatch,
  LibraryAnimeQuery,
  typeof animes,
  typeof animeExternalIds
>

export const COMIC_CONFIG = {
  table: comics,
  filterSpec: comicFilterQuerySpec,
  searchSpec: comicSearchQuerySpec,
  externalIds: COMIC_EXTERNAL_IDS_CONFIG,
  toFilter(query) {
    return conditionsFilter([
      isCondition('isFavorite', query?.favoritesOnly ? true : undefined),
      anyOfCondition('status', query?.statuses),
      anyOfCondition('format', query?.formats),
      hasAnyOfCondition('tags', query?.tagIds),
      hasAnyOfCondition('collections', query?.collectionIds)
    ])
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      coverFile: optionalValue(row.coverFile),
      backdropFile: optionalValue(row.backdropFile),
      logoFile: optionalValue(row.logoFile),
      aliases: optionalArray(row.aliases),
      releaseDate: optionalValue(row.releaseDate),
      status: row.status,
      format: row.format,
      readingDirection: optionalValue(row.readingDirection),
      totalVolumes: row.totalVolumes,
      totalChapters: row.totalChapters,
      lastActiveAt: toNullableTimestampMs(row.lastActiveAt),
      totalDuration: row.totalDuration,
      dirPath: optionalValue(row.dirPath),
      descriptionInlineFiles: optionalArray(row.descriptionInlineFiles)
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      createdAt: input.createdAt === undefined ? undefined : new Date(input.createdAt),
      updatedAt: input.updatedAt === undefined ? undefined : new Date(input.updatedAt),
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      coverFile: input.coverFile,
      backdropFile: input.backdropFile,
      logoFile: input.logoFile,
      aliases: copyReadonlyArray(input.aliases),
      releaseDate: input.releaseDate,
      status: input.status,
      format: input.format,
      readingDirection: input.readingDirection,
      totalVolumes: input.totalVolumes,
      totalChapters: input.totalChapters,
      lastActiveAt:
        input.lastActiveAt === undefined
          ? undefined
          : input.lastActiveAt === null
            ? null
            : new Date(input.lastActiveAt),
      totalDuration: input.totalDuration,
      dirPath: input.dirPath,
      descriptionInlineFiles: copyReadonlyArray(input.descriptionInlineFiles),
      score: input.score,
      isFavorite: input.isFavorite,
      isNsfw: input.isNsfw,
      externalSites: copyReadonlyArray(input.externalSites)
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      originalName: patch.originalName,
      sortName: patch.sortName,
      coverFile: patch.coverFile,
      backdropFile: patch.backdropFile,
      logoFile: patch.logoFile,
      aliases: copyReadonlyArray(patch.aliases),
      releaseDate: patch.releaseDate,
      status: patch.status,
      format: patch.format,
      readingDirection: patch.readingDirection,
      totalVolumes: patch.totalVolumes,
      totalChapters: patch.totalChapters,
      dirPath: patch.dirPath,
      descriptionInlineFiles: copyReadonlyArray(patch.descriptionInlineFiles),
      score: patch.score,
      isFavorite: patch.isFavorite,
      isNsfw: patch.isNsfw,
      externalSites: copyReadonlyArray(patch.externalSites),
      lastActiveAt:
        patch.lastActiveAt === undefined
          ? undefined
          : patch.lastActiveAt === null
            ? null
            : new Date(patch.lastActiveAt),
      totalDuration: patch.totalDuration
    })
  },
  buildExtraConditions(query) {
    return query?.includeNsfw ? [] : [eq(comics.isNsfw, false)]
  }
} satisfies EntityConfig<
  LibraryComic,
  LibraryComicCreateInput,
  LibraryComicPatch,
  LibraryComicQuery,
  typeof comics,
  typeof comicExternalIds
>

export const NOVEL_CONFIG = {
  table: novels,
  filterSpec: novelFilterQuerySpec,
  searchSpec: novelSearchQuerySpec,
  externalIds: NOVEL_EXTERNAL_IDS_CONFIG,
  toFilter(query) {
    return conditionsFilter([
      isCondition('isFavorite', query?.favoritesOnly ? true : undefined),
      anyOfCondition('status', query?.statuses),
      anyOfCondition('format', query?.formats),
      hasAnyOfCondition('tags', query?.tagIds),
      hasAnyOfCondition('collections', query?.collectionIds)
    ])
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      coverFile: optionalValue(row.coverFile),
      backdropFile: optionalValue(row.backdropFile),
      logoFile: optionalValue(row.logoFile),
      aliases: optionalArray(row.aliases),
      releaseDate: optionalValue(row.releaseDate),
      status: row.status,
      format: row.format,
      totalVolumes: row.totalVolumes,
      lastActiveAt: toNullableTimestampMs(row.lastActiveAt),
      totalDuration: row.totalDuration,
      dirPath: optionalValue(row.dirPath),
      descriptionInlineFiles: optionalArray(row.descriptionInlineFiles)
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      createdAt: input.createdAt === undefined ? undefined : new Date(input.createdAt),
      updatedAt: input.updatedAt === undefined ? undefined : new Date(input.updatedAt),
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      coverFile: input.coverFile,
      backdropFile: input.backdropFile,
      logoFile: input.logoFile,
      aliases: copyReadonlyArray(input.aliases),
      releaseDate: input.releaseDate,
      status: input.status,
      format: input.format,
      totalVolumes: input.totalVolumes,
      lastActiveAt:
        input.lastActiveAt === undefined
          ? undefined
          : input.lastActiveAt === null
            ? null
            : new Date(input.lastActiveAt),
      totalDuration: input.totalDuration,
      dirPath: input.dirPath,
      descriptionInlineFiles: copyReadonlyArray(input.descriptionInlineFiles),
      score: input.score,
      isFavorite: input.isFavorite,
      isNsfw: input.isNsfw,
      externalSites: copyReadonlyArray(input.externalSites)
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      originalName: patch.originalName,
      sortName: patch.sortName,
      coverFile: patch.coverFile,
      backdropFile: patch.backdropFile,
      logoFile: patch.logoFile,
      aliases: copyReadonlyArray(patch.aliases),
      releaseDate: patch.releaseDate,
      status: patch.status,
      format: patch.format,
      totalVolumes: patch.totalVolumes,
      dirPath: patch.dirPath,
      descriptionInlineFiles: copyReadonlyArray(patch.descriptionInlineFiles),
      score: patch.score,
      isFavorite: patch.isFavorite,
      isNsfw: patch.isNsfw,
      externalSites: copyReadonlyArray(patch.externalSites),
      lastActiveAt:
        patch.lastActiveAt === undefined
          ? undefined
          : patch.lastActiveAt === null
            ? null
            : new Date(patch.lastActiveAt),
      totalDuration: patch.totalDuration
    })
  },
  buildExtraConditions(query) {
    return query?.includeNsfw ? [] : [eq(novels.isNsfw, false)]
  }
} satisfies EntityConfig<
  LibraryNovel,
  LibraryNovelCreateInput,
  LibraryNovelPatch,
  LibraryNovelQuery,
  typeof novels,
  typeof novelExternalIds
>

export const PERSON_CONFIG = {
  table: persons,
  filterSpec: personFilterQuerySpec,
  searchSpec: personSearchQuerySpec,
  externalIds: PERSON_EXTERNAL_IDS_CONFIG,
  toFilter(query) {
    return conditionsFilter([
      isCondition('isFavorite', query?.favoritesOnly ? true : undefined),
      anyOfCondition('gender', query?.genders),
      hasAnyOfCondition('tags', query?.tagIds)
    ])
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      photoFile: optionalValue(row.photoFile),
      aliases: optionalArray(row.aliases),
      birthDate: optionalValue(row.birthDate),
      deathDate: optionalValue(row.deathDate),
      gender: optionalValue(row.gender)
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      createdAt: input.createdAt === undefined ? undefined : new Date(input.createdAt),
      updatedAt: input.updatedAt === undefined ? undefined : new Date(input.updatedAt),
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      photoFile: input.photoFile,
      aliases: copyReadonlyArray(input.aliases),
      birthDate: input.birthDate,
      deathDate: input.deathDate,
      gender: input.gender,
      score: input.score,
      isFavorite: input.isFavorite,
      isNsfw: input.isNsfw,
      externalSites: copyReadonlyArray(input.externalSites)
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      originalName: patch.originalName,
      sortName: patch.sortName,
      photoFile: patch.photoFile,
      aliases: copyReadonlyArray(patch.aliases),
      birthDate: patch.birthDate,
      deathDate: patch.deathDate,
      gender: patch.gender,
      score: patch.score,
      isFavorite: patch.isFavorite,
      isNsfw: patch.isNsfw,
      externalSites: copyReadonlyArray(patch.externalSites)
    })
  },
  buildExtraConditions(query) {
    return query?.includeNsfw ? [] : [eq(persons.isNsfw, false)]
  }
} satisfies EntityConfig<
  LibraryPerson,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryPersonQuery,
  typeof persons,
  typeof personExternalIds
>

export const COMPANY_CONFIG = {
  table: companies,
  filterSpec: companyFilterQuerySpec,
  searchSpec: companySearchQuerySpec,
  externalIds: COMPANY_EXTERNAL_IDS_CONFIG,
  toFilter(query) {
    return conditionsFilter([
      isCondition('isFavorite', query?.favoritesOnly ? true : undefined),
      hasAnyOfCondition('tags', query?.tagIds)
    ])
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      foundedDate: optionalValue(row.foundedDate),
      logoFile: optionalValue(row.logoFile)
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      createdAt: input.createdAt === undefined ? undefined : new Date(input.createdAt),
      updatedAt: input.updatedAt === undefined ? undefined : new Date(input.updatedAt),
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      foundedDate: input.foundedDate,
      logoFile: input.logoFile,
      score: input.score,
      isFavorite: input.isFavorite,
      isNsfw: input.isNsfw,
      externalSites: copyReadonlyArray(input.externalSites)
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      originalName: patch.originalName,
      sortName: patch.sortName,
      foundedDate: patch.foundedDate,
      logoFile: patch.logoFile,
      score: patch.score,
      isFavorite: patch.isFavorite,
      isNsfw: patch.isNsfw,
      externalSites: copyReadonlyArray(patch.externalSites)
    })
  },
  buildExtraConditions(query) {
    return query?.includeNsfw ? [] : [eq(companies.isNsfw, false)]
  }
} satisfies EntityConfig<
  LibraryCompany,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryCompanyQuery,
  typeof companies,
  typeof companyExternalIds
>

export const CHARACTER_CONFIG = {
  table: characters,
  filterSpec: characterFilterQuerySpec,
  searchSpec: characterSearchQuerySpec,
  externalIds: CHARACTER_EXTERNAL_IDS_CONFIG,
  toFilter(query) {
    return conditionsFilter([
      isCondition('isFavorite', query?.favoritesOnly ? true : undefined),
      anyOfCondition('gender', query?.genders),
      hasAnyOfCondition('tags', query?.tagIds)
    ])
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      photoFile: optionalValue(row.photoFile),
      aliases: optionalArray(row.aliases),
      birthDate: optionalValue(row.birthDate),
      gender: optionalValue(row.gender),
      bloodType: optionalValue(row.bloodType),
      height: optionalValue(row.height),
      weight: optionalValue(row.weight),
      bust: optionalValue(row.bust),
      waist: optionalValue(row.waist),
      hips: optionalValue(row.hips),
      cup: optionalValue(row.cup),
      age: optionalValue(row.age)
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      createdAt: input.createdAt === undefined ? undefined : new Date(input.createdAt),
      updatedAt: input.updatedAt === undefined ? undefined : new Date(input.updatedAt),
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      photoFile: input.photoFile,
      aliases: copyReadonlyArray(input.aliases),
      birthDate: input.birthDate,
      gender: input.gender,
      bloodType: input.bloodType,
      height: input.height,
      weight: input.weight,
      bust: input.bust,
      waist: input.waist,
      hips: input.hips,
      cup: input.cup,
      age: input.age,
      score: input.score,
      isFavorite: input.isFavorite,
      isNsfw: input.isNsfw,
      externalSites: copyReadonlyArray(input.externalSites)
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      originalName: patch.originalName,
      sortName: patch.sortName,
      photoFile: patch.photoFile,
      aliases: copyReadonlyArray(patch.aliases),
      birthDate: patch.birthDate,
      gender: patch.gender,
      bloodType: patch.bloodType,
      height: patch.height,
      weight: patch.weight,
      bust: patch.bust,
      waist: patch.waist,
      hips: patch.hips,
      cup: patch.cup,
      age: patch.age,
      score: patch.score,
      isFavorite: patch.isFavorite,
      isNsfw: patch.isNsfw,
      externalSites: copyReadonlyArray(patch.externalSites)
    })
  },
  buildExtraConditions(query) {
    return query?.includeNsfw ? [] : [eq(characters.isNsfw, false)]
  }
} satisfies EntityConfig<
  LibraryCharacter,
  LibraryCharacterCreateInput,
  LibraryCharacterPatch,
  LibraryCharacterQuery,
  typeof characters,
  typeof characterExternalIds
>

export const COLLECTION_CONFIG = {
  table: collections,
  filterSpec: collectionFilterQuerySpec,
  searchSpec: collectionSearchQuerySpec,
  toFilter() {
    return createEmptyFilter()
  },
  toDto(row) {
    return {
      id: row.id,
      createdAt: toTimestampMs(row.createdAt),
      updatedAt: toTimestampMs(row.updatedAt),
      name: row.name,
      description: optionalValue(row.description),
      coverFile: optionalValue(row.coverFile),
      isNsfw: row.isNsfw,
      order: row.order,
      isDynamic: row.isDynamic,
      dynamicConfig: toApiDynamicCollectionConfig(row.dynamicConfig)
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      createdAt: input.createdAt === undefined ? undefined : new Date(input.createdAt),
      updatedAt: input.updatedAt === undefined ? undefined : new Date(input.updatedAt),
      name: input.name,
      description: input.description,
      coverFile: input.coverFile,
      isNsfw: input.isNsfw,
      order: input.order,
      isDynamic: input.isDynamic,
      dynamicConfig: toDbDynamicCollectionConfig(input.dynamicConfig)
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      coverFile: patch.coverFile,
      isNsfw: patch.isNsfw,
      order: patch.order,
      isDynamic: patch.isDynamic,
      dynamicConfig: toDbDynamicCollectionConfig(patch.dynamicConfig)
    })
  },
  buildExtraConditions(query) {
    const includeDynamic = query?.includeDynamic ?? true
    const includeStatic = query?.includeStatic ?? true

    if (!includeDynamic && !includeStatic) {
      return [sql`1 = 0`]
    }
    if (!includeDynamic) {
      return [eq(collections.isDynamic, false)]
    }
    if (!includeStatic) {
      return [eq(collections.isDynamic, true)]
    }
    return []
  }
} satisfies EntityConfig<
  LibraryCollection,
  LibraryCollectionCreateInput,
  LibraryCollectionPatch,
  LibraryCollectionQuery,
  typeof collections
>

export const TAG_CONFIG = {
  table: tags,
  filterSpec: tagFilterQuerySpec,
  searchSpec: tagSearchQuerySpec,
  toFilter() {
    return createEmptyFilter()
  },
  toDto(row) {
    return {
      id: row.id,
      createdAt: toTimestampMs(row.createdAt),
      updatedAt: toTimestampMs(row.updatedAt),
      name: row.name,
      description: optionalValue(row.description),
      isNsfw: row.isNsfw
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      createdAt: input.createdAt === undefined ? undefined : new Date(input.createdAt),
      updatedAt: input.updatedAt === undefined ? undefined : new Date(input.updatedAt),
      name: input.name,
      description: input.description,
      isNsfw: input.isNsfw
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      isNsfw: patch.isNsfw
    })
  },
  buildExtraConditions(query) {
    return query?.includeNsfw ? [] : [eq(tags.isNsfw, false)]
  }
} satisfies EntityConfig<
  LibraryTag,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTagQuery,
  typeof tags
>
