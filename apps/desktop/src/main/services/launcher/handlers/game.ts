/**
 * Game Launcher Handler
 *
 * Handles launching games via file, URL, or exec modes.
 */

import { shell } from 'electron'
import { isWindows } from '@main/env'
import type { Game } from '@shared/db'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import spawn from 'cross-spawn'
import { createLogger } from '@main/log'
import type { MonitorService } from '@main/services/monitor'
import type { DbService } from '@main/services/db'
import type { NativeService } from '@main/services/native'
import type { I18nService } from '@main/services/i18n'
import { games } from '@shared/db'
import type { GameLaunchFailureReason, GameLaunchResult, GameStopResult } from '@shared/launcher'
import { and, eq } from 'drizzle-orm'
import { openExternalProtocol } from '@main/utils/external-url'
import type { LauncherHooks } from '../hooks'

const log = createLogger('Launcher')
const LAUNCH_DETECTION_TIMEOUT_MS = 10000
const STOP_DETECTION_TIMEOUT_MS = 10000

export class GameLauncherHandler {
  constructor(
    private dbService: DbService,
    private monitorService: MonitorService,
    private nativeService: NativeService,
    private i18nService: I18nService,
    private hooks: LauncherHooks
  ) {}

  /**
   * Apply default launch configuration based on a selected file path.
   */
  async applyDefaultConfig(gameId: string, filePath: string): Promise<void> {
    const gameDirPath = dirname(filePath)

    this.dbService.client
      .update(games)
      .set({
        launcherPath: filePath,
        launcherMode: 'file',
        gameDirPath,
        monitorMode: 'folder'
      })
      .where(eq(games.id, gameId))
      .run()

    log.info('Applied default config for game.', { gameId: gameId, filePath: filePath })
  }

  /**
   * Launches a game.
   *
   * Every expected outcome is reported through the result; callers own the
   * user notifications and this handler logs the failure detail.
   *
   * @param gameId - The game ID
   * @returns Process detection result.
   */
  async launchGame(gameId: string): Promise<GameLaunchResult> {
    const [game] = this.dbService.client
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)
      .all()
    if (!game) {
      log.warn('Game to launch was not found.', { gameId })
      return { status: 'failed', reason: 'gameNotFound' }
    }

    if (!game.launcherPath) {
      if (game.launcherMode === 'url') {
        log.warn('Launcher path is not set.', { gameName: game.name, gameId: game.id })
        return { status: 'failed', reason: 'launcherPathNotSet' }
      }

      const selected = await this.selectLauncherPath(game)
      if (!selected) {
        log.info('Launcher path selection cancelled.', { gameName: game.name, gameId: game.id })
        return { status: 'cancelled' }
      }

      this.dbService.client
        .update(games)
        .set({ launcherPath: selected })
        .where(eq(games.id, game.id))
        .run()

      game.launcherPath = selected
    }

    // Let hook taps adjust the effective launch configuration (never persisted).
    const launchConfig = await this.hooks.gameLaunching.transform({
      gameId: game.id,
      launcherMode: game.launcherMode,
      launcherPath: game.launcherPath!,
      gameDirPath: game.gameDirPath
    })
    game.launcherMode = launchConfig.launcherMode
    game.launcherPath = launchConfig.launcherPath
    game.gameDirPath = launchConfig.gameDirPath

    // Launch first
    const failureReason = await this.startLauncherTarget(game)
    if (failureReason) {
      return { status: 'failed', reason: failureReason }
    }

    const monitoringStarted = await this.startMonitoringAfterLaunch(game.id)
    if (!monitoringStarted) {
      return {
        status: 'unconfirmed',
        reason: 'monitorUnavailable'
      }
    }

    const runningStatus = await this.monitorService.game.waitForRunning(
      game.id,
      LAUNCH_DETECTION_TIMEOUT_MS
    )
    if (!runningStatus) {
      log.warn('Game launch was not confirmed by monitor.', {
        gameName: game.name,
        gameId: game.id
      })
      return {
        status: 'unconfirmed',
        reason: 'processNotDetected'
      }
    }

    this.markNotStartedAsInProgress(game)

    log.info('Game launch confirmed.', {
      gameName: game.name,
      gameId: game.id,
      processPid: runningStatus.pid
    })
    return { status: 'detected', pid: runningStatus.pid }
  }

  private async startMonitoringAfterLaunch(gameId: string): Promise<boolean> {
    try {
      await this.monitorService.game.startMonitoring(gameId)
      return true
    } catch (error) {
      log.warn('Failed to start game monitor after launch.', error, { gameId })
      return false
    }
  }

  private markNotStartedAsInProgress(game: Game): void {
    if (game.status !== 'notStarted') {
      return
    }

    this.dbService.client
      .update(games)
      .set({ status: 'inProgress' })
      .where(and(eq(games.id, game.id), eq(games.status, 'notStarted')))
      .run()

    log.info('Updated game status for launch.', { gameName: game.name, gameId: game.id })
  }

  private async selectLauncherPath(game: Game): Promise<string | null> {
    const filters =
      game.launcherMode === 'exec' && isWindows
        ? [
            { name: 'Executable', extensions: ['exe', 'bat', 'cmd', 'com'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        : undefined

    const result = await this.nativeService.dialogs.showOpenDialog({
      title: this.i18nService.messages.launcher.filePickerTitle,
      buttonLabel: this.i18nService.messages.launcher.filePickerButton,
      defaultPath: game.gameDirPath ?? undefined,
      properties: ['openFile'],
      filters
    })

    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  }

  /** Starts the configured launch target, returning why it could not start. */
  private async startLauncherTarget(game: Game): Promise<GameLaunchFailureReason | null> {
    switch (game.launcherMode) {
      case 'file':
        return this.launchFile(game)
      case 'url':
        return this.launchUrl(game)
      case 'exec':
        return this.launchExec(game)
      default:
        log.warn('Unknown launcher mode.', { gameId: game.id, launcherMode: game.launcherMode })
        return 'unknownMode'
    }
  }

  /**
   * file mode: Open file with system default application
   */
  private async launchFile(game: Game): Promise<GameLaunchFailureReason | null> {
    const filePath = game.launcherPath!

    // If relative path, resolve relative to game directory
    const absolutePath = game.gameDirPath ? resolve(game.gameDirPath, filePath) : resolve(filePath)

    // Check if file exists
    if (!existsSync(absolutePath)) {
      log.warn('Launch file not found.', { gameId: game.id, absolutePath })
      return 'fileNotFound'
    }

    // Use shell.openPath to open file
    const result = await shell.openPath(absolutePath)

    if (result) {
      // Non-empty result indicates failure with error info
      log.warn('Failed to open launch file.', { gameId: game.id, absolutePath, openError: result })
      return 'openFileFailed'
    }

    return null
  }

  /**
   * url mode: Open URL with system default browser
   */
  private async launchUrl(game: Game): Promise<GameLaunchFailureReason | null> {
    const url = game.launcherPath!

    // Validate URL format
    try {
      new URL(url)
    } catch {
      log.warn('Launch URL format is invalid.', { gameId: game.id })
      return 'invalidUrl'
    }

    await openExternalProtocol(url, { allowCustomProtocols: true })
    return null
  }

  /**
   * exec mode: Execute the executable file directly
   */
  private async launchExec(game: Game): Promise<GameLaunchFailureReason | null> {
    const execPath = game.launcherPath!

    // If relative path, resolve relative to game directory
    const absolutePath = game.gameDirPath ? resolve(game.gameDirPath, execPath) : resolve(execPath)

    // Check if executable exists
    if (!existsSync(absolutePath)) {
      log.warn('Launch executable not found.', { gameId: game.id, absolutePath })
      return 'executableNotFound'
    }

    // Use spawn to execute
    const child = spawn(absolutePath, [], {
      cwd: game.gameDirPath || undefined,
      detached: true, // Detach process, allow parent to exit
      stdio: 'ignore' // Ignore stdin/stdout
    })

    // Error handling
    child.on('error', (error) => {
      log.error('Failed to launch game.', error, { gameId: game.id })
    })

    // Detach process to run independently
    child.unref()

    return null
  }

  /**
   * Kill game process.
   *
   * Reports every expected outcome through the result, as {@link launchGame}.
   *
   * @param gameId - The game ID
   */
  async killGame(gameId: string): Promise<GameStopResult> {
    const status = this.monitorService.game.getStatus(gameId)
    if (!status || !status.isRunning || !status.pid) {
      log.warn('Game to stop is not running.', { gameId })
      return { status: 'failed', reason: 'gameNotRunning' }
    }

    const terminated = await this.terminateProcess(status.pid)
    if (!terminated) {
      return { status: 'failed', reason: 'stopProcessFailed' }
    }

    const stopped = await this.monitorService.game.waitForStopped(gameId, STOP_DETECTION_TIMEOUT_MS)
    if (!stopped) {
      log.warn('Game stop was not confirmed by monitor.', { gameId: gameId, statusPid: status.pid })
      return { status: 'unconfirmed' }
    }

    log.info('Game stop confirmed.', { gameId: gameId, statusPid: status.pid })
    return { status: 'stopped' }
  }

  private async terminateProcess(pid: number): Promise<boolean> {
    try {
      if (isWindows) {
        await runExternalCommand('taskkill', ['/F', '/PID', String(pid)])
      } else {
        process.kill(pid, 'SIGTERM')
      }
      return true
    } catch (error) {
      log.warn('Failed to terminate game process.', error, { processPid: pid })
      return false
    }
  }
}

function runExternalCommand(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code ?? 'unknown'}.`))
      }
    })
  })
}
