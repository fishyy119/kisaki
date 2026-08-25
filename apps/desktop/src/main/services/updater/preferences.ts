import type { DbService } from '@main/services/db'
import electronUpdater from 'electron-updater'

// electron-updater is CJS with lazy getter exports that Node ESM named imports cannot see.
const { autoUpdater } = electronUpdater

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
    const row = this.dbService.settings.tryGet()

    return {
      autoCheck: row?.updaterAutoCheck ?? DEFAULT_UPDATER_SETTINGS.autoCheck,
      allowPrerelease: row?.updaterAllowPrerelease ?? DEFAULT_UPDATER_SETTINGS.allowPrerelease
    }
  }
}
