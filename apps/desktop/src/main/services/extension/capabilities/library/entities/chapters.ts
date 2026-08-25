import type {
  ExternalId,
  LibraryComicChapter,
  LibraryComicChapterCreateInput,
  LibraryComicChapterQuery,
  LibraryComicChapterReadStatePatch
} from '@kisaki3/extension-api'
import {
  createNotFoundError,
  createValidationError,
  ensureNonEmptyString,
  normalizeCapabilityError
} from '@kisaki3/extension-api'
import { and, asc, eq, isNull, type SQL } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { comicChapterExternalIds, comicChapters, comics } from '@shared/db'
import { isSameChapterAcrossVolumeKnowledge } from '@shared/metadata'
import type { DbService } from '@main/services/db'
import { loadExternalIds, syncExternalIds } from './external-ids'
import type { ExternalIdConfig } from './types'
import { optionalValue, stripUndefined, toNullableTimestampMs, toTimestampMs } from './utils'

const CHAPTER_EXTERNAL_IDS_CONFIG = {
  table: comicChapterExternalIds,
  entityIdColumn: comicChapterExternalIds.chapterId,
  sourceColumn: comicChapterExternalIds.source,
  externalIdColumn: comicChapterExternalIds.externalId,
  orderColumn: comicChapterExternalIds.orderInChapter,
  toEntityId(row) {
    return row.chapterId
  },
  toExternalId(row) {
    return { source: row.source, id: row.externalId }
  },
  buildInsertValue(entityId, externalId, order) {
    return {
      chapterId: entityId,
      source: externalId.source,
      externalId: externalId.id,
      orderInChapter: order
    }
  }
} satisfies ExternalIdConfig<typeof comicChapterExternalIds>

export interface ExtensionLibraryComicChapterStoreOptions {
  db: DbService
}

/**
 * Comic units are owned by their comic entry rather than being a library
 * entity type: every read and write is addressed through a comic id, and
 * identity is resolved by external id first, unit number second.
 */
export class ExtensionLibraryComicChapterStore {
  constructor(private readonly options: ExtensionLibraryComicChapterStoreOptions) {}

  list(query: LibraryComicChapterQuery): readonly LibraryComicChapter[] {
    ensureNonEmptyString(query.comicId, 'library comic id')

    try {
      const conditions: SQL[] = [eq(comicChapters.comicId, query.comicId)]
      if (query.finishedOnly) {
        conditions.push(eq(comicChapters.read, true))
      }
      if (query.unreadOnly) {
        conditions.push(eq(comicChapters.read, false))
      }

      const rows = this.options.db.client
        .select()
        .from(comicChapters)
        .where(and(...conditions))
        .orderBy(asc(comicChapters.orderInComic), asc(comicChapters.createdAt))
        .all()

      const externalIds = loadExternalIds(
        this.options.db.client,
        CHAPTER_EXTERNAL_IDS_CONFIG,
        rows.map((row) => row.id)
      )
      return rows.map((row) => toChapterDto(row, externalIds.get(row.id) ?? []))
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list the comic units.')
    }
  }

  get(chapterId: string): LibraryComicChapter | null {
    ensureNonEmptyString(chapterId, 'library comic unit id')

    try {
      const row = this.options.db.client
        .select()
        .from(comicChapters)
        .where(eq(comicChapters.id, chapterId))
        .get()
      if (!row) {
        return null
      }

      const externalIds =
        loadExternalIds(this.options.db.client, CHAPTER_EXTERNAL_IDS_CONFIG, [chapterId]).get(
          chapterId
        ) ?? []
      return toChapterDto(row, externalIds)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to read the comic unit.')
    }
  }

  create(comicId: string, input: LibraryComicChapterCreateInput): LibraryComicChapter {
    ensureNonEmptyString(comicId, 'library comic id')

    try {
      const id = nanoid()
      this.options.db.client.transaction((tx) => {
        const owner = tx.select({ id: comics.id }).from(comics).where(eq(comics.id, comicId)).get()
        if (!owner) {
          throw createNotFoundError(`Library comic "${comicId}" was not found.`)
        }

        tx.insert(comicChapters)
          .values({
            id,
            comicId,
            volumeNumber: input.volumeNumber,
            chapterNumber: input.chapterNumber,
            name: input.name,
            originalName: input.originalName,
            releaseDate: input.releaseDate,
            description: input.description,
            orderInComic: input.order
          })
          .run()
        syncExternalIds(tx, CHAPTER_EXTERNAL_IDS_CONFIG, id, input.externalIds)
      })

      return this.require(id)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to create the comic unit.')
    }
  }

  /**
   * The create input doubles as the patch shape: units have no create-only
   * fields, and `stripUndefined` below skips every absent field, so an update
   * merges rather than replaces.
   */
  update(chapterId: string, input: LibraryComicChapterCreateInput): LibraryComicChapter {
    ensureNonEmptyString(chapterId, 'library comic unit id')

    try {
      this.options.db.client.transaction((tx) => {
        const existing = tx
          .select({ id: comicChapters.id })
          .from(comicChapters)
          .where(eq(comicChapters.id, chapterId))
          .get()
        if (!existing) {
          throw createNotFoundError(`Library comic unit "${chapterId}" was not found.`)
        }

        const values = stripUndefined({
          volumeNumber: input.volumeNumber,
          chapterNumber: input.chapterNumber,
          name: input.name,
          originalName: input.originalName,
          releaseDate: input.releaseDate,
          description: input.description,
          orderInComic: input.order
        })
        if (Object.keys(values).length > 0) {
          tx.update(comicChapters).set(values).where(eq(comicChapters.id, chapterId)).run()
        }

        if (input.externalIds) {
          syncExternalIds(tx, CHAPTER_EXTERNAL_IDS_CONFIG, chapterId, input.externalIds)
        }
      })

      return this.require(chapterId)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the comic unit.')
    }
  }

  /**
   * Patches one unit's read state.
   *
   * Reading evidence never outlives the state it proves: clearing `read`
   * drops the recorded time too, and asking for a read time on an unread unit
   * is a contradiction rather than a state to store.
   */
  patchReadState(chapterId: string, patch: LibraryComicChapterReadStatePatch): LibraryComicChapter {
    ensureNonEmptyString(chapterId, 'library comic unit id')

    try {
      const values = stripUndefined({
        read: patch.read,
        readAt:
          patch.readAt === undefined
            ? undefined
            : patch.readAt === null
              ? null
              : new Date(patch.readAt),
        readCount: patch.readCount,
        resumePage: patch.resumePage
      })

      const existing = this.options.db.client
        .select({
          id: comicChapters.id,
          read: comicChapters.read,
          readAt: comicChapters.readAt
        })
        .from(comicChapters)
        .where(eq(comicChapters.id, chapterId))
        .get()
      if (!existing) {
        throw createNotFoundError(`Library comic unit "${chapterId}" was not found.`)
      }

      const read = patch.read ?? existing.read
      if (!read) {
        if (values.readAt) {
          throw createValidationError(
            `Library comic unit "${chapterId}" cannot take a read time while not read.`
          )
        }
        if (existing.readAt !== null) {
          values.readAt = null
        }
      }

      if (Object.keys(values).length > 0) {
        this.options.db.client
          .update(comicChapters)
          .set(values)
          .where(eq(comicChapters.id, chapterId))
          .run()
      }

      return this.require(chapterId)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the comic unit read state.')
    }
  }

  remove(chapterId: string): void {
    ensureNonEmptyString(chapterId, 'library comic unit id')

    try {
      this.options.db.client.delete(comicChapters).where(eq(comicChapters.id, chapterId)).run()
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the comic unit.')
    }
  }

  /**
   * Resolves an incoming unit to an existing row.
   *
   * External id first, then the unit's full numbering, then one looser pass
   * for a chapter whose volume the caller learned or forgot — see
   * {@link isSameChapterAcrossVolumeKnowledge}. The looser pass only claims an
   * unambiguous single candidate, so per-volume numbering never cross-matches.
   */
  findMatch(
    comicId: string,
    input: Pick<LibraryComicChapterCreateInput, 'externalIds' | 'volumeNumber' | 'chapterNumber'>
  ): LibraryComicChapter | null {
    for (const externalId of input.externalIds ?? []) {
      const row = this.options.db.client
        .select({ chapterId: comicChapterExternalIds.chapterId })
        .from(comicChapterExternalIds)
        .innerJoin(comicChapters, eq(comicChapters.id, comicChapterExternalIds.chapterId))
        .where(
          and(
            eq(comicChapters.comicId, comicId),
            eq(comicChapterExternalIds.source, externalId.source),
            eq(comicChapterExternalIds.externalId, externalId.id)
          )
        )
        .get()
      if (row) {
        return this.get(row.chapterId)
      }
    }

    if (input.chapterNumber !== undefined && input.chapterNumber !== null) {
      return this.findChapterGrainMatch(comicId, input.chapterNumber, input.volumeNumber ?? null)
    }

    if (input.volumeNumber !== undefined && input.volumeNumber !== null) {
      const row = this.options.db.client
        .select({ id: comicChapters.id })
        .from(comicChapters)
        .where(
          and(
            eq(comicChapters.comicId, comicId),
            isNull(comicChapters.chapterNumber),
            eq(comicChapters.volumeNumber, input.volumeNumber)
          )
        )
        .get()
      return row ? this.get(row.id) : null
    }

    return null
  }

  /** Exact numbering first, then the volume-knowledge pass; see `findMatch`. */
  private findChapterGrainMatch(
    comicId: string,
    chapterNumber: number,
    volumeNumber: number | null
  ): LibraryComicChapter | null {
    const rows = this.options.db.client
      .select({
        id: comicChapters.id,
        volumeNumber: comicChapters.volumeNumber,
        chapterNumber: comicChapters.chapterNumber
      })
      .from(comicChapters)
      .where(
        and(eq(comicChapters.comicId, comicId), eq(comicChapters.chapterNumber, chapterNumber))
      )
      .all()

    const exact = rows.find((row) => row.volumeNumber === volumeNumber)
    if (exact) return this.get(exact.id)

    const looser = rows.filter((row) =>
      isSameChapterAcrossVolumeKnowledge({ volumeNumber, chapterNumber }, row)
    )
    return looser.length === 1 ? this.get(looser[0].id) : null
  }

  private require(chapterId: string): LibraryComicChapter {
    const chapter = this.get(chapterId)
    if (!chapter) {
      throw createNotFoundError(`Library comic unit "${chapterId}" was not found.`)
    }

    return chapter
  }
}

function toChapterDto(
  row: typeof comicChapters.$inferSelect,
  externalIds: readonly ExternalId[]
): LibraryComicChapter {
  return {
    id: row.id,
    comicId: row.comicId,
    volumeNumber: row.volumeNumber,
    chapterNumber: row.chapterNumber,
    name: optionalValue(row.name),
    originalName: optionalValue(row.originalName),
    releaseDate: optionalValue(row.releaseDate),
    description: optionalValue(row.description),
    coverFile: optionalValue(row.coverFile),
    read: row.read,
    readAt: toNullableTimestampMs(row.readAt),
    readCount: row.readCount,
    resumePage: row.resumePage,
    orderInComic: row.orderInComic,
    externalIds,
    createdAt: toTimestampMs(row.createdAt),
    updatedAt: toTimestampMs(row.updatedAt)
  }
}
