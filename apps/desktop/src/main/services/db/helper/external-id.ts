/**
 * External-ID link queries.
 *
 * External IDs live in one link table per entity, all with the same shape:
 * an owner id column plus a normalized `(source, externalId)` pair. These
 * helpers take that shape as data so lookups and ownership checks are written
 * once; callers keep ownership of when and why they run.
 *
 * External IDs are always persisted in `normalizeExternalId` form, so lookups
 * can match the stored columns directly.
 */

import { and, eq } from 'drizzle-orm'
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import {
  animeEpisodeExternalIds,
  animeExternalIds,
  characterExternalIds,
  companyExternalIds,
  gameExternalIds,
  movieExternalIds,
  personExternalIds,
  tvEpisodeExternalIds,
  tvExternalIds
} from '@shared/db/schema'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { DbContext, DbQueryContext } from '../types'

export interface ExternalIdLinkTable {
  table: SQLiteTable
  /** Column holding the owning entity's id. */
  entityIdColumn: AnySQLiteColumn
  sourceColumn: AnySQLiteColumn
  externalIdColumn: AnySQLiteColumn
  /** Owner noun used in boundary error messages, e.g. "person". */
  ownerLabel: string
}

export const gameExternalIdLink: ExternalIdLinkTable = {
  table: gameExternalIds,
  entityIdColumn: gameExternalIds.gameId,
  sourceColumn: gameExternalIds.source,
  externalIdColumn: gameExternalIds.externalId,
  ownerLabel: 'game'
}

export const animeExternalIdLink: ExternalIdLinkTable = {
  table: animeExternalIds,
  entityIdColumn: animeExternalIds.animeId,
  sourceColumn: animeExternalIds.source,
  externalIdColumn: animeExternalIds.externalId,
  ownerLabel: 'anime'
}

export const animeEpisodeExternalIdLink: ExternalIdLinkTable = {
  table: animeEpisodeExternalIds,
  entityIdColumn: animeEpisodeExternalIds.episodeId,
  sourceColumn: animeEpisodeExternalIds.source,
  externalIdColumn: animeEpisodeExternalIds.externalId,
  ownerLabel: 'anime episode'
}

export const tvExternalIdLink: ExternalIdLinkTable = {
  table: tvExternalIds,
  entityIdColumn: tvExternalIds.tvId,
  sourceColumn: tvExternalIds.source,
  externalIdColumn: tvExternalIds.externalId,
  ownerLabel: 'tv'
}

export const tvEpisodeExternalIdLink: ExternalIdLinkTable = {
  table: tvEpisodeExternalIds,
  entityIdColumn: tvEpisodeExternalIds.episodeId,
  sourceColumn: tvEpisodeExternalIds.source,
  externalIdColumn: tvEpisodeExternalIds.externalId,
  ownerLabel: 'tv episode'
}

export const movieExternalIdLink: ExternalIdLinkTable = {
  table: movieExternalIds,
  entityIdColumn: movieExternalIds.movieId,
  sourceColumn: movieExternalIds.source,
  externalIdColumn: movieExternalIds.externalId,
  ownerLabel: 'movie'
}

export const personExternalIdLink: ExternalIdLinkTable = {
  table: personExternalIds,
  entityIdColumn: personExternalIds.personId,
  sourceColumn: personExternalIds.source,
  externalIdColumn: personExternalIds.externalId,
  ownerLabel: 'person'
}

export const companyExternalIdLink: ExternalIdLinkTable = {
  table: companyExternalIds,
  entityIdColumn: companyExternalIds.companyId,
  sourceColumn: companyExternalIds.source,
  externalIdColumn: companyExternalIds.externalId,
  ownerLabel: 'company'
}

export const characterExternalIdLink: ExternalIdLinkTable = {
  table: characterExternalIds,
  entityIdColumn: characterExternalIds.characterId,
  sourceColumn: characterExternalIds.source,
  externalIdColumn: characterExternalIds.externalId,
  ownerLabel: 'character'
}

/** Entity ids that already hold the given normalized external ID. */
export function findExternalIdOwners(
  ctx: DbContext,
  link: ExternalIdLinkTable,
  externalId: ExternalId
): string[] {
  const rows = (ctx as DbQueryContext)
    .select({ ownerId: link.entityIdColumn })
    .from(link.table)
    .where(and(eq(link.sourceColumn, externalId.source), eq(link.externalIdColumn, externalId.id)))
    .all()

  return rows.flatMap((row) => (typeof row.ownerId === 'string' ? [row.ownerId] : []))
}

/**
 * Rejects external IDs already claimed by an entity outside `allowedOwnerIds`.
 * External IDs are a persistent identity primitive, so two entities must never
 * share one.
 */
export function requireExternalIdsAvailable(
  ctx: DbContext,
  link: ExternalIdLinkTable,
  allowedOwnerIds: readonly string[],
  externalIds: ExternalId[]
): void {
  for (const externalId of normalizeExternalIds(externalIds)) {
    const owners = findExternalIdOwners(ctx, link, externalId)
    if (owners.some((ownerId) => !allowedOwnerIds.includes(ownerId))) {
      throw new Error(
        `External ID already belongs to another ${link.ownerLabel}: ${externalId.source}:${externalId.id}`
      )
    }
  }
}
