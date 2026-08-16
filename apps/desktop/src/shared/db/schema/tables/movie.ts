import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, type InferInsertModel, type InferSelectModel } from 'drizzle-orm'

import { audioTracks, baseColumns, movieExtraType, subtitleTracks } from '../../columns'
import { movies } from './content'

/**
 * Playable files for one movie.
 *
 * A film has one consumption unit but many releases: theatrical and director's
 * cuts, remuxes, and re-encodes coexist as sibling rows under the same entry,
 * which is why files hang off the entry instead of being a column on it.
 */
export const movieFiles = sqliteTable(
  'movie_files',
  {
    ...baseColumns,
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    path: text('path').notNull().unique(),
    /** Distinguishes the releases of one film, e.g. "Director's Cut". */
    edition: text('edition'),
    fileSize: integer('file_size'),
    fileMtime: integer('file_mtime', { mode: 'timestamp_ms' }),
    container: text('container'),
    videoCodec: text('video_codec'),
    bitDepth: integer('bit_depth'),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    audioTracks: audioTracks('audio_tracks').notNull().default([]),
    subtitleTracks: subtitleTracks('subtitle_tracks').notNull().default([]),
    /** Preferred file of the movie; ties break on insertion order. */
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    /**
     * Row owned by the user instead of file sync. Manual rows may live outside
     * the movie directory, keep their entry assignment, and never get deleted
     * or retargeted by a sync pass.
     */
    isManual: integer('is_manual', { mode: 'boolean' }).notNull().default(false),
    note: text('note')
  },
  (t) => [
    index('idx_movie_files_movie_id').on(t.movieId),
    /** At most one primary file per movie. */
    uniqueIndex('unique_movie_files_primary')
      .on(t.movieId)
      .where(sql`is_primary = 1`)
  ]
)

export type MovieFile = InferSelectModel<typeof movieFiles>
export type NewMovieFile = InferInsertModel<typeof movieFiles>

/**
 * Supplementary assets (trailers, deleted scenes) that carry no watch state.
 * Playable files live in `movie_extra_files`, mirroring the main file layer.
 */
export const movieExtras = sqliteTable(
  'movie_extras',
  {
    ...baseColumns,
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    type: movieExtraType('type').notNull().default('other'),
    name: text('name').notNull(),
    orderInMovie: integer('order_in_movie').notNull().default(0),
    /**
     * Row owned by the user instead of file sync. Manual rows keep their name
     * and type and never get rewritten or deleted by a sync pass.
     */
    isManual: integer('is_manual', { mode: 'boolean' }).notNull().default(false)
  },
  (t) => [index('idx_movie_extras_movie_id').on(t.movieId)]
)

export type MovieExtra = InferSelectModel<typeof movieExtras>
export type NewMovieExtra = InferInsertModel<typeof movieExtras>

/**
 * Playable files for one extra, mirroring `movie_files`: alternate versions of
 * the same asset coexist as sibling rows.
 */
export const movieExtraFiles = sqliteTable(
  'movie_extra_files',
  {
    ...baseColumns,
    extraId: text('extra_id')
      .notNull()
      .references(() => movieExtras.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    path: text('path').notNull().unique(),
    fileSize: integer('file_size'),
    fileMtime: integer('file_mtime', { mode: 'timestamp_ms' }),
    container: text('container'),
    videoCodec: text('video_codec'),
    bitDepth: integer('bit_depth'),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    audioTracks: audioTracks('audio_tracks').notNull().default([]),
    subtitleTracks: subtitleTracks('subtitle_tracks').notNull().default([]),
    /** Preferred file of the extra; ties break on insertion order. */
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    /**
     * Row owned by the user instead of file sync. Manual rows may live outside
     * the movie directory, keep their extra assignment, and never get deleted
     * or retargeted by a sync pass.
     */
    isManual: integer('is_manual', { mode: 'boolean' }).notNull().default(false),
    note: text('note')
  },
  (t) => [
    index('idx_movie_extra_files_extra_id').on(t.extraId),
    /** At most one primary file per extra. */
    uniqueIndex('unique_movie_extra_files_primary')
      .on(t.extraId)
      .where(sql`is_primary = 1`)
  ]
)

export type MovieExtraFile = InferSelectModel<typeof movieExtraFiles>
export type NewMovieExtraFile = InferInsertModel<typeof movieExtraFiles>

export const movieSessions = sqliteTable(
  'movie_sessions',
  {
    ...baseColumns,
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    index('idx_movie_sessions_movie_id').on(t.movieId),
    index('idx_movie_sessions_started_at').on(t.startedAt)
  ]
)

export type MovieSession = InferSelectModel<typeof movieSessions>
export type NewMovieSession = InferInsertModel<typeof movieSessions>
