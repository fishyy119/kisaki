/**
 * Game Launcher Handler
 *
 * Handles launching games via file, URL, or exec modes.
 */

import { shell } from 'electron'
import { platform } from '@electron-toolkit/utils'
import type { Game } from '@shared/db'
import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import spawn from 'cross-spawn'
import { createLogger } from '@main/log'
import type { MonitorService } from '@main/services/monitor'
import type { DbService } from '@main/services/db'
import type { NativeService } from '@main/services/native'
import { games } from '@shared/db'
import { eq } from 'drizzle-orm'
import { openExternalProtocol } from '@main/utils'

const log = createLogger('Launcher')

export class GameLauncherHandler {
  constructor(
    private dbService: DbService,
    private monitorService: MonitorService,
    private nativeService: NativeService
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
   * @throws Error when launch fails
   */
  async launchGame(
    gameId: string,
    options?: { cancelBehavior?: 'return' | 'throw' }
  ): Promise<void> {
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
        return
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

    // Start monitoring after successful launch
    await this.monitorService.game.startMonitoring(game.id)

    log.info('Game launched successfully.', { gameName: game.name, gameId: game.id })
  }

  private async selectLauncherPath(game: Game): Promise<string | null> {
    const filters =
      game.launcherMode === 'exec' && platform.isWindows
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
  async killGame(gameId: string): Promise<void> {
    const status = this.monitorService.game.getStatus(gameId)
    if (!status || !status.isRunning || !status.pid) {
      throw new Error('Game is not running')
    }

    // Windows uses taskkill command
    if (platform.isWindows) {
      await runExternalCommand('taskkill', ['/F', '/PID', String(status.pid)])
    } else {
      // Unix-like systems use kill command
      process.kill(status.pid, 'SIGTERM')
    }

    log.info('Killed game process.', { gameId: gameId, statusPid: status.pid })
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
