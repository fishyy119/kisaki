import { eq } from 'drizzle-orm'
import { gameExternalIds, gameTagLinks, games, tags } from '@shared/db'
import type { DbContext } from '@main/services/db'
import type { Tag } from '@shared/metadata'
import type { ExternalId } from '@shared/identity'
import type { GameCurrentState, UpdateCurrentSelection } from '../types'
import type { GameUpdateCoreSurface } from '@shared/ingest/update'

export function loadGameCurrent(
  tx: DbContext,
  gameId: string,
  selection: UpdateCurrentSelection<GameUpdateCoreSurface>
): GameCurrentState {
  const game = tx.select().from(games).where(eq(games.id, gameId)).limit(1).all()[0]
  if (!game) {
    throw new Error(`Game not found: ${gameId}`)
  }

  const coreSurfaces = new Set(selection.coreSurfaces)

  const externalIds: ExternalId[] = coreSurfaces.has('externalIds')
    ? tx
        .select()
        .from(gameExternalIds)
        .where(eq(gameExternalIds.gameId, gameId))
        .all()
        .map((row) => ({ source: row.source, id: row.externalId }))
    : []

  const tagsValue: Tag[] = coreSurfaces.has('tags')
    ? tx
        .select()
        .from(gameTagLinks)
        .innerJoin(tags, eq(gameTagLinks.tagId, tags.id))
        .where(eq(gameTagLinks.gameId, gameId))
        .all()
        .map((row) => ({
          name: row.tags.name,
          isNsfw: row.tags.isNsfw,
          isSpoiler: row.game_tag_links.isSpoiler,
          note: row.game_tag_links.note ?? undefined
        }))
    : []

  return {
    game,
    externalIds,
    tags: tagsValue
  }
}
