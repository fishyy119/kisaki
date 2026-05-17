import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import { settings as settingsTable } from '@shared/db'
import { autoUpdater } from 'electron-updater'

const log = createLogger('Updater')

export interface UpdaterSettingsSnapshot {
  autoCheck: boolean
  allowPrerelease: boolean
}

const DEFAULT_UPDATER_SETTINGS: UpdaterSettingsSnapshot = {
  autoCheck: true,
  allowPrerelease: false
}

export class UpdaterSettings {
  private snapshot: UpdaterSettingsSnapshot = DEFAULT_UPDATER_SETTINGS

  constructor(private readonly dbService: DbService) {}

  getSnapshot(): UpdaterSettingsSnapshot {
    return this.snapshot
  }

  reload(): void {
    this.snapshot = this.load()
    autoUpdater.allowPrerelease = this.snapshot.allowPrerelease
  }

  private load(): UpdaterSettingsSnapshot {
    try {
      const row = this.dbService.client
        .select({
          autoCheck: settingsTable.updaterAutoCheck,
          allowPrerelease: settingsTable.updaterAllowPrerelease
        })
        .from(settingsTable)
        .get()

      return {
        autoCheck: row?.autoCheck ?? DEFAULT_UPDATER_SETTINGS.autoCheck,
        allowPrerelease: row?.allowPrerelease ?? DEFAULT_UPDATER_SETTINGS.allowPrerelease
      }
    } catch (error) {
      log.warn('Failed to load updater settings, using defaults:', error)
      return DEFAULT_UPDATER_SETTINGS
    }
  }
}
