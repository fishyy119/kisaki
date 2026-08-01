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
import type { NotifyService } from '@main/services/notify'
import type { I18nService } from '@main/services/i18n'
import type { Messages } from '@shared/i18n'
import { games } from '@shared/db'
import type { GameLaunchResult, GameStopResult } from '@shared/launcher'
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
    private notifyService: NotifyService,
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
   * Launches a game
   * @param gameId - The game ID
   * @param options - Optional behavior toggles
   * @returns Process detection result.
   * @throws Error when launch fails
   */
  async launchGame(
    gameId: string,
    options?: { cancelBehavior?: 'return' | 'throw' }
  ): Promise<GameLaunchResult> {
    const messages = this.i18nService.messages
    const toastId = this.notifyService.loading(messages.launcher.launching)

    try {
      const result = await this.performLaunchGame(gameId, options)
      this.notifyService.update(toastId, {
        title: getLaunchResultTitle(messages, result),
        message: getLaunchResultMessage(messages, result),
        type: result.status === 'detected' ? 'success' : 'warning',
        duration: result.status === 'unconfirmed' ? 5000 : 3000
      })
      return result
    } catch (error) {
      const selectionCancelled = isLaunchPathSelectionCancelled(error)
      this.notifyService.update(toastId, {
        title: selectionCancelled
          ? messages.launcher.launchCancelledTitle
          : messages.launcher.launchFailedTitle,
        message: selectionCancelled ? undefined : formatLaunchErrorMessage(messages, error),
        type: selectionCancelled ? 'warning' : 'error',
        duration: selectionCancelled ? 3000 : 5000
      })
      throw error
    }
  }

  private async performLaunchGame(
    gameId: string,
    options?: { cancelBehavior?: 'return' | 'throw' }
  ): Promise<GameLaunchResult> {
    const [game] = this.dbService.client
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)
      .all()
    if (!game) {
      throw new Error('Game not found')
    }

    if (!game.launcherPath) {
      if (game.launcherMode === 'url') {
        throw new Error('Launcher path is not set')
      }

      const selected = await this.selectLauncherPath(game)
      if (!selected) {
        if (options?.cancelBehavior === 'throw') {
          throw new Error('Launcher path selection cancelled')
        }
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
    switch (game.launcherMode) {
      case 'file':
        await this.launchFile(game)
        break
      case 'url':
        await this.launchUrl(game)
        break
      case 'exec':
        await this.launchExec(game)
        break
      default:
        throw new Error(`Unknown launcher mode: ${game.launcherMode}`)
    }

    const monitoringStarted = await this.startMonitoringAfterLaunch(game.id)
    if (!monitoringStarted) {
      return {
        status: 'unconfirmed',
        reason: 'monitor-unavailable'
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
        reason: 'process-not-detected'
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

  /**
   * file mode: Open file with system default application
   */
  private async launchFile(game: Game): Promise<void> {
    const filePath = game.launcherPath!

    // If relative path, resolve relative to game directory
    const absolutePath = game.gameDirPath ? resolve(game.gameDirPath, filePath) : resolve(filePath)

    // Check if file exists
    if (!existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`)
    }

    // Use shell.openPath to open file
    const result = await shell.openPath(absolutePath)

    if (result) {
      // Non-empty result indicates failure with error info
      throw new Error(`Failed to open file: ${result}`)
    }
  }

  /**
   * url mode: Open URL with system default browser
   */
  private async launchUrl(game: Game): Promise<void> {
    const url = game.launcherPath!

    // Validate URL format
    try {
      new URL(url)
    } catch {
      throw new Error(`Invalid URL format: ${url}`)
    }

    await openExternalProtocol(url, { allowCustomProtocols: true })
  }

  /**
   * exec mode: Execute the executable file directly
   */
  private async launchExec(game: Game): Promise<void> {
    const execPath = game.launcherPath!

    // If relative path, resolve relative to game directory
    const absolutePath = game.gameDirPath ? resolve(game.gameDirPath, execPath) : resolve(execPath)

    // Check if executable exists
    if (!existsSync(absolutePath)) {
      throw new Error(`Executable not found: ${absolutePath}`)
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
  }

  /**
   * Kill game process
   * @param gameId - The game ID
   * @throws Error when game is not running or kill fails
   */
  async killGame(gameId: string): Promise<GameStopResult> {
    const messages = this.i18nService.messages
    const toastId = this.notifyService.loading(messages.launcher.stopping)

    try {
      const result = await this.performKillGame(gameId)
      this.notifyService.update(toastId, {
        title: getStopResultTitle(messages, result),
        message: getStopResultMessage(messages, result),
        type: result.status === 'stopped' ? 'success' : 'warning',
        duration: result.status === 'stopped' ? 3000 : 5000
      })
      return result
    } catch (error) {
      this.notifyService.update(toastId, {
        title: messages.launcher.stopFailedTitle,
        message: formatKillErrorMessage(messages, error),
        type: 'error',
        duration: 5000
      })
      throw error
    }
  }

  private async performKillGame(gameId: string): Promise<GameStopResult> {
    const status = this.monitorService.game.getStatus(gameId)
    if (!status || !status.isRunning || !status.pid) {
      throw new Error('Game is not running')
    }

    // Windows uses taskkill command
    if (isWindows) {
      await runExternalCommand('taskkill', ['/F', '/PID', String(status.pid)])
    } else {
      // Unix-like systems use kill command
      process.kill(status.pid, 'SIGTERM')
    }

    const stopped = await this.monitorService.game.waitForStopped(gameId, STOP_DETECTION_TIMEOUT_MS)
    if (!stopped) {
      log.warn('Game stop was not confirmed by monitor.', { gameId: gameId, statusPid: status.pid })
      return { status: 'unconfirmed', reason: 'process-still-running' }
    }

    log.info('Game stop confirmed.', { gameId: gameId, statusPid: status.pid })
    return { status: 'stopped' }
  }
}

function formatLaunchErrorMessage(messages: Messages, error: unknown): string {
  const message = toErrorMessage(error)
  const errors = messages.launcher.errors

  if (message === 'Game not found') return errors.gameNotFound
  if (message === 'Launcher path is not set') return errors.launcherPathNotSet
  if (message.startsWith('File not found:')) return errors.fileNotFound
  if (message.startsWith('Executable not found:')) return errors.executableNotFound
  if (message.startsWith('Failed to open file:')) return errors.openFileFailed
  if (message.startsWith('Invalid URL format:')) return errors.invalidUrl
  if (message.startsWith('Unknown launcher mode:')) return errors.unknownMode

  return message
}

function getLaunchResultTitle(messages: Messages, result: GameLaunchResult): string {
  switch (result.status) {
    case 'detected':
      return messages.launcher.launchedTitle
    case 'cancelled':
      return messages.launcher.launchCancelledTitle
    case 'unconfirmed':
      return messages.launcher.launchRequestedTitle
  }
}

function getLaunchResultMessage(messages: Messages, result: GameLaunchResult): string | undefined {
  if (result.status !== 'unconfirmed') {
    return undefined
  }

  switch (result.reason) {
    case 'monitor-unavailable':
      return messages.launcher.monitorUnavailable
    case 'process-not-detected':
      return messages.launcher.processNotDetected
  }
}

function getStopResultTitle(messages: Messages, result: GameStopResult): string {
  switch (result.status) {
    case 'stopped':
      return messages.launcher.stoppedTitle
    case 'unconfirmed':
      return messages.launcher.stopRequestedTitle
  }
}

function getStopResultMessage(messages: Messages, result: GameStopResult): string | undefined {
  if (result.status !== 'unconfirmed') {
    return undefined
  }

  switch (result.reason) {
    case 'process-still-running':
      return messages.launcher.stopNotConfirmed
  }
}

function formatKillErrorMessage(messages: Messages, error: unknown): string {
  const message = toErrorMessage(error)

  if (message === 'Game is not running') return messages.launcher.errors.gameNotRunning
  if (message.includes('exited with code')) return messages.launcher.errors.stopProcessFailed

  return message
}

function isLaunchPathSelectionCancelled(error: unknown): boolean {
  return toErrorMessage(error) === 'Launcher path selection cancelled'
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
