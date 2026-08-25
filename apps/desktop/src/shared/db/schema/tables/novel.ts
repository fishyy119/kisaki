import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, type InferInsertModel, type InferSelectModel } from 'drizzle-orm'

import { baseColumns, partialDate } from '../../columns'
import { novels } from './content'

/**
 * Readable units of a novel entry.
 *
 * One row is one volume — the layer print and web sources issue ids, covers,
 * and dates for. A whole-work single file (a web novel's one TXT) is a single
 * volume row rather than a fabricated numbering.
 */
export const novelVolumes = sqliteTable(
  'novel_volumes',
  {
    ...baseColumns,
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    /** Real-valued because side volumes ship between two numbered ones (5.5). */
    volumeNumber: real('volume_number'),
    name: text('name'),
    originalName: text('original_name'),
    releaseDate: partialDate('release_date'),
    /** Scraped blurb; not a user-editable rich-content surface. */
    description: text('description'),
    /** Volume cover from metadata, not a page render. */
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
    /**
     * Engine-scoped resume locator: an EPUB CFI, a fixed-layout page index, or
     * a text offset. Opaque to the library; only the reading engine that wrote
     * it interprets it. Null once the unit is read.
     */
    resumeLocator: text('resume_locator'),
    /** Read fraction in [0, 1] for display; the locator stays authoritative. */
    resumeProgress: real('resume_progress'),
    orderInNovel: integer('order_in_novel').notNull().default(0)
  },
  (t) => [
    index('idx_novel_volumes_novel_id').on(t.novelId),
    index('idx_novel_volumes_novel_id_order').on(t.novelId, t.orderInNovel),
    /** Numbered volumes are unique per entry; unnumbered rows may repeat. */
    uniqueIndex('unique_novel_volumes_number')
      .on(t.novelId, t.volumeNumber)
      .where(sql`volume_number IS NOT NULL`)
  ]
)

export type NovelVolume = InferSelectModel<typeof novelVolumes>
export type NewNovelVolume = InferInsertModel<typeof novelVolumes>

/**
 * Readable files for one novel volume.
 *
 * One volume legitimately owns several files: an EPUB and its TXT source
 * coexist as sibling versions.
 */
export const novelVolumeFiles = sqliteTable(
  'novel_volume_files',
  {
    ...baseColumns,
    volumeId: text('volume_id')
      .notNull()
      .references(() => novelVolumes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    path: text('path').notNull().unique(),
    fileSize: integer('file_size'),
    fileMtime: integer('file_mtime', { mode: 'timestamp_ms' }),
    /** Container kind as probed: epub, mobi, azw3, fb2, txt, pdf. */
    container: text('container'),
    /** Preferred file of the volume; ties break on insertion order. */
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    /**
     * Row owned by the user instead of file sync. Manual rows may live outside
     * the novel directory, keep their volume assignment, and never get deleted
     * or retargeted by a sync pass.
     */
    isManual: integer('is_manual', { mode: 'boolean' }).notNull().default(false),
    note: text('note')
  },
  (t) => [
    index('idx_novel_volume_files_volume_id').on(t.volumeId),
    /** At most one primary file per volume. */
    uniqueIndex('unique_novel_volume_files_primary')
      .on(t.volumeId)
      .where(sql`is_primary = 1`)
  ]
)

export type NovelVolumeFile = InferSelectModel<typeof novelVolumeFiles>
export type NewNovelVolumeFile = InferInsertModel<typeof novelVolumeFiles>

export const novelSessions = sqliteTable(
  'novel_sessions',
  {
    ...baseColumns,
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    volumeId: text('volume_id').references(() => novelVolumes.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    index('idx_novel_sessions_novel_id').on(t.novelId),
    index('idx_novel_sessions_volume_id').on(t.volumeId),
    index('idx_novel_sessions_started_at').on(t.startedAt)
  ]
)

export type NovelSession = InferSelectModel<typeof novelSessions>
export type NewNovelSession = InferInsertModel<typeof novelSessions>
