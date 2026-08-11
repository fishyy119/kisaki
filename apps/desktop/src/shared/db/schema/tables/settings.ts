import { check, integer, sqliteTable } from 'drizzle-orm/sqlite-core'
import { sql, type InferInsertModel, type InferSelectModel } from 'drizzle-orm'

import {
  mainWindowCloseAction,
  scannerIgnoredNames,
  scannerIngestMode,
  scannerParallelCount,
  stringArrayJson,
  uiLocale
} from '../../columns'
import {
  SCANNER_PARALLEL_COUNT_DEFAULT,
  SCANNER_PARALLEL_COUNT_MAX,
  SCANNER_PARALLEL_COUNT_MIN
} from '../../contracts/constants'

export const settings = sqliteTable(
  'settings',
  {
    id: integer('id').primaryKey().default(0),
    uiLocale: uiLocale('ui_locale'),
    mainWindowCloseAction: mainWindowCloseAction('main_window_close_action')
      .notNull()
      .default('exit'),
    scannerIgnoredNames: scannerIgnoredNames('scanner_ignored_names').notNull().default([]),
    scannerStartAtOpen: integer('scanner_start_at_open', { mode: 'boolean' })
      .notNull()
      .default(false),
    scannerParallelCount: scannerParallelCount('scanner_parallel_count')
      .notNull()
      .default(SCANNER_PARALLEL_COUNT_DEFAULT),
    scannerIngestMode: scannerIngestMode('scanner_ingest_mode').notNull().default('prefer-scraper'),
    /** Preferred audio track languages, most preferred first; empty keeps the file's default. */
    playerAudioLanguages: stringArrayJson('player_audio_languages').notNull().default([]),
    playerSubtitleLanguages: stringArrayJson('player_subtitle_languages').notNull().default([]),
    updaterAutoCheck: integer('updater_auto_check', { mode: 'boolean' }).notNull().default(true),
    updaterAllowPrerelease: integer('updater_allow_prerelease', { mode: 'boolean' })
      .notNull()
      .default(false)
  },
  (t) => [
    check('single_row_check', sql`${t.id} = 0`),
    check(
      'scanner_parallel_count_range_check',
      sql.raw(
        `"settings"."scanner_parallel_count" >= ${SCANNER_PARALLEL_COUNT_MIN} and "settings"."scanner_parallel_count" <= ${SCANNER_PARALLEL_COUNT_MAX}`
      )
    )
  ]
)

export type Settings = InferSelectModel<typeof settings>
export type NewSettings = InferInsertModel<typeof settings>
