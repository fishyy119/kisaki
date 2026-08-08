/**
 * Settings change projection.
 *
 * Derived from the `settings` table definition so a new setting column emits
 * `app.settings.changed` without touching the feed. Row bookkeeping columns are
 * excluded because they are not settings.
 *
 * Trigger snapshots carry raw SQLite values, so each column's own
 * `mapFromDriverValue` restores the value the application would read. A column
 * that rejects the stored value degrades to the raw value: this is a read path
 * and a projection failure must not stop change delivery.
 */

import { getTableColumns } from 'drizzle-orm'
import { baseColumns } from '@shared/db/columns'
import { settings } from '@shared/db/schema'

export interface SettingsColumnProjection {
  /** Row property, and the name extensions see in `app.settings.changed`. */
  setting: string
  /** SQLite column name as it appears in trigger row snapshots. */
  column: string
  fromDriver: (value: unknown) => unknown
}

const ROW_BOOKKEEPING_KEYS = new Set(Object.keys(baseColumns))

export const SETTINGS_PROJECTIONS: readonly SettingsColumnProjection[] = Object.entries(
  getTableColumns(settings)
)
  .filter(([key]) => !ROW_BOOKKEEPING_KEYS.has(key))
  .map(([key, column]) => ({
    setting: key,
    column: column.name,
    fromDriver: (value: unknown) => {
      try {
        return column.mapFromDriverValue(value)
      } catch {
        return value
      }
    }
  }))
