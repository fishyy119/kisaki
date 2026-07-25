import { app } from 'electron'
import { isDev } from '@main/env'
import { createLogger } from '@main/log'
import type { IpcService } from '@main/services/ipc'
import {
  isTaskRunCancellation,
  type TaskRunHandle,
  type TaskRunService
} from '@main/services/task-run'
import type {
  AppUpdaterDownloadProgress,
  AppUpdaterRelease,
  AppUpdaterState
} from '@shared/updater'
import type { TaskRunInitiator, TaskRunProgressUpdate, TaskRunStartResult } from '@shared/task-run'
import type { I18nService } from '@main/services/i18n'
import type { Messages } from '@shared/i18n'
import electronUpdater, { type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { UpdaterSettings } from './settings'

// electron-updater is CJS with lazy getter exports that Node ESM named imports cannot see.
const { autoUpdater } = electronUpdater

const log = createLogger('Updater')

interface AppUpdateManagerOptions {
  ipc: IpcService
  settings: UpdaterSettings
  taskRun: TaskRunService
  i18n: I18nService
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
  private activeCheckRun: TaskRunHandle | null = null
  private activeDownloadRun: TaskRunHandle | null = null

  constructor(private readonly options: AppUpdateManagerOptions) {}

  init(): void {
    this.configureAutoUpdater()
    this.registerAutoUpdaterListeners()

    if (this.shouldCheckForUpdatesOnStartup()) {
      this.startCheckForUpdates({ type: 'system', reason: 'startup' }, { autoDownload: true })
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

  startCheckForUpdates(
    initiator: TaskRunInitiator = { type: 'user' },
    options: { autoDownload?: boolean } = {}
  ): TaskRunStartResult {
    if (this.activeCheckRun) {
      return {
        runId: this.activeCheckRun.id,
        createdAt: this.activeCheckRun.createdAt
      }
    }

    if (isDev) {
      throw new Error('Manual update check is only available in packaged builds.')
    }

    const run = this.options.taskRun.runs.create({
      category: 'updater',
      operation: 'updater.check',
      title: this.options.i18n.messages.updater.run.checkTitle,
      owner: { type: 'app' },
      initiator,
      subject: { type: 'app', labelSnapshot: app.getName() },
      controls: { cancelable: false, pausable: false }
    })

    this.activeCheckRun = run
    void this.executeCheckForUpdates(run, { autoDownload: options.autoDownload === true }).catch(
      () => undefined
    )

    return {
      runId: run.id,
      createdAt: run.createdAt
    }
  }

  startDownloadUpdate(initiator: TaskRunInitiator = { type: 'user' }): TaskRunStartResult {
    if (this.activeDownloadRun) {
      return {
        runId: this.activeDownloadRun.id,
        createdAt: this.activeDownloadRun.createdAt
      }
    }

    if (this.state.status === 'downloaded') {
      throw new Error('Update is already downloaded.')
    }
    if (this.state.status !== 'available' || !this.state.update) {
      throw new Error('No update is available for download.')
    }

    const run = this.options.taskRun.runs.create({
      category: 'updater',
      operation: 'updater.download',
      title: this.options.i18n.messages.updater.run.downloadTitle({
        version: this.state.update.version
      }),
      owner: { type: 'app' },
      initiator,
      subject: { type: 'app', labelSnapshot: app.getName() },
      controls: { cancelable: false, pausable: false }
    })

    this.activeDownloadRun = run
    void this.executeDownloadUpdate(run).catch(() => undefined)

    return {
      runId: run.id,
      createdAt: run.createdAt
    }
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
      try {
        this.startDownloadUpdate({ type: 'system', reason: 'update' })
      } catch (error) {
        log.error('Failed to start auto download after update-available:', error)
      }
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
    this.activeDownloadRun?.context.report(
      createDownloadProgress(this.options.i18n.messages, progress)
    )
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

    if (isDev) {
      log.info('Skipping startup update check in development mode.')
      return false
    }

    return true
  }

  private async executeCheckForUpdates(
    run: TaskRunHandle,
    options: { autoDownload: boolean }
  ): Promise<void> {
    const messages = this.options.i18n.messages
    try {
      run.start()
      run.context.report({
        phase: {
          key: 'checking',
          label: messages.updater.run.checkingPhase,
          current: 1,
          total: 1
        },
        work: {
          indeterminate: true,
          unit: 'request'
        }
      })

      await this.checkForUpdatesInternal({ autoDownload: options.autoDownload })
      run.context.throwIfCancelled()

      const update = this.state.update
      if (update && this.state.status !== 'not-available') {
        run.complete({
          title: messages.updater.run.foundTitle,
          summary: messages.updater.run.foundSummary({ version: update.version }),
          counters: { available: 1 },
          output: {
            version: update.version,
            releaseName: update.releaseName,
            releaseDate: update.releaseDate,
            autoDownload: options.autoDownload
          }
        })
        return
      }

      run.complete({
        title: messages.updater.run.upToDateTitle,
        summary: messages.updater.run.upToDateSummary,
        counters: { notAvailable: 1 }
      })
    } catch (error) {
      this.finishTaskRunFromError(run, error, {
        cancelledSummary: messages.updater.run.checkCancelledSummary
      })
      throw error
    } finally {
      if (this.activeCheckRun?.id === run.id) {
        this.activeCheckRun = null
      }
    }
  }

  private async executeDownloadUpdate(run: TaskRunHandle): Promise<void> {
    const messages = this.options.i18n.messages
    try {
      run.start()
      run.context.report(
        createDownloadProgress(messages, {
          transferred: this.state.downloadProgress?.transferred ?? 0,
          total: this.state.downloadProgress?.total ?? 0,
          percent: this.state.downloadProgress?.percent ?? 0,
          bytesPerSecond: this.state.downloadProgress?.bytesPerSecond ?? 0
        })
      )

      await this.downloadUpdateInternal()
      run.context.throwIfCancelled()

      const update = this.state.update
      const progress = this.state.downloadProgress
      run.complete({
        title: messages.updater.run.downloadedTitle,
        summary: update
          ? messages.updater.run.downloadedSummary({ version: update.version })
          : messages.updater.run.downloadedSummaryNoVersion,
        counters: { downloaded: 1 },
        output: {
          version: update?.version,
          totalBytes: progress?.total ?? progress?.transferred ?? null
        }
      })
    } catch (error) {
      this.finishTaskRunFromError(run, error, {
        cancelledSummary: messages.updater.run.downloadCancelledSummary
      })
      throw error
    } finally {
      if (this.activeDownloadRun?.id === run.id) {
        this.activeDownloadRun = null
      }
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

  private finishTaskRunFromError(
    run: TaskRunHandle,
    error: unknown,
    options: { cancelledSummary: string }
  ): void {
    if (isTaskRunCancellation(error) || run.context.signal.aborted || isAbortError(error)) {
      run.cancel({ summary: options.cancelledSummary })
      return
    }

    run.fail(error)
  }
}

function createDownloadProgress(
  messages: Messages,
  progress: Pick<ProgressInfo, 'transferred' | 'total' | 'percent' | 'bytesPerSecond'>
): TaskRunProgressUpdate {
  const total = Number.isFinite(progress.total) && progress.total > 0 ? progress.total : undefined
  const current =
    Number.isFinite(progress.transferred) && progress.transferred >= 0
      ? progress.transferred
      : undefined

  return {
    phase: {
      key: 'download',
      label: messages.updater.run.downloadingPhase,
      current: 1,
      total: 1
    },
    work: {
      current,
      total,
      unit: 'byte',
      indeterminate: total === undefined
    }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
