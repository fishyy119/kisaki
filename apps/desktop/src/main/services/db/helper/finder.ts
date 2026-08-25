/**
 * DB entity finder helper.
 *
 * Common query helpers for finding existing entities by persistent identity.
 * All methods are synchronous for better-sqlite3 compatibility.
 * All methods accept an optional DbContext parameter to work within transactions.
 */

import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
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

export class EntityFinderHelper {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * Get db context (either provided transaction or default db instance)
   */
  private getDb(ctx?: DbContext): DbContext {
    return ctx ?? this.db
  }

  findExistingPerson(params: { externalIds?: ExternalId[] }, ctx?: DbContext): Person | undefined {
    return this.findByExternalIds<Person>(
      { entityTable: persons, idColumn: persons.id, link: personExternalIdLink },
      params.externalIds,
      ctx
    )
  }

  findExistingCompany(
    params: { externalIds?: ExternalId[] },
    ctx?: DbContext
  ): Company | undefined {
    return this.findByExternalIds<Company>(
      { entityTable: companies, idColumn: companies.id, link: companyExternalIdLink },
      params.externalIds,
      ctx
    )
  }

  findExistingCharacter(
    params: { externalIds?: ExternalId[] },
    ctx?: DbContext
  ): Character | undefined {
    return this.findByExternalIds<Character>(
      { entityTable: characters, idColumn: characters.id, link: characterExternalIdLink },
      params.externalIds,
      ctx
    )
  }

  findExistingGame(
    params: { externalIds?: ExternalId[]; path?: string },
    ctx?: DbContext
  ): Game | undefined {
    const db = this.getDb(ctx)

    // The install directory is the most specific identity a local game has.
    if (params.path) {
      const [result] = db
        .select()
        .from(games)
        .where(eq(games.gameDirPath, params.path))
        .limit(1)
        .all()

      if (result) return result
    }

    return this.findByExternalIds<Game>(
      { entityTable: games, idColumn: games.id, link: gameExternalIdLink },
      params.externalIds,
      ctx
    )
  }

  findExistingAnime(
    params: { externalIds?: ExternalId[]; path?: string },
    ctx?: DbContext
  ): Anime | undefined {
    const db = this.getDb(ctx)

    // The library directory is the most specific identity a local anime has.
    if (params.path) {
      const [result] = db
        .select()
        .from(animes)
        .where(eq(animes.animeDirPath, params.path))
        .limit(1)
        .all()

      if (result) return result
    }

    return this.findByExternalIds<Anime>(
      { entityTable: animes, idColumn: animes.id, link: animeExternalIdLink },
      params.externalIds,
      ctx
    )
  }

  findExistingComic(
    params: { externalIds?: ExternalId[]; path?: string },
    ctx?: DbContext
  ): Comic | undefined {
    const db = this.getDb(ctx)

    // The library directory is the most specific identity a local comic has.
    if (params.path) {
      const [result] = db
        .select()
        .from(comics)
        .where(eq(comics.comicDirPath, params.path))
        .limit(1)
        .all()

      if (result) return result
    }

    return this.findByExternalIds<Comic>(
      { entityTable: comics, idColumn: comics.id, link: comicExternalIdLink },
      params.externalIds,
      ctx
    )
  }

  findExistingNovel(
    params: { externalIds?: ExternalId[]; path?: string },
    ctx?: DbContext
  ): Novel | undefined {
    const db = this.getDb(ctx)

    // The library directory is the most specific identity a local novel has.
    if (params.path) {
      const [result] = db
        .select()
        .from(novels)
        .where(eq(novels.novelDirPath, params.path))
        .limit(1)
        .all()

      if (result) return result
    }

    return this.findByExternalIds<Novel>(
      { entityTable: novels, idColumn: novels.id, link: novelExternalIdLink },
      params.externalIds,
      ctx
    )
  }

  /**
   * Resolve the first entity owning any of the given external IDs.
   * Parameterized by schema facts only, so every entity with an external-ID
   * link table shares one implementation.
   */
  private findByExternalIds<TRow>(
    target: { entityTable: SQLiteTable; idColumn: AnySQLiteColumn; link: ExternalIdLinkTable },
    externalIds: ExternalId[] | undefined,
    ctx?: DbContext
  ): TRow | undefined {
    const db = this.getDb(ctx)

    for (const externalId of normalizeExternalIds(externalIds)) {
      for (const ownerId of findExternalIdOwners(db, target.link, externalId)) {
        const [row] = (db as DbQueryContext)
          .select()
          .from(target.entityTable)
          .where(eq(target.idColumn, ownerId))
          .limit(1)
          .all() as TRow[]

        if (row) return row
      }
    }

    return undefined
  }
}
