import type {
  LibraryMediaRelation,
  LibraryMediaRelationCreateInput,
  LibraryMediaRelationPatch,
  LibraryMediaRelationQuery,
  LibraryMediaRelationSelector
} from '@kisaki3/extension-api'
import { createNotFoundError, normalizeCapabilityError } from '@kisaki3/extension-api'
import { and, eq, or, type SQL } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { mediaRelations, type MediaRelation } from '@shared/db'
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
 * boundary.
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
      this.options.db.client
        .insert(mediaRelations)
        .values({
          id: nanoid(),
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

      const updatedSelector = patch.type !== undefined ? { ...selector, type: patch.type } : selector
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
