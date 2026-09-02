/**
 * Entity finder: resolves an existing entity by persistent identity.
 *
 * One query path resolves an existing entity by persistent identity: the
 * library directory first for media whose entries claim one, then external
 * ids. Per-entity facts live in the registry; adding an entity type is one
 * entry there. All methods are synchronous for better-sqlite3 compatibility
 * and accept an optional DbContext to work within transactions.
 */

import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { normalizeLibraryDirPath } from '@main/utils/fs'
import type { ContentEntityType } from '@shared/entity-types'
import * as schema from '@shared/db/schema'
import {
  persons,
  companies,
  characters,
  comics,
  games,
  animes,
  novels,
  type Person,
  type Company,
  type Character,
  type Comic,
  type Game,
  type Anime,
  type Novel
} from '@shared/db/schema'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { DbContext, DbQueryContext } from '../types'
import {
  animeExternalIdLink,
  characterExternalIdLink,
  comicExternalIdLink,
  companyExternalIdLink,
  findExternalIdOwners,
  gameExternalIdLink,
  novelExternalIdLink,
  personExternalIdLink,
  type ExternalIdLinkTable
} from './external-id'

export interface EntityFinderRowMap {
  game: Game
  anime: Anime
  comic: Comic
  novel: Novel
  person: Person
  company: Company
  character: Character
}

export interface EntityFinderParams {
  externalIds?: ExternalId[]
  /** Library directory identity; ignored for entities that claim none. */
  path?: string
}

interface EntityFinderFacts {
  entityTable: SQLiteTable
  idColumn: AnySQLiteColumn
  link: ExternalIdLinkTable
  /** The most specific identity a local entry has, for media types. */
  dirPathColumn?: AnySQLiteColumn
}

const ENTITY_FINDER_FACTS: Record<ContentEntityType, EntityFinderFacts> = {
  game: {
    entityTable: games,
    idColumn: games.id,
    link: gameExternalIdLink,
    dirPathColumn: games.dirPath
  },
  anime: {
    entityTable: animes,
    idColumn: animes.id,
    link: animeExternalIdLink,
    dirPathColumn: animes.dirPath
  },
  comic: {
    entityTable: comics,
    idColumn: comics.id,
    link: comicExternalIdLink,
    dirPathColumn: comics.dirPath
  },
  novel: {
    entityTable: novels,
    idColumn: novels.id,
    link: novelExternalIdLink,
    dirPathColumn: novels.dirPath
  },
  person: { entityTable: persons, idColumn: persons.id, link: personExternalIdLink },
  company: { entityTable: companies, idColumn: companies.id, link: companyExternalIdLink },
  character: { entityTable: characters, idColumn: characters.id, link: characterExternalIdLink }
}

export class EntityFinder {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * Resolve an existing entity by directory identity, then external ids.
   *
   * The row cast is this module's one owned correlation point: the facts
   * registry binds each entity type to its table by construction.
   */
  findExisting<T extends ContentEntityType>(
    entityType: T,
    params: EntityFinderParams,
    ctx?: DbContext
  ): EntityFinderRowMap[T] | undefined {
    const facts = ENTITY_FINDER_FACTS[entityType]
    const db = this.getDb(ctx)

    if (params.path && facts.dirPathColumn) {
      const [result] = (db as DbQueryContext)
        .select()
        .from(facts.entityTable)
        .where(eq(facts.dirPathColumn, normalizeLibraryDirPath(params.path)))
        .limit(1)
        .all()

      if (result) return result as EntityFinderRowMap[T]
    }

    for (const externalId of normalizeExternalIds(params.externalIds)) {
      for (const ownerId of findExternalIdOwners(db, facts.link, externalId)) {
        const [row] = (db as DbQueryContext)
          .select()
          .from(facts.entityTable)
          .where(eq(facts.idColumn, ownerId))
          .limit(1)
          .all()
        if (row) return row as EntityFinderRowMap[T]
      }
    }

    return undefined
  }

  /**
   * Get db context (either provided transaction or default db instance)
   */
  private getDb(ctx?: DbContext): DbContext {
    return ctx ?? this.db
  }
}
