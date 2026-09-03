import { check, integer, sqliteTable } from 'drizzle-orm/sqlite-core'
import { sql, type InferInsertModel, type InferSelectModel } from 'drizzle-orm'

import {
  mainWindowCloseAction,
  scannerIgnoredNames,
  scannerIngestMode,
  scannerParallelCount,
  uiLocale,
  uiScale
} from '../../columns'
import {
  SCANNER_PARALLEL_COUNT_DEFAULT,
  SCANNER_PARALLEL_COUNT_MAX,
  SCANNER_PARALLEL_COUNT_MIN
} from '../../contracts/constants'
import { UI_SCALE_DEFAULT, UI_SCALE_VALUES } from '../../../window'

export const settings = sqliteTable(
  'settings',
  {
    id: integer('id').primaryKey().default(0),
    uiLocale: uiLocale('ui_locale'),
    uiScale: uiScale('ui_scale').notNull().default(UI_SCALE_DEFAULT),
    mainWindowCloseAction: mainWindowCloseAction('main_window_close_action')
      .notNull()
      .default('exit'),
    scannerIgnoredNames: scannerIgnoredNames('scanner_ignored_names').notNull().default([]),
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
      'ui_scale_values_check',
      sql.raw(`"settings"."ui_scale" in (${UI_SCALE_VALUES.join(', ')})`)
    ),
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
