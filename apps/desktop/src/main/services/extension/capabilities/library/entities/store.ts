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
  LibraryTagQuery,
  ExternalId
} from '@kisaki3/extension-api'
import {
  createNotFoundError,
  ensureNonEmptyString,
  normalizeCapabilityError
} from '@kisaki3/extension-api'
import { and, eq, inArray, type SQL } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { buildFilterConditions, buildOrderBy } from '@shared/filter/builder'
import { buildSearchCondition } from '@shared/search/builder'
import type { DbService } from '@main/services/db'
import {
  ANIME_CONFIG,
  CHARACTER_CONFIG,
  COLLECTION_CONFIG,
  COMPANY_CONFIG,
  GAME_CONFIG,
  PERSON_CONFIG,
  TAG_CONFIG
} from './configs'
import { loadExternalIds, syncExternalIds } from './external-ids'
import type {
  EntityConfig,
  EntityCreateInputBase,
  EntityExternalIds,
  EntityListQueryBase,
  EntityPatchInputBase,
  LibraryEntityTable
} from './types'

export interface ExtensionLibraryEntityStoreOptions {
  db: DbService
}

export class ExtensionLibraryEntityStore {
  constructor(private readonly options: ExtensionLibraryEntityStoreOptions) {}

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

  getAnime(id: string): LibraryAnime | null {
    return this.getEntity(id, ANIME_CONFIG)
  }

  listAnimes(query?: LibraryAnimeQuery): readonly LibraryAnime[] {
    return this.listEntities(query, ANIME_CONFIG)
  }

  createAnime(input: LibraryAnimeCreateInput): LibraryAnime {
    return this.createEntity(input, ANIME_CONFIG)
  }

  updateAnime(id: string, patch: LibraryAnimePatch): LibraryAnime {
    return this.updateEntity(id, patch, ANIME_CONFIG)
  }

  removeAnime(id: string): void {
    this.removeEntity(id, ANIME_CONFIG)
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

  private getEntity<
    TEntity,
    TCreate extends EntityCreateInputBase,
    TPatch extends EntityPatchInputBase,
    TQuery extends EntityListQueryBase,
    TTable extends LibraryEntityTable,
    TExternalIdTable extends SQLiteTable
  >(
    id: string,
    config: EntityConfig<TEntity, TCreate, TPatch, TQuery, TTable, TExternalIdTable>
  ): TEntity | null {
    ensureNonEmptyString(id, 'library entity id')

    try {
      const row = this.options.db.client
        .select()
        .from(config.table)
        .where(eq(config.table.id, id))
        .get()
      if (!row) {
        return null
      }

      const externalIds = config.externalIds
        ? (loadExternalIds(this.options.db.client, config.externalIds, [id]).get(id) ?? [])
        : []
      return config.toDto(row as TTable['$inferSelect'], externalIds)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to read the library entity.')
    }
  }

  private listEntities<
    TEntity,
    TCreate extends EntityCreateInputBase,
    TPatch extends EntityPatchInputBase,
    TQuery extends EntityListQueryBase,
    TTable extends LibraryEntityTable,
    TExternalIdTable extends SQLiteTable
  >(
    query: TQuery | undefined,
    config: EntityConfig<TEntity, TCreate, TPatch, TQuery, TTable, TExternalIdTable>
  ): readonly TEntity[] {
    if (query?.ids && query.ids.length === 0) {
      return []
    }

    try {
      const conditions: SQL[] = [...config.buildExtraConditions(query)]
      if (query?.ids?.length) {
        conditions.push(inArray(config.table.id, [...query.ids]))
      }

      const filterCondition = buildFilterConditions(config.filterSpec, config.toFilter(query))
      if (filterCondition) {
        conditions.push(filterCondition)
      }

      const searchCondition = buildSearchCondition(config.searchSpec, query?.search)
      if (searchCondition) {
        conditions.push(searchCondition)
      }

      let builder = this.options.db.client.select().from(config.table).$dynamic()
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

      const rows = builder.all()
      const ids = rows.map((row) => row.id)
      const externalIdsByEntity = config.externalIds
        ? loadExternalIds(this.options.db.client, config.externalIds, ids)
        : new Map<string, readonly ExternalId[]>()

      return rows.map((row) =>
        config.toDto(row as TTable['$inferSelect'], externalIdsByEntity.get(row.id) ?? [])
      )
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to query the library.')
    }
  }

  private createEntity<
    TEntity,
    TCreate extends EntityCreateInputBase,
    TPatch extends EntityPatchInputBase,
    TQuery extends EntityListQueryBase,
    TTable extends LibraryEntityTable,
    TExternalIdTable extends SQLiteTable
  >(
    input: TCreate,
    config: EntityConfig<TEntity, TCreate, TPatch, TQuery, TTable, TExternalIdTable>
  ): TEntity {
    ensureNonEmptyString(input.name, 'library entity name')

    try {
      const id = nanoid()
      this.options.db.client.transaction((tx) => {
        tx.insert(config.table).values(config.buildCreateValues(id, input)).run()
        if (config.externalIds) {
          syncExternalIds(tx, config.externalIds, id, input.externalIds)
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

  private updateEntity<
    TEntity,
    TCreate extends EntityCreateInputBase,
    TPatch extends EntityPatchInputBase,
    TQuery extends EntityListQueryBase,
    TTable extends LibraryEntityTable,
    TExternalIdTable extends SQLiteTable
  >(
    id: string,
    patch: TPatch,
    config: EntityConfig<TEntity, TCreate, TPatch, TQuery, TTable, TExternalIdTable>
  ): TEntity {
    ensureNonEmptyString(id, 'library entity id')

    try {
      this.options.db.client.transaction((tx) => {
        const existing = tx.select().from(config.table).where(eq(config.table.id, id)).get()
        if (!existing) {
          throw createNotFoundError(`Library entity "${id}" was not found.`)
        }

        const values = config.buildPatchValues(patch)
        if (Object.keys(values).length > 0) {
          tx.update(config.table).set(values).where(eq(config.table.id, id)).run()
        }

        const patchExternalIds = getPatchExternalIds(patch)
        if (config.externalIds && patchExternalIds.hasExternalIds) {
          syncExternalIds(tx, config.externalIds, id, patchExternalIds.externalIds)
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

  private removeEntity<
    TEntity,
    TCreate extends EntityCreateInputBase,
    TPatch extends EntityPatchInputBase,
    TQuery extends EntityListQueryBase,
    TTable extends LibraryEntityTable,
    TExternalIdTable extends SQLiteTable
  >(
    id: string,
    config: EntityConfig<TEntity, TCreate, TPatch, TQuery, TTable, TExternalIdTable>
  ): void {
    ensureNonEmptyString(id, 'library entity id')

    try {
      const existing = this.options.db.client
        .select()
        .from(config.table)
        .where(eq(config.table.id, id))
        .get()
      if (!existing) {
        throw createNotFoundError(`Library entity "${id}" was not found.`)
      }

      this.options.db.client.delete(config.table).where(eq(config.table.id, id)).run()
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the library entity.')
    }
  }
}

function getPatchExternalIds(
  patch: object
):
  { hasExternalIds: false } | { hasExternalIds: true; externalIds: EntityExternalIds | undefined } {
  if (!Object.hasOwn(patch, 'externalIds')) {
    return { hasExternalIds: false }
  }

  return {
    hasExternalIds: true,
    externalIds: (patch as { externalIds?: EntityExternalIds }).externalIds
  }
}
