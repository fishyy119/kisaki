import { eq } from 'drizzle-orm'
import { characterExternalIds, characterTagLinks, characters, tags } from '@shared/db'
import type { DbContext } from '@main/services/db'
import type { Tag } from '@shared/metadata'
import type { ExternalId } from '@shared/identity'
import type { CharacterCurrentState, UpdateCurrentSelection } from '../types'
import type { CharacterUpdateCoreSurface } from '@shared/ingest/update'

export function loadCharacterCurrent(
  tx: DbContext,
  characterId: string,
  selection: UpdateCurrentSelection<CharacterUpdateCoreSurface>
): CharacterCurrentState {
  const character = tx
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1)
    .all()[0]
  if (!character) {
    throw new Error(`Character not found: ${characterId}`)
  }

  const coreSurfaces = new Set(selection.coreSurfaces)

  const externalIds: ExternalId[] = coreSurfaces.has('externalIds')
    ? tx
        .select()
        .from(characterExternalIds)
        .where(eq(characterExternalIds.characterId, characterId))
        .all()
        .map((row) => ({ source: row.source, id: row.externalId }))
    : []

  const tagsValue: Tag[] = coreSurfaces.has('tags')
    ? tx
        .select()
        .from(characterTagLinks)
        .innerJoin(tags, eq(characterTagLinks.tagId, tags.id))
        .where(eq(characterTagLinks.characterId, characterId))
        .all()
        .map((row) => ({
          name: row.tags.name,
          isNsfw: row.tags.isNsfw,
          isSpoiler: row.character_tag_links.isSpoiler,
          note: row.character_tag_links.note ?? undefined
        }))
    : []

  return {
    character,
    externalIds,
    tags: tagsValue
  }
}
