/**
 * Updater Service
 *
 * Manages startup update checks, manual checks, download progress, and install handoff.
 */

import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { settings } from '@shared/db'
import type {
  AppUpdaterDownloadProgress,
  AppUpdaterRelease,
  AppUpdaterState
} from '@shared/updater'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { DbService } from '@main/services/db'
import type { IpcService } from '@main/services/ipc'

interface UpdaterSettings {
  autoCheck: boolean
  allowPrerelease: boolean
}

export class UpdaterService implements IService {
  readonly id = 'updater'
  readonly deps = ['db', 'ipc'] as const satisfies readonly ServiceName[]

  private dbService!: DbService
  private ipcService!: IpcService
  private updaterSettings: UpdaterSettings = {
    autoCheck: true,
    allowPrerelease: false
  }
  private state: AppUpdaterState = {
    status: 'idle',
    update: null,
    error: null,
    downloadProgress: null
  }
  private isDownloading = false
  private autoDownloadOnNextAvailable = false

  private readonly handleCheckingForUpdate = () => {
    this.updateState({
      status: 'checking',
      error: null,
      downloadProgress: null
    })
  }

  private readonly handleUpdateAvailable = (info: UpdateInfo) => {
    this.updateState({
      status: 'available',
      update: this.toRelease(info),
      error: null,
      downloadProgress: null
    })

    if (this.autoDownloadOnNextAvailable) {
      this.autoDownloadOnNextAvailable = false
      void this.downloadUpdateInternal().catch((error) => {
        log.error('[UpdaterService] Failed to start auto download after update-available:', error)
      })
    }
  }

  private readonly handleUpdateNotAvailable = () => {
    this.autoDownloadOnNextAvailable = false
    this.isDownloading = false
    this.updateState({
      status: 'not-available',
      update: null,
      error: null,
      downloadProgress: null
    })
  }

  private readonly handleDownloadProgress = (progress: ProgressInfo) => {
    this.isDownloading = true
    this.updateState({
      status: 'downloading',
      error: null,
      downloadProgress: this.toDownloadProgress(progress)
    })
  }

  private readonly handleUpdateDownloaded = (info: UpdateInfo) => {
    this.isDownloading = false
    this.autoDownloadOnNextAvailable = false
    const currentProgress = this.state.downloadProgress

    this.updateState({
      status: 'downloaded',
      update: this.toRelease(info),
      error: null,
      downloadProgress: currentProgress
        ? {
            ...currentProgress,
            percent: 100,
            transferred: currentProgress.total || currentProgress.transferred
          }
        : null
    })
  }

  private readonly handleUpdaterError = (error: Error) => {
    this.isDownloading = false
    this.autoDownloadOnNextAvailable = false
    const message = error?.message ?? String(error)
    log.error('[UpdaterService] Auto updater error:', error)
    this.updateState({
      status: 'error',
      error: message
    })
  }

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.dbService = container.get('db')
    this.ipcService = container.get('ipc')

    this.setupIpcHandlers()
    this.configureAutoUpdater()
    this.registerAutoUpdaterListeners()

    if (this.shouldCheckForUpdatesOnStartup()) {
      void this.checkForUpdatesOnStartup()
    }

    log.info('[UpdaterService] Initialized')
  }

  async dispose(): Promise<void> {
    autoUpdater.removeListener('checking-for-update', this.handleCheckingForUpdate)
    autoUpdater.removeListener('update-available', this.handleUpdateAvailable)
    autoUpdater.removeListener('update-not-available', this.handleUpdateNotAvailable)
    autoUpdater.removeListener('download-progress', this.handleDownloadProgress)
    autoUpdater.removeListener('update-downloaded', this.handleUpdateDownloaded)
    autoUpdater.removeListener('error', this.handleUpdaterError)
    log.info('[UpdaterService] Disposed')
  }

  private setupIpcHandlers(): void {
    this.ipcService.handle('updater:get-state', async () => {
      return { success: true, data: this.state }
    })

    this.ipcService.handle('updater:check-for-updates', async () => {
      if (is.dev || !app.isPackaged) {
        return {
          success: false,
          error: 'Manual update check is only available in packaged builds.'
        }
      }

      try {
        await this.checkForUpdatesInternal({ autoDownload: false })
        return { success: true }
      } catch (error) {
        log.error('[UpdaterService] Manual update check failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })

    this.ipcService.handle('updater:download-update', async () => {
      try {
        await this.downloadUpdateInternal()
        return { success: true }
      } catch (error) {
        log.error('[UpdaterService] Manual download failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })

    this.ipcService.handle('updater:reload-settings', async () => {
      try {
        this.reloadSettings()
        return { success: true }
      } catch (error) {
        log.error('[UpdaterService] Failed to reload updater settings:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })

    this.ipcService.handle('updater:quit-and-install', async () => {
      if (this.state.status !== 'downloaded' || !this.state.update) {
        return { success: false, error: 'No downloaded update is available.' }
      }

      try {
        await this.quitAndInstallInternal()
        return { success: true }
      } catch (error) {
        log.error('[UpdaterService] Failed to start update installation:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })
  }

  private configureAutoUpdater(): void {
    this.updaterSettings = this.loadUpdaterSettings()

    autoUpdater.logger = log
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowDowngrade = false
    autoUpdater.disableWebInstaller = true
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.allowPrerelease = this.updaterSettings.allowPrerelease
  }

  private reloadSettings(): void {
    this.updaterSettings = this.loadUpdaterSettings()
    autoUpdater.allowPrerelease = this.updaterSettings.allowPrerelease
  }

  private registerAutoUpdaterListeners(): void {
    autoUpdater.on('checking-for-update', this.handleCheckingForUpdate)
    autoUpdater.on('update-available', this.handleUpdateAvailable)
    autoUpdater.on('update-not-available', this.handleUpdateNotAvailable)
    autoUpdater.on('download-progress', this.handleDownloadProgress)
    autoUpdater.on('update-downloaded', this.handleUpdateDownloaded)
    autoUpdater.on('error', this.handleUpdaterError)
  }

  private loadUpdaterSettings(): UpdaterSettings {
    try {
      const row = this.dbService.db
        .select({
          autoCheck: settings.updaterAutoCheck,
          allowPrerelease: settings.updaterAllowPrerelease
        })
        .from(settings)
        .get()

      return {
        autoCheck: row?.autoCheck ?? true,
        allowPrerelease: row?.allowPrerelease ?? false
      }
    } catch (error) {
      log.warn('[UpdaterService] Failed to load updater settings, using defaults:', error)
      return {
        autoCheck: true,
        allowPrerelease: false
      }
    }
  }

  private shouldCheckForUpdatesOnStartup(): boolean {
    if (!this.updaterSettings.autoCheck) {
      log.info('[UpdaterService] Startup update check is disabled by settings.')
      return false
    }

    if (is.dev || !app.isPackaged) {
      log.info('[UpdaterService] Skipping startup update check in development mode.')
      return false
    }

    return true
  }

  private async checkForUpdatesOnStartup(): Promise<void> {
    try {
      await this.checkForUpdatesInternal({ autoDownload: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('[UpdaterService] Startup update check failed:', error)
      this.updateState({
        status: 'error',
        error: message
      })
    }
  }

  private async checkForUpdatesInternal(options: { autoDownload: boolean }): Promise<void> {
    this.reloadSettings()
    this.autoDownloadOnNextAvailable = options.autoDownload
    await autoUpdater.checkForUpdates()
  }

  private async downloadUpdateInternal(): Promise<void> {
    if (this.isDownloading || this.state.status === 'downloading') return
    if (this.state.status === 'downloaded') return
    if (this.state.status !== 'available' || !this.state.update) {
      throw new Error('No update is available for download.')
    }

    this.isDownloading = true
    this.updateState({
      status: 'downloading',
      error: null,
      downloadProgress: this.state.downloadProgress ?? null
    })

    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      this.isDownloading = false
      const message = error instanceof Error ? error.message : String(error)
      this.updateState({
        status: 'error',
        error: message
      })
      throw error
    }
  }

  private async quitAndInstallInternal(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false
      let timeout: NodeJS.Timeout | null = null

      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        app.removeListener('before-quit', onBeforeQuit)
        autoUpdater.removeListener('error', onUpdaterError)
      }

      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        cleanup()
        fn()
      }

      const onBeforeQuit = () => {
        settle(resolve)
      }

      const onUpdaterError = (error: Error) => {
        const message = error?.message ?? String(error)
        settle(() => reject(new Error(message)))
      }

      app.once('before-quit', onBeforeQuit)
      autoUpdater.once('error', onUpdaterError)

      timeout = setTimeout(() => {
        settle(() => reject(new Error('Installer did not start in time.')))
      }, 5000)

      try {
        autoUpdater.quitAndInstall(false, true)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        settle(() => reject(new Error(message)))
      }
    })
  }

  private updateState(partial: Partial<AppUpdaterState>): void {
    this.state = {
      ...this.state,
      ...partial
    }
    this.ipcService.send('updater:state-changed', this.state)
  }

  private toRelease(info: UpdateInfo): AppUpdaterRelease {
    return {
      version: info.version,
      releaseName: info.releaseName ?? null,
      releaseDate: info.releaseDate ?? null,
      releaseNotes: this.normalizeReleaseNotes(info.releaseNotes)
    }
  }

  private toDownloadProgress(progress: ProgressInfo): AppUpdaterDownloadProgress {
    return {
      bytesPerSecond: progress.bytesPerSecond ?? 0,
      percent: progress.percent ?? 0,
      transferred: progress.transferred ?? 0,
      total: progress.total ?? 0
    }
  }

  private normalizeReleaseNotes(notes: unknown): string {
    if (!notes) return ''
    if (typeof notes === 'string') return notes.trim()
    if (!Array.isArray(notes)) return ''

    return notes
      .map((item) => {
        if (!item || typeof item !== 'object') return ''

        const noteInfo = item as { version?: unknown; note?: unknown }
        const version = typeof noteInfo.version === 'string' ? noteInfo.version.trim() : ''
        const note = typeof noteInfo.note === 'string' ? noteInfo.note.trim() : ''
        if (version && note) return `## ${version}\n${note}`
        if (version) return `## ${version}`
        return note
      })
      .filter((entry) => entry.length > 0)
      .join('\n\n')
      .trim()
  }
}
