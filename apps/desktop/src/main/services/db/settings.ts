/**
 * App settings row access.
 *
 * The `settings` table holds exactly one row, seeded during initialization.
 * Reads are synchronous, like every other main-process database call.
 *
 * This is the only read path for app settings: callers that need a value with a
 * fallback use `tryGet()` instead of composing their own query plus try/catch,
 * so the "settings unreadable" degradation is decided and logged in one place.
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { createLogger } from '@main/log'
import * as schema from '@shared/db/schema'
import type { Settings } from '@shared/db/schema'

const log = createLogger('Db')

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

  /** Returns null when the row cannot be read, for callers that own a default. */
  tryGet(): Settings | null {
    try {
      return this.db.query.settings.findFirst().sync() ?? null
    } catch (error) {
      log.warn('Failed to read app settings.', error)
      return null
    }
  }
}
