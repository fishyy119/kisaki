import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  animeEpisodeType,
  animeExtraKind,
  audioTracks,
  baseColumns,
  partialDate,
  subtitleTracks
} from '../../columns'
import { animes } from './content'

export const animeEpisodes = sqliteTable(
  'anime_episodes',
  {
    ...baseColumns,
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    type: animeEpisodeType('type').notNull().default('regular'),
    /** Real-valued because recap episodes are numbered between two regular ones. */
    episodeNumber: real('episode_number'),
    name: text('name'),
    originalName: text('original_name'),
    airDate: partialDate('air_date'),
    /** Scraped synopsis; not a user-editable rich-content surface. */
    description: text('description'),
    stillFile: text('still_file'),
    durationMs: integer('duration_ms'),
    watchedAt: integer('watched_at', { mode: 'timestamp_ms' }),
    playCount: integer('play_count').notNull().default(0),
    resumePositionMs: integer('resume_position_ms'),
    orderInAnime: integer('order_in_anime').notNull().default(0)
  },
  (t) => [
    index('idx_anime_episodes_anime_id').on(t.animeId),
    index('idx_anime_episodes_anime_id_order').on(t.animeId, t.orderInAnime),
    index('idx_anime_episodes_watched_at').on(t.watchedAt)
  ]
)

export type AnimeEpisode = InferSelectModel<typeof animeEpisodes>
export type NewAnimeEpisode = InferInsertModel<typeof animeEpisodes>

/**
 * Playable files for one episode.
 *
 * One episode legitimately owns several files: BD and TV airings coexist, and
 * a corrected release replaces neither.
 */
export const animeEpisodeFiles = sqliteTable(
  'anime_episode_files',
  {
    ...baseColumns,
    episodeId: text('episode_id')
      .notNull()
      .references(() => animeEpisodes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
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
     * the anime directory, keep their episode assignment, and never get
     * deleted or retargeted by a sync pass.
     */
    isManual: integer('is_manual', { mode: 'boolean' }).notNull().default(false),
    note: text('note')
  },
  (t) => [index('idx_anime_episode_files_episode_id').on(t.episodeId)]
)

export type AnimeEpisodeFile = InferSelectModel<typeof animeEpisodeFiles>
export type NewAnimeEpisodeFile = InferInsertModel<typeof animeEpisodeFiles>

/** Supplementary assets (trailers, creditless openings) that carry no watch state. */
export const animeExtras = sqliteTable(
  'anime_extras',
  {
    ...baseColumns,
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    kind: animeExtraKind('kind').notNull().default('other'),
    name: text('name').notNull(),
    path: text('path').notNull().unique(),
    durationMs: integer('duration_ms'),
    orderInAnime: integer('order_in_anime').notNull().default(0),
    /**
     * Row owned by the user instead of file sync. Manual rows may live outside
     * the anime directory and never get rewritten or deleted by a sync pass.
     */
    isManual: integer('is_manual', { mode: 'boolean' }).notNull().default(false)
  },
  (t) => [index('idx_anime_extras_anime_id').on(t.animeId)]
)

export type AnimeExtra = InferSelectModel<typeof animeExtras>
export type NewAnimeExtra = InferInsertModel<typeof animeExtras>

export const animeSessions = sqliteTable(
  'anime_sessions',
  {
    ...baseColumns,
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    episodeId: text('episode_id').references(() => animeEpisodes.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    index('idx_anime_sessions_anime_id').on(t.animeId),
    index('idx_anime_sessions_episode_id').on(t.episodeId),
    index('idx_anime_sessions_started_at').on(t.startedAt)
  ]
)

export type AnimeSession = InferSelectModel<typeof animeSessions>
export type NewAnimeSession = InferInsertModel<typeof animeSessions>
