import type {
  LibraryEntityReference,
  LibraryMediaRelation,
  LibraryMediaRelationCreateInput,
  LibraryMediaRelationPatch,
  LibraryMediaRelationQuery,
  LibraryMediaRelationSelector,
  LibraryMediaType
} from '@kisaki3/extension-api'
import { createNotFoundError, normalizeCapabilityError } from '@kisaki3/extension-api'
import { and, eq, or, type SQL } from 'drizzle-orm'
import { newId } from '@shared/id'
import { animes, comics, games, mediaRelations, novels, type MediaRelation } from '@shared/db'
import type { DbService } from '@main/services/db'

export interface ExtensionLibraryMediaRelationStoreOptions {
  db: DbService
}

/**
 * Extension-facing CRUD over `media_relations`.
 *
 * Rows are directed edges; an extension manages the edges it writes, and
 * readers merge both directions through the inverse vocabulary. Endpoint pair
 * and vocabulary validity are enforced by the shared validators at the RPC
 * boundary; endpoint existence is verified here on create, because the table
 * carries no foreign keys and this is the only write path whose targets are
 * not already resolved from the library.
 */
export class ExtensionLibraryMediaRelationStore {
  constructor(private readonly options: ExtensionLibraryMediaRelationStoreOptions) {}

  list(query?: LibraryMediaRelationQuery): readonly LibraryMediaRelation[] {
    try {
      const condition = buildListCondition(query)
      const rows = condition
        ? this.options.db.client.select().from(mediaRelations).where(condition).all()
        : this.options.db.client.select().from(mediaRelations).all()

      return rows.map(toRelation)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list library media relations.')
    }
  }

  create(input: LibraryMediaRelationCreateInput): LibraryMediaRelation {
    try {
      this.requireMediaEntryExists(input.from)
      this.requireMediaEntryExists(input.to)

      this.options.db.client
        .insert(mediaRelations)
        .values({
          id: newId(),
          fromType: input.from.entityType,
          fromId: input.from.id,
          toType: input.to.entityType,
          toId: input.to.id,
          type: input.type,
          note: input.note ?? null,
          orderInFrom: input.order ?? 0
        })
        .run()

      return toRelation(this.selectOne(input))
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to create the library media relation.')
    }
  }

  update(
    selector: LibraryMediaRelationSelector,
    patch: LibraryMediaRelationPatch
  ): LibraryMediaRelation {
    try {
      const existing = this.selectOne(selector)

      const values: Partial<MediaRelation> = {}
      if (patch.type !== undefined) values.type = patch.type
      if (patch.note !== undefined) values.note = patch.note ?? null
      if (patch.order !== undefined) values.orderInFrom = patch.order

      if (Object.keys(values).length === 0) {
        return toRelation(existing)
      }

      this.options.db.client
        .update(mediaRelations)
        .set(values)
        .where(buildSelectorCondition(selector))
        .run()

      const updatedSelector =
        patch.type !== undefined ? { ...selector, type: patch.type } : selector
      return toRelation(this.selectOne(updatedSelector))
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the library media relation.')
    }
  }

  remove(selector: LibraryMediaRelationSelector): void {
    try {
      this.selectOne(selector)
      this.options.db.client.delete(mediaRelations).where(buildSelectorCondition(selector)).run()
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the library media relation.')
    }
  }

  private requireMediaEntryExists(reference: LibraryEntityReference<LibraryMediaType>): void {
    if (this.findMediaEntryId(reference) === undefined) {
      throw createNotFoundError(
        `Library ${reference.entityType} entry "${reference.id}" was not found.`
      )
    }
  }

  private findMediaEntryId(
    reference: LibraryEntityReference<LibraryMediaType>
  ): string | undefined {
    switch (reference.entityType) {
      case 'game':
        return this.options.db.client
          .select({ id: games.id })
          .from(games)
          .where(eq(games.id, reference.id))
          .get()?.id
      case 'anime':
        return this.options.db.client
          .select({ id: animes.id })
          .from(animes)
          .where(eq(animes.id, reference.id))
          .get()?.id
      case 'comic':
        return this.options.db.client
          .select({ id: comics.id })
          .from(comics)
          .where(eq(comics.id, reference.id))
          .get()?.id
      case 'novel':
        return this.options.db.client
          .select({ id: novels.id })
          .from(novels)
          .where(eq(novels.id, reference.id))
          .get()?.id
    }
  }

  private selectOne(selector: LibraryMediaRelationSelector): MediaRelation {
    const row = this.options.db.client
      .select()
      .from(mediaRelations)
      .where(buildSelectorCondition(selector))
      .get()

    if (!row) {
      throw createNotFoundError('Library media relation was not found.')
    }

    return row
  }
}

function buildSelectorCondition(selector: LibraryMediaRelationSelector): SQL {
  return and(
    eq(mediaRelations.fromType, selector.from.entityType),
    eq(mediaRelations.fromId, selector.from.id),
    eq(mediaRelations.toType, selector.to.entityType),
    eq(mediaRelations.toId, selector.to.id),
    eq(mediaRelations.type, selector.type)
  ) as SQL
}

function buildListCondition(query: LibraryMediaRelationQuery | undefined): SQL | undefined {
  if (!query) {
    return undefined
  }

  const conditions: SQL[] = []

  if (query.entity) {
    conditions.push(endpointCondition(query.entity.entityType, query.entity.id))
  }
  if (query.relatedEntity) {
    conditions.push(endpointCondition(query.relatedEntity.entityType, query.relatedEntity.id))
  }

  if (conditions.length === 0) {
    return undefined
  }
  return conditions.length === 1 ? conditions[0] : (and(...conditions) as SQL)
}

function endpointCondition(mediaType: MediaRelation['fromType'], id: string): SQL {
  return or(
    and(eq(mediaRelations.fromType, mediaType), eq(mediaRelations.fromId, id)),
    and(eq(mediaRelations.toType, mediaType), eq(mediaRelations.toId, id))
  ) as SQL
}

function toRelation(row: MediaRelation): LibraryMediaRelation {
  return {
    from: { entityType: row.fromType, id: row.fromId },
    to: { entityType: row.toType, id: row.toId },
    type: row.type,
    ...(row.note !== null && { note: row.note }),
    order: row.orderInFrom,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime()
  }
}
