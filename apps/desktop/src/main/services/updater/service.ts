/**
 * Updater Service
 *
 * Manages startup update checks, manual checks, download progress, and install handoff.
 */

import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { valid as isValidSemver } from 'semver'
import { settings } from '@shared/db'
import type {
  AppUpdaterChangelogBundle,
  AppUpdaterChangelogLocale,
  AppUpdaterDownloadProgress,
  AppUpdaterRelease,
  AppUpdaterState
} from '@shared/updater'
import { APP_UPDATER_CHANGELOG_LOCALES } from '@shared/updater'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { DbService } from '@main/services/db'
import type { IpcService } from '@main/services/ipc'
import type { NetworkService } from '@main/services/network'
import { registerUpdaterIpc } from './ipc'

interface UpdaterSettings {
  autoCheck: boolean
  allowPrerelease: boolean
}

export class UpdaterService implements IService {
  readonly id = 'updater'
  readonly deps = ['db', 'ipc', 'network'] as const satisfies readonly ServiceName[]

  private dbService!: DbService
  private ipcService!: IpcService
  private networkService!: NetworkService
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
  private readonly changelogCache = new Map<string, AppUpdaterChangelogBundle>()
  private readonly changelogInFlight = new Map<string, Promise<AppUpdaterChangelogBundle>>()

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
    this.networkService = container.get('network')

    registerUpdaterIpc(this, this.ipcService)
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

  getState(): AppUpdaterState {
    return this.state
  }

  async getChangelog(version: string): Promise<AppUpdaterChangelogBundle> {
    const normalizedVersion = this.normalizeVersion(version)
    if (!normalizedVersion) {
      throw new Error('Invalid update version.')
    }

    return this.getChangelogBundle(normalizedVersion)
  }

  async checkForUpdates(): Promise<void> {
    if (is.dev || !app.isPackaged) {
      throw new Error('Manual update check is only available in packaged builds.')
    }

    await this.checkForUpdatesInternal({ autoDownload: false })
  }

  downloadUpdate(): Promise<void> {
    return this.downloadUpdateInternal()
  }

  reloadUpdaterSettings(): void {
    this.reloadSettings()
  }

  async quitAndInstall(): Promise<void> {
    if (this.state.status !== 'downloaded' || !this.state.update) {
      throw new Error('No downloaded update is available.')
    }

    await this.quitAndInstallInternal()
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

  private normalizeVersion(version: string): string | null {
    const input = version.trim()
    if (!input) return null

    const withoutPrefix = input.replace(/^v/i, '')
    return isValidSemver(withoutPrefix)
  }

  private async getChangelogBundle(version: string): Promise<AppUpdaterChangelogBundle> {
    const cached = this.changelogCache.get(version)
    if (cached) return cached

    const inFlight = this.changelogInFlight.get(version)
    if (inFlight) return inFlight

    const request = this.fetchChangelogBundle(version)
      .then((bundle) => {
        this.changelogCache.set(version, bundle)
        return bundle
      })
      .finally(() => {
        this.changelogInFlight.delete(version)
      })

    this.changelogInFlight.set(version, request)
    return request
  }

  private async fetchChangelogBundle(version: string): Promise<AppUpdaterChangelogBundle> {
    const entries = await Promise.all(
      APP_UPDATER_CHANGELOG_LOCALES.map(async (locale) => {
        return this.fetchChangelogByLocale(version, locale)
      })
    )

    const markdownByLocale: Record<AppUpdaterChangelogLocale, string | null> = {
      'zh-Hans': null,
      en: null,
      ja: null
    }

    let availableCount = 0
    for (const entry of entries) {
      markdownByLocale[entry.locale] = entry.markdown
      if (entry.markdown) {
        availableCount += 1
      }
    }

    if (availableCount === 0) {
      throw new Error(`No changelog files are available for v${version}.`)
    }

    return {
      version,
      markdownByLocale
    }
  }

  private async fetchChangelogByLocale(
    version: string,
    locale: AppUpdaterChangelogLocale
  ): Promise<{ locale: AppUpdaterChangelogLocale; markdown: string | null }> {
    const url = this.buildChangelogUrl(version, locale)

    try {
      const response = await this.networkService.fetch(url, {
        retries: 1,
        timeout: 10000
      })
      if (!response.ok) {
        log.warn(
          `[UpdaterService] Missing changelog for v${version} locale ${locale}: ${response.status} ${response.statusText}`
        )
        return { locale, markdown: null }
      }

      const markdown = (await response.text()).trim()
      if (!markdown) {
        log.warn(`[UpdaterService] Empty changelog for v${version} locale ${locale}.`)
        return { locale, markdown: null }
      }

      return { locale, markdown }
    } catch (error) {
      log.warn(
        `[UpdaterService] Failed to fetch changelog for v${version} locale ${locale}:`,
        error
      )
      return { locale, markdown: null }
    }
  }

  private buildChangelogUrl(version: string, locale: AppUpdaterChangelogLocale): string {
    return `https://raw.githubusercontent.com/ximu3/kisaki/desktop-v${version}/changelog/desktop/v${version}/${locale}.md`
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
