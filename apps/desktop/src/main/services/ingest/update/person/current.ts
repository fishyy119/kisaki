import { eq } from 'drizzle-orm'
import { personExternalIds, persons, personTagLinks, tags } from '@shared/db'
import type { DbContext } from '@main/services/db'
import type { Tag } from '@shared/metadata'
import type { ExternalId } from '@shared/identity'
import type { PersonCurrentState } from './types'
import type { UpdateCurrentSelection } from '../types'
import type { PersonUpdateCoreSurface } from '@shared/ingest/update'

export function loadPersonCurrent(
  tx: DbContext,
  personId: string,
  selection: UpdateCurrentSelection<PersonUpdateCoreSurface>
): PersonCurrentState {
  const person = tx.select().from(persons).where(eq(persons.id, personId)).limit(1).all()[0]
  if (!person) {
    throw new Error(`Person not found: ${personId}`)
  }

  const coreSurfaces = new Set(selection.coreSurfaces)

  const externalIds: ExternalId[] = coreSurfaces.has('externalIds')
    ? tx
        .select()
        .from(personExternalIds)
        .where(eq(personExternalIds.personId, personId))
        .all()
        .map((row) => ({ source: row.source, id: row.externalId }))
    : []

  const tagsValue: Tag[] = coreSurfaces.has('tags')
    ? tx
        .select()
        .from(personTagLinks)
        .innerJoin(tags, eq(personTagLinks.tagId, tags.id))
        .where(eq(personTagLinks.personId, personId))
        .all()
        .map((row) => ({
          name: row.tags.name,
          isNsfw: row.tags.isNsfw,
          isSpoiler: row.person_tag_links.isSpoiler,
          note: row.person_tag_links.note ?? undefined
        }))
    : []

  return {
    person,
    externalIds,
    tags: tagsValue
  }
}
