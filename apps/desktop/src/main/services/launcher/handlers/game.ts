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
import { games } from '@shared/db'
import type { GameLaunchResult, GameStopResult } from '@shared/launcher'
import { and, eq } from 'drizzle-orm'
import { openExternalProtocol } from '@main/utils/external-url'

const log = createLogger('Launcher')
const LAUNCH_DETECTION_TIMEOUT_MS = 10000
const STOP_DETECTION_TIMEOUT_MS = 10000

export class GameLauncherHandler {
  constructor(
    private dbService: DbService,
    private monitorService: MonitorService,
    private nativeService: NativeService,
    private notifyService: NotifyService
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
    const toastId = this.notifyService.loading('正在启动游戏')

    try {
      const result = await this.performLaunchGame(gameId, options)
      this.notifyService.update(toastId, {
        title: getLaunchResultTitle(result),
        message: getLaunchResultMessage(result),
        type: result.status === 'detected' ? 'success' : 'warning',
        duration: result.status === 'unconfirmed' ? 5000 : 3000
      })
      return result
    } catch (error) {
      const selectionCancelled = isLaunchPathSelectionCancelled(error)
      this.notifyService.update(toastId, {
        title: selectionCancelled ? '已取消启动' : '启动游戏失败',
        message: selectionCancelled ? undefined : formatLaunchErrorMessage(error),
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
      title: '选择启动文件',
      buttonLabel: '选择',
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
    const toastId = this.notifyService.loading('正在停止游戏')

    try {
      const result = await this.performKillGame(gameId)
      this.notifyService.update(toastId, {
        title: getStopResultTitle(result),
        message: getStopResultMessage(result),
        type: result.status === 'stopped' ? 'success' : 'warning',
        duration: result.status === 'stopped' ? 3000 : 5000
      })
      return result
    } catch (error) {
      this.notifyService.update(toastId, {
        title: '停止游戏失败',
        message: formatKillErrorMessage(error),
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

function formatLaunchErrorMessage(error: unknown): string {
  const message = toErrorMessage(error)

  if (message === 'Game not found') return '游戏不存在'
  if (message === 'Launcher path is not set') return '启动路径未设置'
  if (message.startsWith('File not found:')) return '启动文件不存在'
  if (message.startsWith('Executable not found:')) return '启动程序不存在'
  if (message.startsWith('Failed to open file:')) return '打开启动文件失败'
  if (message.startsWith('Invalid URL format:')) return '启动链接格式不正确'
  if (message.startsWith('Unknown launcher mode:')) return '未知启动方式'

  return message
}

function getLaunchResultTitle(result: GameLaunchResult): string {
  switch (result.status) {
    case 'detected':
      return '已启动游戏'
    case 'cancelled':
      return '已取消启动'
    case 'unconfirmed':
      return '启动请求已发送'
  }
}

function getLaunchResultMessage(result: GameLaunchResult): string | undefined {
  if (result.status !== 'unconfirmed') {
    return undefined
  }

  switch (result.reason) {
    case 'monitor-unavailable':
      return '无法开始进程检测，请检查监控配置'
    case 'process-not-detected':
      return '尚未检测到游戏进程，请检查监控配置'
  }
}

function getStopResultTitle(result: GameStopResult): string {
  switch (result.status) {
    case 'stopped':
      return '已停止游戏'
    case 'unconfirmed':
      return '停止请求已发送'
  }
}

function getStopResultMessage(result: GameStopResult): string | undefined {
  if (result.status !== 'unconfirmed') {
    return undefined
  }

  switch (result.reason) {
    case 'process-still-running':
      return '尚未确认游戏进程已停止'
  }
}

function formatKillErrorMessage(error: unknown): string {
  const message = toErrorMessage(error)

  if (message === 'Game is not running') return '游戏未运行'
  if (message.includes('exited with code')) return '停止进程失败'

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
