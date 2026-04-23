import type {
  LibraryCharacter,
  LibraryCharacterCreateInput,
  LibraryCharacterPatch,
  LibraryCharacterQuery,
  LibraryCollection,
  LibraryCollectionCreateInput,
  LibraryCollectionPatch,
  LibraryCollectionQuery,
  LibraryCompany,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryCompanyQuery,
  LibraryGame,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGameQuery,
  LibraryPerson,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryPersonQuery,
  LibraryTag,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTagQuery
} from '@kisaki/extension-api'
import {
  createNotFoundError,
  ensureNonEmptyString,
  normalizeCapabilityError
} from '@kisaki/extension-api'
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  characterExternalIds,
  characters,
  collections,
  companies,
  companyExternalIds,
  gameExternalIds,
  games,
  personExternalIds,
  persons,
  tags
} from '@shared/db'
import { normalizeExternalIds } from '@shared/identity'
import { buildFilterConditions, buildOrderBy } from '@shared/filter/builder'
import {
  characterFilterQuerySpec,
  collectionFilterQuerySpec,
  companyFilterQuerySpec,
  gameFilterQuerySpec,
  personFilterQuerySpec,
  tagFilterQuerySpec
} from '@shared/filter/specs'
import { buildSearchCondition } from '@shared/search/builder'
import {
  characterSearchQuerySpec,
  collectionSearchQuerySpec,
  companySearchQuerySpec,
  gameSearchQuerySpec,
  personSearchQuerySpec,
  tagSearchQuerySpec
} from '@shared/search/specs'
import type { DbService } from '@main/services/db'

interface ExternalIdConfig {
  table: any
  entityIdField: string
  orderField: string
}

interface EntityConfig<TEntity, TCreate, TPatch, TQuery> {
  table: any
  filterSpec: any
  searchSpec: any
  externalIds?: ExternalIdConfig
  toFilter(query: TQuery | undefined): Record<string, unknown>
  toDto(
    row: Record<string, unknown>,
    externalIds: readonly { source: string; id: string }[]
  ): TEntity
  buildCreateValues(id: string, input: TCreate): Record<string, unknown>
  buildPatchValues(patch: TPatch): Record<string, unknown>
  buildExtraConditions(query: TQuery | undefined): SQL[]
}

export interface ExtensionLibraryEntitiesHostOptions {
  db: DbService
}

export class ExtensionLibraryEntitiesHost {
  constructor(private readonly options: ExtensionLibraryEntitiesHostOptions) {}

  getGame(id: string): LibraryGame | null {
    return this.getEntity(id, GAME_CONFIG)
  }

  listGames(query?: LibraryGameQuery): readonly LibraryGame[] {
    return this.listEntities(query, GAME_CONFIG)
  }

  createGame(input: LibraryGameCreateInput): LibraryGame {
    return this.createEntity(input, GAME_CONFIG)
  }

  updateGame(id: string, patch: LibraryGamePatch): LibraryGame {
    return this.updateEntity(id, patch, GAME_CONFIG)
  }

  removeGame(id: string): void {
    this.removeEntity(id, GAME_CONFIG)
  }

  getCharacter(id: string): LibraryCharacter | null {
    return this.getEntity(id, CHARACTER_CONFIG)
  }

  listCharacters(query?: LibraryCharacterQuery): readonly LibraryCharacter[] {
    return this.listEntities(query, CHARACTER_CONFIG)
  }

  createCharacter(input: LibraryCharacterCreateInput): LibraryCharacter {
    return this.createEntity(input, CHARACTER_CONFIG)
  }

  updateCharacter(id: string, patch: LibraryCharacterPatch): LibraryCharacter {
    return this.updateEntity(id, patch, CHARACTER_CONFIG)
  }

  removeCharacter(id: string): void {
    this.removeEntity(id, CHARACTER_CONFIG)
  }

  getPerson(id: string): LibraryPerson | null {
    return this.getEntity(id, PERSON_CONFIG)
  }

  listPersons(query?: LibraryPersonQuery): readonly LibraryPerson[] {
    return this.listEntities(query, PERSON_CONFIG)
  }

  createPerson(input: LibraryPersonCreateInput): LibraryPerson {
    return this.createEntity(input, PERSON_CONFIG)
  }

  updatePerson(id: string, patch: LibraryPersonPatch): LibraryPerson {
    return this.updateEntity(id, patch, PERSON_CONFIG)
  }

  removePerson(id: string): void {
    this.removeEntity(id, PERSON_CONFIG)
  }

  getCompany(id: string): LibraryCompany | null {
    return this.getEntity(id, COMPANY_CONFIG)
  }

  listCompanies(query?: LibraryCompanyQuery): readonly LibraryCompany[] {
    return this.listEntities(query, COMPANY_CONFIG)
  }

  createCompany(input: LibraryCompanyCreateInput): LibraryCompany {
    return this.createEntity(input, COMPANY_CONFIG)
  }

  updateCompany(id: string, patch: LibraryCompanyPatch): LibraryCompany {
    return this.updateEntity(id, patch, COMPANY_CONFIG)
  }

  removeCompany(id: string): void {
    this.removeEntity(id, COMPANY_CONFIG)
  }

  getCollection(id: string): LibraryCollection | null {
    return this.getEntity(id, COLLECTION_CONFIG)
  }

  listCollections(query?: LibraryCollectionQuery): readonly LibraryCollection[] {
    return this.listEntities(query, COLLECTION_CONFIG)
  }

  createCollection(input: LibraryCollectionCreateInput): LibraryCollection {
    return this.createEntity(input, COLLECTION_CONFIG)
  }

  updateCollection(id: string, patch: LibraryCollectionPatch): LibraryCollection {
    return this.updateEntity(id, patch, COLLECTION_CONFIG)
  }

  removeCollection(id: string): void {
    this.removeEntity(id, COLLECTION_CONFIG)
  }

  getTag(id: string): LibraryTag | null {
    return this.getEntity(id, TAG_CONFIG)
  }

  listTags(query?: LibraryTagQuery): readonly LibraryTag[] {
    return this.listEntities(query, TAG_CONFIG)
  }

  createTag(input: LibraryTagCreateInput): LibraryTag {
    return this.createEntity(input, TAG_CONFIG)
  }

  updateTag(id: string, patch: LibraryTagPatch): LibraryTag {
    return this.updateEntity(id, patch, TAG_CONFIG)
  }

  removeTag(id: string): void {
    this.removeEntity(id, TAG_CONFIG)
  }

  private getEntity<TEntity, TCreate, TPatch, TQuery>(
    id: string,
    config: EntityConfig<TEntity, TCreate, TPatch, TQuery>
  ): TEntity | null {
    ensureNonEmptyString(id, 'library entity id')

    try {
      const row = this.options.db.db
        .select()
        .from(config.table)
        .where(eq(config.table.id, id))
        .get()
      if (!row) {
        return null
      }

      const externalIds = config.externalIds
        ? (this.loadExternalIds(config.externalIds, [id]).get(id) ?? [])
        : []
      return config.toDto(row as Record<string, unknown>, externalIds)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to read the library entity.')
    }
  }

  private listEntities<
    TEntity,
    TCreate,
    TPatch,
    TQuery extends {
      ids?: readonly string[]
      search?: string
      limit?: number
      offset?: number
      sort?: { field: string; direction?: 'asc' | 'desc' }
    }
  >(
    query: TQuery | undefined,
    config: EntityConfig<TEntity, TCreate, TPatch, TQuery>
  ): readonly TEntity[] {
    if (query?.ids && query.ids.length === 0) {
      return []
    }

    try {
      const conditions: SQL[] = [...config.buildExtraConditions(query)]
      if (query?.ids?.length) {
        conditions.push(inArray(config.table.id, [...query.ids]))
      }

      const filterCondition = buildFilterConditions(
        config.filterSpec,
        config.toFilter(query) as any
      )
      if (filterCondition) {
        conditions.push(filterCondition)
      }

      const searchCondition = buildSearchCondition(config.searchSpec, query?.search)
      if (searchCondition) {
        conditions.push(searchCondition)
      }

      let builder = this.options.db.db.select().from(config.table).$dynamic()
      if (conditions.length > 0) {
        builder = builder.where(and(...conditions) as SQL)
      }

      builder = builder.orderBy(
        buildOrderBy(
          config.filterSpec,
          query?.sort?.field ?? config.filterSpec.sort.defaultKey,
          query?.sort?.direction ?? 'asc'
        )
      )

      if (typeof query?.limit === 'number') {
        builder = builder.limit(query.limit)
      }
      if (typeof query?.offset === 'number') {
        builder = builder.offset(query.offset)
      }

      const rows = builder.all() as Record<string, unknown>[]
      const ids = rows.map((row) => String(row.id))
      const externalIdsByEntity = config.externalIds
        ? this.loadExternalIds(config.externalIds, ids)
        : new Map<string, readonly { source: string; id: string }[]>()

      return rows.map((row) => config.toDto(row, externalIdsByEntity.get(String(row.id)) ?? []))
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to query the library.')
    }
  }

  private createEntity<TEntity, TCreate extends { name: string }, TPatch, TQuery>(
    input: TCreate,
    config: EntityConfig<TEntity, TCreate, TPatch, TQuery>
  ): TEntity {
    ensureNonEmptyString(input.name, 'library entity name')

    try {
      const id = nanoid()
      this.options.db.db.transaction((tx) => {
        tx.insert(config.table).values(config.buildCreateValues(id, input)).run()
        if (config.externalIds) {
          syncExternalIds(
            tx,
            config.externalIds,
            id,
            (input as Record<string, unknown>).externalIds
          )
        }
      })

      const entity = this.getEntity(id, config)
      if (!entity) {
        throw createNotFoundError(`Library entity "${id}" was not found after creation.`)
      }
      return entity
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to create the library entity.')
    }
  }

  private updateEntity<TEntity, TCreate, TPatch, TQuery>(
    id: string,
    patch: TPatch,
    config: EntityConfig<TEntity, TCreate, TPatch, TQuery>
  ): TEntity {
    ensureNonEmptyString(id, 'library entity id')

    try {
      this.options.db.db.transaction((tx) => {
        const existing = tx.select().from(config.table).where(eq(config.table.id, id)).get()
        if (!existing) {
          throw createNotFoundError(`Library entity "${id}" was not found.`)
        }

        const values = config.buildPatchValues(patch)
        if (Object.keys(values).length > 0) {
          tx.update(config.table).set(values).where(eq(config.table.id, id)).run()
        }

        if (config.externalIds && 'externalIds' in (patch as Record<string, unknown>)) {
          syncExternalIds(
            tx,
            config.externalIds,
            id,
            (patch as Record<string, unknown>).externalIds
          )
        }
      })

      const entity = this.getEntity(id, config)
      if (!entity) {
        throw createNotFoundError(`Library entity "${id}" was not found after update.`)
      }
      return entity
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the library entity.')
    }
  }

  private removeEntity<TEntity, TCreate, TPatch, TQuery>(
    id: string,
    config: EntityConfig<TEntity, TCreate, TPatch, TQuery>
  ): void {
    ensureNonEmptyString(id, 'library entity id')

    try {
      const existing = this.options.db.db
        .select()
        .from(config.table)
        .where(eq(config.table.id, id))
        .get()
      if (!existing) {
        throw createNotFoundError(`Library entity "${id}" was not found.`)
      }

      this.options.db.db.delete(config.table).where(eq(config.table.id, id)).run()
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the library entity.')
    }
  }

  private loadExternalIds(
    config: ExternalIdConfig,
    entityIds: readonly string[]
  ): Map<string, readonly { source: string; id: string }[]> {
    const byEntity = new Map<string, { source: string; id: string }[]>()
    if (entityIds.length === 0) {
      return byEntity
    }

    const rows = this.options.db.db
      .select()
      .from(config.table)
      .where(inArray(config.table[config.entityIdField], [...entityIds]))
      .orderBy(config.table[config.orderField])
      .all() as Record<string, unknown>[]

    for (const row of rows) {
      const entityId = String(row[config.entityIdField])
      let list = byEntity.get(entityId)
      if (!list) {
        list = []
        byEntity.set(entityId, list)
      }

      list.push({
        source: String(row.source),
        id: String(row.externalId)
      })
    }

    return byEntity
  }
}

function syncExternalIds(
  tx: any,
  config: ExternalIdConfig,
  entityId: string,
  externalIds: unknown
): void {
  tx.delete(config.table).where(eq(config.table[config.entityIdField], entityId)).run()

  if (!Array.isArray(externalIds)) {
    return
  }

  for (const [index, entry] of normalizeExternalIds(
    externalIds as Array<{ source: string; id: string }>
  ).entries()) {
    tx.insert(config.table)
      .values({
        [config.entityIdField]: entityId,
        source: entry.source,
        externalId: entry.id,
        [config.orderField]: index
      })
      .run()
  }
}

function toTimestampMs(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime()
  }

  return typeof value === 'number' ? value : Date.now()
}

function buildRankedEntityDtoBase(
  row: Record<string, unknown>,
  externalIds: readonly { source: string; id: string }[]
) {
  return {
    id: String(row.id),
    createdAt: toTimestampMs(row.createdAt),
    updatedAt: toTimestampMs(row.updatedAt),
    name: String(row.name),
    description: typeof row.description === 'string' ? row.description : undefined,
    originalName: typeof row.originalName === 'string' ? row.originalName : undefined,
    sortName: typeof row.sortName === 'string' ? row.sortName : undefined,
    score: typeof row.score === 'number' ? row.score : row.score === null ? null : undefined,
    isFavorite: Boolean(row.isFavorite),
    isNsfw: Boolean(row.isNsfw),
    relatedSites: Array.isArray(row.relatedSites)
      ? (row.relatedSites as readonly any[])
      : undefined,
    externalIds
  }
}

const GAME_CONFIG: EntityConfig<
  LibraryGame,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGameQuery
> = {
  table: games,
  filterSpec: gameFilterQuerySpec,
  searchSpec: gameSearchQuerySpec,
  externalIds: { table: gameExternalIds, entityIdField: 'gameId', orderField: 'orderInGame' },
  toFilter(query) {
    return {
      isFavorite: query?.favoritesOnly ? true : undefined,
      isNsfw: query?.includeNsfw ? undefined : false,
      status: query?.statuses,
      tags: query?.tagIds?.length ? { ids: query.tagIds, match: 'any' } : undefined,
      collections: query?.collectionIds?.length
        ? { ids: query.collectionIds, match: 'any' }
        : undefined
    }
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      coverFile: typeof row.coverFile === 'string' ? row.coverFile : undefined,
      backdropFile: typeof row.backdropFile === 'string' ? row.backdropFile : undefined,
      logoFile: typeof row.logoFile === 'string' ? row.logoFile : undefined,
      iconFile: typeof row.iconFile === 'string' ? row.iconFile : undefined,
      releaseDate: row.releaseDate as LibraryGame['releaseDate'],
      status: row.status as LibraryGame['status'],
      lastActiveAt:
        row.lastActiveAt === null || row.lastActiveAt === undefined
          ? (row.lastActiveAt as null | undefined)
          : toTimestampMs(row.lastActiveAt),
      totalDuration: typeof row.totalDuration === 'number' ? row.totalDuration : 0,
      savePath: typeof row.savePath === 'string' ? row.savePath : undefined,
      saveBackups: Array.isArray(row.saveBackups)
        ? (row.saveBackups as LibraryGame['saveBackups'])
        : undefined,
      maxSaveBackups: typeof row.maxSaveBackups === 'number' ? row.maxSaveBackups : 5,
      launcherMode: row.launcherMode as LibraryGame['launcherMode'],
      launcherPath: typeof row.launcherPath === 'string' ? row.launcherPath : undefined,
      monitorMode: row.monitorMode as LibraryGame['monitorMode'],
      monitorPath: typeof row.monitorPath === 'string' ? row.monitorPath : undefined,
      gameDirPath: typeof row.gameDirPath === 'string' ? row.gameDirPath : undefined,
      descriptionInlineFiles: Array.isArray(row.descriptionInlineFiles)
        ? (row.descriptionInlineFiles as readonly string[])
        : undefined
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      coverFile: input.coverFile,
      backdropFile: input.backdropFile,
      logoFile: input.logoFile,
      iconFile: input.iconFile,
      releaseDate: input.releaseDate,
      status: input.status,
      savePath: input.savePath,
      saveBackups: input.saveBackups,
      maxSaveBackups: input.maxSaveBackups,
      launcherMode: input.launcherMode,
      launcherPath: input.launcherPath,
      monitorMode: input.monitorMode,
      monitorPath: input.monitorPath,
      gameDirPath: input.gameDirPath,
      descriptionInlineFiles: input.descriptionInlineFiles,
      score: input.score,
      isFavorite: input.isFavorite,
      isNsfw: input.isNsfw,
      relatedSites: input.relatedSites
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
      releaseDate: patch.releaseDate,
      status: patch.status,
      savePath: patch.savePath,
      saveBackups: patch.saveBackups,
      maxSaveBackups: patch.maxSaveBackups,
      launcherMode: patch.launcherMode,
      launcherPath: patch.launcherPath,
      monitorMode: patch.monitorMode,
      monitorPath: patch.monitorPath,
      gameDirPath: patch.gameDirPath,
      descriptionInlineFiles: patch.descriptionInlineFiles,
      score: patch.score,
      isFavorite: patch.isFavorite,
      isNsfw: patch.isNsfw,
      relatedSites: patch.relatedSites,
      lastActiveAt:
        patch.lastActiveAt === undefined
          ? undefined
          : patch.lastActiveAt === null
            ? null
            : new Date(patch.lastActiveAt),
      totalDuration: patch.totalDuration
    })
  },
  buildExtraConditions() {
    return []
  }
}

const PERSON_CONFIG: EntityConfig<
  LibraryPerson,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryPersonQuery
> = {
  table: persons,
  filterSpec: personFilterQuerySpec,
  searchSpec: personSearchQuerySpec,
  externalIds: { table: personExternalIds, entityIdField: 'personId', orderField: 'orderInPerson' },
  toFilter(query) {
    return {
      isFavorite: query?.favoritesOnly ? true : undefined,
      isNsfw: query?.includeNsfw ? undefined : false,
      gender: query?.genders?.length === 1 ? query.genders[0] : undefined,
      tags: query?.tagIds?.length ? { ids: query.tagIds, match: 'any' } : undefined
    }
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      photoFile: typeof row.photoFile === 'string' ? row.photoFile : undefined,
      birthDate: row.birthDate as LibraryPerson['birthDate'],
      deathDate: row.deathDate as LibraryPerson['deathDate'],
      gender: row.gender as LibraryPerson['gender']
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      photoFile: input.photoFile,
      birthDate: input.birthDate,
      deathDate: input.deathDate,
      gender: input.gender,
      score: input.score,
      isFavorite: input.isFavorite,
      isNsfw: input.isNsfw,
      relatedSites: input.relatedSites
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      originalName: patch.originalName,
      sortName: patch.sortName,
      photoFile: patch.photoFile,
      birthDate: patch.birthDate,
      deathDate: patch.deathDate,
      gender: patch.gender,
      score: patch.score,
      isFavorite: patch.isFavorite,
      isNsfw: patch.isNsfw,
      relatedSites: patch.relatedSites
    })
  },
  buildExtraConditions(query) {
    return query?.genders && query.genders.length > 1
      ? [inArray(persons.gender, [...query.genders])]
      : []
  }
}

const COMPANY_CONFIG: EntityConfig<
  LibraryCompany,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryCompanyQuery
> = {
  table: companies,
  filterSpec: companyFilterQuerySpec,
  searchSpec: companySearchQuerySpec,
  externalIds: {
    table: companyExternalIds,
    entityIdField: 'companyId',
    orderField: 'orderInCompany'
  },
  toFilter(query) {
    return {
      isFavorite: query?.favoritesOnly ? true : undefined,
      isNsfw: query?.includeNsfw ? undefined : false,
      tags: query?.tagIds?.length ? { ids: query.tagIds, match: 'any' } : undefined
    }
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      foundedDate: row.foundedDate as LibraryCompany['foundedDate'],
      logoFile: typeof row.logoFile === 'string' ? row.logoFile : undefined
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      foundedDate: input.foundedDate,
      logoFile: input.logoFile,
      score: input.score,
      isFavorite: input.isFavorite,
      isNsfw: input.isNsfw,
      relatedSites: input.relatedSites
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
      relatedSites: patch.relatedSites
    })
  },
  buildExtraConditions() {
    return []
  }
}

const CHARACTER_CONFIG: EntityConfig<
  LibraryCharacter,
  LibraryCharacterCreateInput,
  LibraryCharacterPatch,
  LibraryCharacterQuery
> = {
  table: characters,
  filterSpec: characterFilterQuerySpec,
  searchSpec: characterSearchQuerySpec,
  externalIds: {
    table: characterExternalIds,
    entityIdField: 'characterId',
    orderField: 'orderInCharacter'
  },
  toFilter(query) {
    return {
      isFavorite: query?.favoritesOnly ? true : undefined,
      isNsfw: query?.includeNsfw ? undefined : false,
      gender: query?.genders?.length === 1 ? query.genders[0] : undefined,
      tags: query?.tagIds?.length ? { ids: query.tagIds, match: 'any' } : undefined
    }
  },
  toDto(row, externalIds) {
    return {
      ...buildRankedEntityDtoBase(row, externalIds),
      photoFile: typeof row.photoFile === 'string' ? row.photoFile : undefined,
      birthDate: row.birthDate as LibraryCharacter['birthDate'],
      gender: row.gender as LibraryCharacter['gender'],
      bloodType: row.bloodType as LibraryCharacter['bloodType'],
      height: typeof row.height === 'number' ? row.height : undefined,
      weight: typeof row.weight === 'number' ? row.weight : undefined,
      bust: typeof row.bust === 'number' ? row.bust : undefined,
      waist: typeof row.waist === 'number' ? row.waist : undefined,
      hips: typeof row.hips === 'number' ? row.hips : undefined,
      cup: row.cup as LibraryCharacter['cup'],
      age: typeof row.age === 'number' ? row.age : undefined
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      name: input.name,
      description: input.description,
      originalName: input.originalName,
      sortName: input.sortName,
      photoFile: input.photoFile,
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
      relatedSites: input.relatedSites
    }
  },
  buildPatchValues(patch) {
    return stripUndefined({
      name: patch.name,
      description: patch.description,
      originalName: patch.originalName,
      sortName: patch.sortName,
      photoFile: patch.photoFile,
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
      relatedSites: patch.relatedSites
    })
  },
  buildExtraConditions(query) {
    return query?.genders && query.genders.length > 1
      ? [inArray(characters.gender, [...query.genders])]
      : []
  }
}

const COLLECTION_CONFIG: EntityConfig<
  LibraryCollection,
  LibraryCollectionCreateInput,
  LibraryCollectionPatch,
  LibraryCollectionQuery
> = {
  table: collections,
  filterSpec: collectionFilterQuerySpec,
  searchSpec: collectionSearchQuerySpec,
  toFilter() {
    return {}
  },
  toDto(row) {
    return {
      id: String(row.id),
      createdAt: toTimestampMs(row.createdAt),
      updatedAt: toTimestampMs(row.updatedAt),
      name: String(row.name),
      description: typeof row.description === 'string' ? row.description : undefined,
      coverFile: typeof row.coverFile === 'string' ? row.coverFile : undefined,
      isNsfw: Boolean(row.isNsfw),
      order: typeof row.order === 'number' ? row.order : 0,
      isDynamic: Boolean(row.isDynamic),
      dynamicConfig: row.dynamicConfig as LibraryCollection['dynamicConfig']
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
      name: input.name,
      description: input.description,
      coverFile: input.coverFile,
      isNsfw: input.isNsfw,
      order: input.order,
      isDynamic: input.isDynamic,
      dynamicConfig: input.dynamicConfig
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
      dynamicConfig: patch.dynamicConfig
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
}

const TAG_CONFIG: EntityConfig<
  LibraryTag,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTagQuery
> = {
  table: tags,
  filterSpec: tagFilterQuerySpec,
  searchSpec: tagSearchQuerySpec,
  toFilter(query) {
    return {
      isNsfw: query?.includeNsfw ? undefined : false
    }
  },
  toDto(row) {
    return {
      id: String(row.id),
      createdAt: toTimestampMs(row.createdAt),
      updatedAt: toTimestampMs(row.updatedAt),
      name: String(row.name),
      description: typeof row.description === 'string' ? row.description : undefined,
      isNsfw: Boolean(row.isNsfw)
    }
  },
  buildCreateValues(id, input) {
    return {
      id,
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
  buildExtraConditions() {
    return []
  }
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const result: Partial<T> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      result[key as keyof T] = entry as T[keyof T]
    }
  }
  return result
}
