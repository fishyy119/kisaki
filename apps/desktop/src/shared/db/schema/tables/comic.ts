import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, type InferInsertModel, type InferSelectModel } from 'drizzle-orm'

import { baseColumns, partialDate } from '../../columns'
import { comics } from './content'

/**
 * Readable units of a comic entry.
 *
 * One row is one installment a user reads and finishes: a collected volume or
 * a serialized chapter. The dual numbers cover both storage idioms — a volume
 * archive carries only `volumeNumber`, a chapter release carries
 * `chapterNumber` (plus its volume when known) — so neither library layout has
 * to fake the other's grain. Numbers are real-valued because extras are
 * published between two regular installments (chapter 42.5).
 *
 * A chapter's identity is its full numbering, not the chapter number alone:
 * magazine serialization numbers chapters continuously, but works collected
 * straight to volumes restart at chapter 1 in every volume, and both must fit.
 */
export const comicChapters = sqliteTable(
  'comic_chapters',
  {
    ...baseColumns,
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    /** Collected-volume number; the only number a volume archive carries. */
    volumeNumber: real('volume_number'),
    /** Serialized-chapter number; null for volume-grained rows. */
    chapterNumber: real('chapter_number'),
    name: text('name'),
    originalName: text('original_name'),
    releaseDate: partialDate('release_date'),
    /** Scraped blurb; not a user-editable rich-content surface. */
    description: text('description'),
    /** Volume cover from metadata (tankobon art), not a page render. */
    coverFile: text('cover_file'),
    /** Authoritative read state; every marking path owns this column. */
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    /**
     * Completion time of the last full read. Manual and imported marks leave
     * it null: they know the state without knowing a time, so a set `read`
     * with a null `readAt` is normal rather than inconsistent.
     */
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    readCount: integer('read_count').notNull().default(0),
    /** Zero-based page index to resume at; null once the unit is read. */
    resumePage: integer('resume_page'),
    orderInComic: integer('order_in_comic').notNull().default(0)
  },
  (t) => [
    index('idx_comic_chapters_comic_id').on(t.comicId),
    index('idx_comic_chapters_comic_id_order').on(t.comicId, t.orderInComic),
    /**
     * Chapter-grained rows are unique per entry by their full numbering.
     *
     * Split in two because SQLite counts NULLs in a unique index as distinct,
     * which alone would let volume-less chapter 5 repeat: the first index
     * scopes numbering to its volume, the second guards the rows that state no
     * volume. Together they enforce exactly what `comicUnitIdentityKey`
     * computes — a key the application reads as new but an index reads as
     * taken aborts the whole write.
     */
    uniqueIndex('unique_comic_chapters_numbering_in_volume')
      .on(t.comicId, t.volumeNumber, t.chapterNumber)
      .where(sql`chapter_number IS NOT NULL AND volume_number IS NOT NULL`),
    uniqueIndex('unique_comic_chapters_numbering_no_volume')
      .on(t.comicId, t.chapterNumber)
      .where(sql`chapter_number IS NOT NULL AND volume_number IS NULL`),
    /** Volume-grained rows are unique per entry by volume number; unnumbered rows may repeat. */
    uniqueIndex('unique_comic_chapters_volume_number')
      .on(t.comicId, t.volumeNumber)
      .where(sql`chapter_number IS NULL AND volume_number IS NOT NULL`)
  ]
)

export type ComicChapter = InferSelectModel<typeof comicChapters>
export type NewComicChapter = InferInsertModel<typeof comicChapters>

/**
 * Readable files for one comic unit.
 *
 * One unit legitimately owns several files: a raw scan and a cleaned release
 * coexist, and a corrected version replaces neither.
 */
export const comicChapterFiles = sqliteTable(
  'comic_chapter_files',
  {
    ...baseColumns,
    chapterId: text('chapter_id')
      .notNull()
      .references(() => comicChapters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    path: text('path').notNull().unique(),
    fileSize: integer('file_size'),
    fileMtime: integer('file_mtime', { mode: 'timestamp_ms' }),
    /** Container kind as probed: zip, rar, directory, pdf. */
    container: text('container'),
    pageCount: integer('page_count'),
    /** Preferred file of the unit; ties break on insertion order. */
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    /**
     * Row owned by the user instead of file sync. Manual rows may live outside
     * the comic directory, keep their unit assignment, and never get deleted
     * or retargeted by a sync pass.
     */
    isManual: integer('is_manual', { mode: 'boolean' }).notNull().default(false),
    note: text('note')
  },
  (t) => [
    index('idx_comic_chapter_files_chapter_id').on(t.chapterId),
    /** At most one primary file per unit. */
    uniqueIndex('unique_comic_chapter_files_primary')
      .on(t.chapterId)
      .where(sql`is_primary = 1`)
  ]
)

export type ComicChapterFile = InferSelectModel<typeof comicChapterFiles>
export type NewComicChapterFile = InferInsertModel<typeof comicChapterFiles>

export const comicSessions = sqliteTable(
  'comic_sessions',
  {
    ...baseColumns,
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    chapterId: text('chapter_id').references(() => comicChapters.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    index('idx_comic_sessions_comic_id').on(t.comicId),
    index('idx_comic_sessions_chapter_id').on(t.chapterId),
    index('idx_comic_sessions_started_at').on(t.startedAt)
  ]
)

export type ComicSession = InferSelectModel<typeof comicSessions>
export type NewComicSession = InferInsertModel<typeof comicSessions>
