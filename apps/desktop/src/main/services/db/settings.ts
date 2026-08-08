/**
 * App settings row access.
 *
 * The `settings` table holds exactly one row, seeded during initialization.
 * Reads are synchronous, like every other main-process database call.
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db/schema'
import type { Settings } from '@shared/db/schema'

export class SettingsStore {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  /**
   * @throws When the singleton settings row is missing, which means the
   * database was never initialized.
   */
  get(): Settings {
    const settings = this.db.query.settings.findFirst().sync()
    if (!settings) {
      throw new Error('Settings not found in database')
    }
    return settings
  }
}
