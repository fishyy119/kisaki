import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, type InferInsertModel, type InferSelectModel } from 'drizzle-orm'

import { audioTracks, baseColumns, partialDate, subtitleTracks, tvExtraType } from '../../columns'
import { tvs } from './content'

/**
 * One season of a show.
 *
 * Seasons are weak child rows: they carry the facts some ecosystems publish per
 * season (poster, air date, anthology title) but never own tracking state,
 * ratings, or user data, which all sit on the show entry. Season 0 is the
 * industry's own encoding for specials.
 */
export const tvSeasons = sqliteTable(
  'tv_seasons',
  {
    ...baseColumns,
    tvId: text('tv_id')
      .notNull()
      .references(() => tvs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    /** Season 0 holds specials; regular seasons start at 1. */
    seasonNumber: integer('season_number').notNull(),
    /** Most seasons carry no title of their own; anthologies do. */
    name: text('name'),
    originalName: text('original_name'),
    airDate: partialDate('air_date'),
    /** Scraped synopsis; not a user-editable rich-content surface. */
    description: text('description'),
    posterFile: text('poster_file'),
    /** Episode count declared by metadata; the episode rows remain authoritative. */
    totalEpisodes: integer('total_episodes'),
    orderInTv: integer('order_in_tv').notNull().default(0)
  },
  (t) => [
    index('idx_tv_seasons_tv_id').on(t.tvId),
    index('idx_tv_seasons_tv_id_order').on(t.tvId, t.orderInTv),
    uniqueIndex('unique_tv_seasons_number').on(t.tvId, t.seasonNumber)
  ]
)

export type TvSeason = InferSelectModel<typeof tvSeasons>
export type NewTvSeason = InferInsertModel<typeof tvSeasons>

/**
 * One episode of a show.
 *
 * `tvId` is denormalized alongside `seasonId` so entry-level mechanics (change
 * feed owner columns, delete, merge, watch queries) address episodes without
 * joining through the season.
 */
export const tvEpisodes = sqliteTable(
  'tv_episodes',
  {
    ...baseColumns,
    tvId: text('tv_id')
      .notNull()
      .references(() => tvs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    seasonId: text('season_id')
      .notNull()
      .references(() => tvSeasons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    /** Integer because `SxxEyy` is the industry's own encoding; specials are season 0. */
    episodeNumber: integer('episode_number'),
    name: text('name'),
    originalName: text('original_name'),
    airDate: partialDate('air_date'),
    /** Scraped synopsis; not a user-editable rich-content surface. */
    description: text('description'),
    stillFile: text('still_file'),
    durationMs: integer('duration_ms'),
    /** Authoritative watch state; every marking path owns this column. */
    watched: integer('watched', { mode: 'boolean' }).notNull().default(false),
    /**
     * Completion time of the last full playback. Manual and imported marks
     * leave it null: they know the state without knowing a time, so a set
     * `watched` with a null `watchedAt` is normal rather than inconsistent.
     */
    watchedAt: integer('watched_at', { mode: 'timestamp_ms' }),
    playCount: integer('play_count').notNull().default(0),
    resumePositionMs: integer('resume_position_ms'),
    orderInSeason: integer('order_in_season').notNull().default(0),
    orderInTv: integer('order_in_tv').notNull().default(0)
  },
  (t) => [
    index('idx_tv_episodes_tv_id').on(t.tvId),
    index('idx_tv_episodes_season_id').on(t.seasonId),
    index('idx_tv_episodes_tv_id_order').on(t.tvId, t.orderInTv),
    index('idx_tv_episodes_season_id_order').on(t.seasonId, t.orderInSeason),
    /** Numbered episodes are unique per season; unnumbered rows may repeat. */
    uniqueIndex('unique_tv_episodes_number')
      .on(t.seasonId, t.episodeNumber)
      .where(sql`episode_number IS NOT NULL`)
  ]
)

export type TvEpisode = InferSelectModel<typeof tvEpisodes>
export type NewTvEpisode = InferInsertModel<typeof tvEpisodes>

/**
 * Playable files for one episode.
 *
 * One episode legitimately owns several files: broadcast and disc releases
 * coexist, and a corrected release replaces neither.
 */
export const tvEpisodeFiles = sqliteTable(
  'tv_episode_files',
  {
    ...baseColumns,
    episodeId: text('episode_id')
      .notNull()
      .references(() => tvEpisodes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
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
    /** Preferred file of the episode; ties break on insertion order. */
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    /**
     * Row owned by the user instead of file sync. Manual rows may live outside
     * the show directory, keep their episode assignment, and never get deleted
     * or retargeted by a sync pass.
     */
    isManual: integer('is_manual', { mode: 'boolean' }).notNull().default(false),
    note: text('note')
  },
  (t) => [
    index('idx_tv_episode_files_episode_id').on(t.episodeId),
    /** At most one primary file per episode. */
    uniqueIndex('unique_tv_episode_files_primary')
      .on(t.episodeId)
      .where(sql`is_primary = 1`)
  ]
)

export type TvEpisodeFile = InferSelectModel<typeof tvEpisodeFiles>
export type NewTvEpisodeFile = InferInsertModel<typeof tvEpisodeFiles>

/**
 * Supplementary assets (trailers, behind-the-scenes) that carry no watch
 * state. Playable files live in `tv_extra_files`, mirroring the episode file
 * layer.
 */
export const tvExtras = sqliteTable(
  'tv_extras',
  {
    ...baseColumns,
    tvId: text('tv_id')
      .notNull()
      .references(() => tvs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    type: tvExtraType('type').notNull().default('other'),
    name: text('name').notNull(),
    orderInTv: integer('order_in_tv').notNull().default(0),
    /**
     * Row owned by the user instead of file sync. Manual rows keep their name
     * and type and never get rewritten or deleted by a sync pass.
     */
    isManual: integer('is_manual', { mode: 'boolean' }).notNull().default(false)
  },
  (t) => [index('idx_tv_extras_tv_id').on(t.tvId)]
)

export type TvExtra = InferSelectModel<typeof tvExtras>
export type NewTvExtra = InferInsertModel<typeof tvExtras>

/**
 * Playable files for one extra, mirroring `tv_episode_files`: alternate
 * versions of the same asset coexist as sibling rows.
 */
export const tvExtraFiles = sqliteTable(
  'tv_extra_files',
  {
    ...baseColumns,
    extraId: text('extra_id')
      .notNull()
      .references(() => tvExtras.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
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
     * the show directory, keep their extra assignment, and never get deleted
     * or retargeted by a sync pass.
     */
    isManual: integer('is_manual', { mode: 'boolean' }).notNull().default(false),
    note: text('note')
  },
  (t) => [
    index('idx_tv_extra_files_extra_id').on(t.extraId),
    /** At most one primary file per extra. */
    uniqueIndex('unique_tv_extra_files_primary')
      .on(t.extraId)
      .where(sql`is_primary = 1`)
  ]
)

export type TvExtraFile = InferSelectModel<typeof tvExtraFiles>
export type NewTvExtraFile = InferInsertModel<typeof tvExtraFiles>

export const tvSessions = sqliteTable(
  'tv_sessions',
  {
    ...baseColumns,
    tvId: text('tv_id')
      .notNull()
      .references(() => tvs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    episodeId: text('episode_id').references(() => tvEpisodes.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    index('idx_tv_sessions_tv_id').on(t.tvId),
    index('idx_tv_sessions_episode_id').on(t.episodeId),
    index('idx_tv_sessions_started_at').on(t.startedAt)
  ]
)

export type TvSession = InferSelectModel<typeof tvSessions>
export type NewTvSession = InferInsertModel<typeof tvSessions>
