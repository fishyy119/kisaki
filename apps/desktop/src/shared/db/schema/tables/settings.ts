import { check, integer, sqliteTable } from 'drizzle-orm/sqlite-core'
import { sql, type InferInsertModel, type InferSelectModel } from 'drizzle-orm'

import {
  appLocale,
  mainWindowCloseAction,
  scannerIgnoredNames,
  scannerIngestMode,
  scannerParallelCount
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
    locale: appLocale('locale'),
    mainWindowCloseAction: mainWindowCloseAction('main_window_close_action')
      .notNull()
      .default('exit'),
    scannerIgnoredNames: scannerIgnoredNames('scanner_ignored_names').notNull().default([]),
    scannerUsePhash: integer('scanner_use_phash', { mode: 'boolean' }).notNull().default(false),
    scannerStartAtOpen: integer('scanner_start_at_open', { mode: 'boolean' })
      .notNull()
      .default(false),
    scannerParallelCount: scannerParallelCount('scanner_parallel_count')
      .notNull()
      .default(SCANNER_PARALLEL_COUNT_DEFAULT),
    scannerIngestMode: scannerIngestMode('scanner_ingest_mode').notNull().default('prefer-scraper'),
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
