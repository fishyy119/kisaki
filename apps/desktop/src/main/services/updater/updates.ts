import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { createLogger } from '@main/log'
import type { IpcService } from '@main/services/ipc'
import type {
  AppUpdaterDownloadProgress,
  AppUpdaterRelease,
  AppUpdaterState
} from '@shared/updater'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { UpdaterSettings } from './settings'

const log = createLogger('Updater')

interface AppUpdateManagerOptions {
  ipc: IpcService
  settings: UpdaterSettings
}

export class AppUpdateManager {
  private state: AppUpdaterState = {
    status: 'idle',
    update: null,
    error: null,
    downloadProgress: null
  }
  private isDownloading = false
  private autoDownloadOnNextAvailable = false

  constructor(private readonly options: AppUpdateManagerOptions) {}

  init(): void {
    this.configureAutoUpdater()
    this.registerAutoUpdaterListeners()

    if (this.shouldCheckForUpdatesOnStartup()) {
      void this.checkForUpdatesOnStartup()
    }
  }

  dispose(): void {
    autoUpdater.removeListener('checking-for-update', this.handleCheckingForUpdate)
    autoUpdater.removeListener('update-available', this.handleUpdateAvailable)
    autoUpdater.removeListener('update-not-available', this.handleUpdateNotAvailable)
    autoUpdater.removeListener('download-progress', this.handleDownloadProgress)
    autoUpdater.removeListener('update-downloaded', this.handleUpdateDownloaded)
    autoUpdater.removeListener('error', this.handleUpdaterError)
  }

  getState(): AppUpdaterState {
    return this.state
  }

  async checkForUpdates(): Promise<void> {
    if (is.dev || !app.isPackaged) {
      throw new Error('Manual update check is only available in packaged builds.')
    }

    await this.checkForUpdatesInternal({ autoDownload: false })
  }

  async downloadUpdate(): Promise<void> {
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

  async quitAndInstall(): Promise<void> {
    if (this.state.status !== 'downloaded' || !this.state.update) {
      throw new Error('No downloaded update is available.')
    }

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
      void this.downloadUpdate().catch((error) => {
        log.error('Failed to start auto download after update-available:', error)
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
    log.error('Auto updater error:', error)
    this.updateState({
      status: 'error',
      error: message
    })
  }

  private configureAutoUpdater(): void {
    this.options.settings.reload()

    autoUpdater.logger = log
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowDowngrade = false
    autoUpdater.disableWebInstaller = true
    autoUpdater.forceDevUpdateConfig = true
  }

  private registerAutoUpdaterListeners(): void {
    autoUpdater.on('checking-for-update', this.handleCheckingForUpdate)
    autoUpdater.on('update-available', this.handleUpdateAvailable)
    autoUpdater.on('update-not-available', this.handleUpdateNotAvailable)
    autoUpdater.on('download-progress', this.handleDownloadProgress)
    autoUpdater.on('update-downloaded', this.handleUpdateDownloaded)
    autoUpdater.on('error', this.handleUpdaterError)
  }

  private shouldCheckForUpdatesOnStartup(): boolean {
    const settings = this.options.settings.getSnapshot()

    if (!settings.autoCheck) {
      log.info('Startup update check is disabled by settings.')
      return false
    }

    if (is.dev || !app.isPackaged) {
      log.info('Skipping startup update check in development mode.')
      return false
    }

    return true
  }

  private async checkForUpdatesOnStartup(): Promise<void> {
    try {
      await this.checkForUpdatesInternal({ autoDownload: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('Startup update check failed:', error)
      this.updateState({
        status: 'error',
        error: message
      })
    }
  }

  private async checkForUpdatesInternal(options: { autoDownload: boolean }): Promise<void> {
    this.options.settings.reload()
    this.autoDownloadOnNextAvailable = options.autoDownload
    await autoUpdater.checkForUpdates()
  }

  private updateState(partial: Partial<AppUpdaterState>): void {
    this.state = {
      ...this.state,
      ...partial
    }
    this.options.ipc.send('updater:state-changed', this.state)
  }

  private toRelease(info: UpdateInfo): AppUpdaterRelease {
    return {
      version: info.version,
      releaseName: info.releaseName ?? null,
      releaseDate: info.releaseDate ?? null
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
}
