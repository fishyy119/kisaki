import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  animeFormat,
  animeStatus,
  baseColumns,
  bloodType,
  cupSize,
  gameLauncherMode,
  gameMonitorMode,
  gameStatus,
  gender,
  partialDate,
  externalSites,
  saveBackups,
  stringArrayJson
} from '../../columns'

export const games = sqliteTable(
  'games',
  {
    ...baseColumns,
    name: text('name').notNull().default('unknown game'),
    originalName: text('original_name'),
    sortName: text('sort_name'),
    coverFile: text('cover_file'),
    backdropFile: text('backdrop_file'),
    logoFile: text('logo_file'),
    iconFile: text('icon_file'),
    score: integer('score'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    releaseDate: partialDate('release_date'),
    description: text('description'),
    externalSites: externalSites('external_sites'),
    status: gameStatus('status').notNull().default('notStarted'),
    lastActiveAt: integer('last_active_at', { mode: 'timestamp_ms' }),
    totalDuration: integer('total_duration').notNull().default(0),
    savePath: text('save_path'),
    saveBackups: saveBackups('save_backups'),
    maxSaveBackups: integer('max_save_backups').notNull().default(5),
    launcherMode: gameLauncherMode('launcher_mode').notNull().default('file'),
    launcherPath: text('launcher_path'),
    monitorMode: gameMonitorMode('monitor_mode').notNull().default('folder'),
    monitorPath: text('monitor_path'),
    gameDirPath: text('game_dir_path'),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false),
    descriptionInlineFiles: stringArrayJson('description_inline_files').notNull().default([])
  },
  (t) => [
    index('idx_games_status').on(t.status),
    index('idx_games_is_favorite').on(t.isFavorite),
    index('idx_games_is_nsfw').on(t.isNsfw),
    index('idx_games_last_active_at').on(t.lastActiveAt),
    index('idx_games_created_at').on(t.createdAt),
    index('idx_games_name').on(t.name),
    index('idx_games_score').on(t.score)
  ]
)

export type Game = InferSelectModel<typeof games>
export type NewGame = InferInsertModel<typeof games>

export const gameNotes = sqliteTable(
  'game_notes',
  {
    ...baseColumns,
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: text('name').notNull(),
    content: text('content'),
    contentInlineFiles: stringArrayJson('content_inline_files').notNull().default([]),
    coverFile: text('cover_file'),
    orderInGame: integer('order_in_game').notNull().default(0)
  },
  (t) => [
    unique('unique_game_notes_game_id_name').on(t.gameId, t.name),
    index('idx_game_notes_game_id').on(t.gameId),
    index('idx_game_notes_game_id_order').on(t.gameId, t.orderInGame)
  ]
)

export type GameNote = InferSelectModel<typeof gameNotes>
export type NewGameNote = InferInsertModel<typeof gameNotes>

export const animes = sqliteTable(
  'animes',
  {
    ...baseColumns,
    name: text('name').notNull().default('unknown anime'),
    originalName: text('original_name'),
    sortName: text('sort_name'),
    coverFile: text('cover_file'),
    backdropFile: text('backdrop_file'),
    logoFile: text('logo_file'),
    score: integer('score'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    releaseDate: partialDate('release_date'),
    description: text('description'),
    externalSites: externalSites('external_sites'),
    status: animeStatus('status').notNull().default('planned'),
    format: animeFormat('format').notNull().default('tv'),
    /** Episode count declared by metadata; the episode rows remain authoritative. */
    totalEpisodes: integer('total_episodes'),
    /**
     * Subtracted from file-derived regular episode numbers during file sync so
     * absolutely numbered releases align with this entry's metadata numbering.
     */
    episodeFileNumberOffset: integer('episode_file_number_offset').notNull().default(0),
    lastActiveAt: integer('last_active_at', { mode: 'timestamp_ms' }),
    totalDuration: integer('total_duration').notNull().default(0),
    animeDirPath: text('anime_dir_path'),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false),
    descriptionInlineFiles: stringArrayJson('description_inline_files').notNull().default([])
  },
  (t) => [
    index('idx_animes_status').on(t.status),
    index('idx_animes_format').on(t.format),
    index('idx_animes_is_favorite').on(t.isFavorite),
    index('idx_animes_is_nsfw').on(t.isNsfw),
    index('idx_animes_last_active_at').on(t.lastActiveAt),
    index('idx_animes_created_at').on(t.createdAt),
    index('idx_animes_name').on(t.name),
    index('idx_animes_score').on(t.score)
  ]
)

export type Anime = InferSelectModel<typeof animes>
export type NewAnime = InferInsertModel<typeof animes>

export const animeNotes = sqliteTable(
  'anime_notes',
  {
    ...baseColumns,
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: text('name').notNull(),
    content: text('content'),
    contentInlineFiles: stringArrayJson('content_inline_files').notNull().default([]),
    coverFile: text('cover_file'),
    orderInAnime: integer('order_in_anime').notNull().default(0)
  },
  (t) => [
    unique('unique_anime_notes_anime_id_name').on(t.animeId, t.name),
    index('idx_anime_notes_anime_id').on(t.animeId),
    index('idx_anime_notes_anime_id_order').on(t.animeId, t.orderInAnime)
  ]
)

export type AnimeNote = InferSelectModel<typeof animeNotes>
export type NewAnimeNote = InferInsertModel<typeof animeNotes>

export const persons = sqliteTable(
  'persons',
  {
    ...baseColumns,
    name: text('name').notNull().default('unknown person'),
    originalName: text('original_name'),
    sortName: text('sort_name'),
    /**
     * Every other name this person is credited under. Sources model pen names
     * and adult-work aliases as separate entities, so merging them here would
     * otherwise drop the names the merged-away rows carried.
     */
    aliases: stringArrayJson('aliases').notNull().default([]),
    photoFile: text('photo_file'),
    score: integer('score'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false),
    birthDate: partialDate('birth_date'),
    deathDate: partialDate('death_date'),
    gender: gender('gender'),
    description: text('description'),
    externalSites: externalSites('external_sites')
  },
  (t) => [
    index('idx_persons_is_favorite').on(t.isFavorite),
    index('idx_persons_is_nsfw').on(t.isNsfw),
    index('idx_persons_gender').on(t.gender),
    index('idx_persons_created_at').on(t.createdAt),
    index('idx_persons_name').on(t.name),
    index('idx_persons_score').on(t.score)
  ]
)

export type Person = InferSelectModel<typeof persons>
export type NewPerson = InferInsertModel<typeof persons>

export const companies = sqliteTable(
  'companies',
  {
    ...baseColumns,
    name: text('name').notNull().default('unknown company'),
    originalName: text('original_name'),
    sortName: text('sort_name'),
    foundedDate: partialDate('founded_date'),
    logoFile: text('logo_file'),
    score: integer('score'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false),
    externalSites: externalSites('external_sites'),
    description: text('description')
  },
  (t) => [
    index('idx_companies_is_favorite').on(t.isFavorite),
    index('idx_companies_is_nsfw').on(t.isNsfw),
    index('idx_companies_created_at').on(t.createdAt),
    index('idx_companies_name').on(t.name),
    index('idx_companies_score').on(t.score)
  ]
)

export type Company = InferSelectModel<typeof companies>
export type NewCompany = InferInsertModel<typeof companies>

export const characters = sqliteTable(
  'characters',
  {
    ...baseColumns,
    name: text('name').notNull().default('unknown character'),
    originalName: text('original_name'),
    sortName: text('sort_name'),
    /** Nicknames, romanizations, and the names other works give this character. */
    aliases: stringArrayJson('aliases').notNull().default([]),
    photoFile: text('photo_file'),
    birthDate: partialDate('birth_date'),
    gender: gender('gender'),
    bloodType: bloodType('blood_type'),
    height: integer('height'),
    weight: integer('weight'),
    bust: integer('bust'),
    waist: integer('waist'),
    hips: integer('hips'),
    cup: cupSize('cup'),
    age: integer('age'),
    score: integer('score'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false),
    description: text('description'),
    externalSites: externalSites('external_sites')
  },
  (t) => [
    index('idx_characters_is_favorite').on(t.isFavorite),
    index('idx_characters_is_nsfw').on(t.isNsfw),
    index('idx_characters_gender').on(t.gender),
    index('idx_characters_created_at').on(t.createdAt),
    index('idx_characters_name').on(t.name),
    index('idx_characters_score').on(t.score),
    index('idx_characters_age').on(t.age)
  ]
)

export type Character = InferSelectModel<typeof characters>
export type NewCharacter = InferInsertModel<typeof characters>
