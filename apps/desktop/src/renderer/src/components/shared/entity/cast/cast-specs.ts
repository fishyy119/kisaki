/**
 * Cast storage per media type.
 *
 * A cast row is the three-way fact "this person voices this character in this
 * entry", so unlike the two-endpoint link views it carries no role and no order
 * of its own. Editing replaces the entry's whole set, which is what makes a
 * recast a removal plus an addition rather than a silent rewrite.
 */

import { asc, eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { animeCastLinks, gameCastLinks } from '@shared/db'
import type { MediaType } from '@shared/common'

export interface CastRow {
  id: string
  characterId: string
  characterName: string
  characterImage: string | null
  personId: string
  personName: string
  personImage: string | null
  note: string | null
}

export interface CastReplaceRow {
  id: string
  characterId: string
  personId: string
  note: string | null
}

export interface CastSpec {
  list: (mediaId: string) => Promise<CastRow[]>
  replace: (mediaId: string, rows: CastReplaceRow[]) => Promise<void>
}

async function listGameCast(gameId: string): Promise<CastRow[]> {
  const rows = await db.query.gameCastLinks.findMany({
    where: eq(gameCastLinks.gameId, gameId),
    with: { character: true, person: true },
    orderBy: asc(gameCastLinks.createdAt)
  })
  return rows.filter((row) => row.character && row.person).map(toCastRow)
}

async function replaceGameCast(gameId: string, rows: CastReplaceRow[]): Promise<void> {
  await db.delete(gameCastLinks).where(eq(gameCastLinks.gameId, gameId))
  if (rows.length === 0) return

  await db.insert(gameCastLinks).values(
    rows.map((row) => ({
      id: row.id,
      gameId,
      characterId: row.characterId,
      personId: row.personId,
      note: row.note
    }))
  )
}

async function listAnimeCast(animeId: string): Promise<CastRow[]> {
  const rows = await db.query.animeCastLinks.findMany({
    where: eq(animeCastLinks.animeId, animeId),
    with: { character: true, person: true },
    orderBy: asc(animeCastLinks.createdAt)
  })
  return rows.filter((row) => row.character && row.person).map(toCastRow)
}

async function replaceAnimeCast(animeId: string, rows: CastReplaceRow[]): Promise<void> {
  await db.delete(animeCastLinks).where(eq(animeCastLinks.animeId, animeId))
  if (rows.length === 0) return

  await db.insert(animeCastLinks).values(
    rows.map((row) => ({
      id: row.id,
      animeId,
      characterId: row.characterId,
      personId: row.personId,
      note: row.note
    }))
  )
}

function toCastRow(row: {
  id: string
  characterId: string
  personId: string
  note: string | null
  character: { name: string; photoFile: string | null } | null
  person: { name: string; photoFile: string | null } | null
}): CastRow {
  return {
    id: row.id,
    characterId: row.characterId,
    characterName: row.character!.name,
    characterImage: row.character!.photoFile,
    personId: row.personId,
    personName: row.person!.name,
    personImage: row.person!.photoFile,
    note: row.note
  }
}

export const CAST_SPECS: Record<MediaType, CastSpec> = {
  game: { list: listGameCast, replace: replaceGameCast },
  anime: { list: listAnimeCast, replace: replaceAnimeCast }
}
