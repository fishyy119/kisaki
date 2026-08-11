/**
 * Game Activity Handler
 *
 * Owns the game consumption workflow: resolving launch configuration, starting
 * the target through the process service, tracking the resulting process, and
 * recording play sessions. The process service supplies the technical facts;
 * every domain decision and database write lives here.
 */

import { and, eq, sql } from 'drizzle-orm'
import { basename, dirname, resolve } from 'node:path'
import { createLogger } from '@main/log'
import type { GameAttachmentHandler } from '@main/services/attachment'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { IpcService } from '@main/services/ipc'
import type { NativeService } from '@main/services/native'
import type {
  ProcessMatchRule,
  ProcessService,
  ProcessWatchStatus
} from '@main/services/process'
import { isWindows } from '@main/env'
import type { Game } from '@shared/db'
import { games, gameSessions } from '@shared/db'
import type {
  GameLaunchFailureReason,
  GameLaunchResult,
  GameMonitorPathConfig,
  GameRunningStatus,
  GameStopResult
} from '@shared/activity'
import type { ActivityHooks } from '../hooks'

const log = createLogger('Activity')

const LAUNCH_DETECTION_TIMEOUT_MS = 10000
const STOP_DETECTION_TIMEOUT_MS = 10000
const WATCH_PREFIX = 'game:'

interface TrackedGame {
  gameId: string
  name: string
  foregroundSince?: number
}

export class GameActivityHandler {
  /** Games with a live process watch, keyed by game id. */
  private readonly tracked = new Map<string, TrackedGame>()
  /** In-flight session inserts, awaited before a stop is announced. */
  private readonly pendingSessionSaves = new Map<string, Promise<void>>()

  constructor(
    private readonly db: DbService,
    private readonly processService: ProcessService,
    private readonly native: NativeService,
    private readonly i18n: I18nService,
    private readonly ipc: IpcService,
    private readonly gameAttachment: GameAttachmentHandler,
    private readonly hooks: ActivityHooks
  ) {
    this.tapProcessHooks()
  }

  /**
   * Launches a game and waits for its process to be detected.
   *
   * Every expected outcome is reported through the result; callers own the user
   * notifications and this handler logs the failure detail.
   */
  async launchGame(gameId: string): Promise<GameLaunchResult> {
    const game = this.db.client.select().from(games).where(eq(games.id, gameId)).get()
    if (!game) {
      log.warn('Game to launch was not found.', { gameId })
      return { status: 'failed', reason: 'gameNotFound' }
    }

    if (!game.launcherPath) {
      if (game.launcherMode === 'url') {
        log.warn('Launcher path is not set.', { gameId })
        return { status: 'failed', reason: 'launcherPathNotSet' }
      }

      const selected = await this.selectLauncherPath(game)
      if (!selected) {
        log.info('Launcher path selection cancelled.', { gameId })
        return { status: 'cancelled' }
      }

      this.db.client
        .update(games)
        .set({ launcherPath: selected })
        .where(eq(games.id, game.id))
        .run()
      game.launcherPath = selected
    }

    // Tracking matches against the persisted configuration: taps may redirect
    // the launch target, but the watch rule keeps following the installation.
    const monitorConfig: GameMonitorPathConfig = {
      monitorPath: game.monitorPath,
      monitorMode: game.monitorMode,
      gameDirPath: game.gameDirPath,
      launcherMode: game.launcherMode,
      launcherPath: game.launcherPath
    }

    // Taps may redirect the effective launch target; the change is never persisted.
    const launchConfig = await this.hooks.gameLaunching.transform({
      gameId: game.id,
      launcherMode: game.launcherMode,
      launcherPath: game.launcherPath,
      gameDirPath: game.gameDirPath
    })
    game.launcherMode = launchConfig.launcherMode
    game.launcherPath = launchConfig.launcherPath
    game.gameDirPath = launchConfig.gameDirPath

    const failureReason = await this.startLaunchTarget(game)
    if (failureReason) {
      return { status: 'failed', reason: failureReason }
    }

    if (!this.startTracking(game, monitorConfig)) {
      return { status: 'unconfirmed', reason: 'monitorUnavailable' }
    }

    const running = await this.processService.watch.waitForRunning(
      toWatchId(game.id),
      LAUNCH_DETECTION_TIMEOUT_MS
    )
    if (!running) {
      log.warn('Game launch was not confirmed by process detection.', { gameId: game.id })
      return { status: 'unconfirmed', reason: 'processNotDetected' }
    }

    this.markNotStartedAsInProgress(game)

    log.info('Game launch confirmed.', { gameId: game.id, processPid: running.pid })
    return running.pid === undefined
      ? { status: 'detected' }
      : { status: 'detected', pid: running.pid }
  }

  /** Terminates the running game process and waits for the stop to be observed. */
  async stopGame(gameId: string): Promise<GameStopResult> {
    const status = this.getStatus(gameId)
    if (!status?.isRunning || status.pid === undefined) {
      log.warn('Game to stop is not running.', { gameId })
      return { status: 'failed', reason: 'gameNotRunning' }
    }

    if (!(await this.processService.launch.terminate(status.pid))) {
      return { status: 'failed', reason: 'stopProcessFailed' }
    }

    const stopped = await this.processService.watch.waitForStopped(
      toWatchId(gameId),
      STOP_DETECTION_TIMEOUT_MS
    )
    if (!stopped) {
      log.warn('Game stop was not confirmed by process detection.', { gameId })
      return { status: 'unconfirmed' }
    }

    log.info('Game stop confirmed.', { gameId })
    return { status: 'stopped' }
  }

  /**
   * Starts tracking a game's process, reporting whether a match rule could be
   * derived from its configuration.
   */
  startTracking(game: Game, config: GameMonitorPathConfig = game): boolean {
    const rule = toMatchRule(config)
    if (!rule) {
      log.warn('Cannot track game: no monitor target could be resolved.', { gameId: game.id })
      return false
    }

    this.tracked.set(game.id, { gameId: game.id, name: game.name })
    this.processService.watch.start(toWatchId(game.id), rule)
    log.info('Started tracking game.', { gameId: game.id, monitorMode: config.monitorMode })
    return true
  }

  /** Stops tracking a game, closing any open session first. */
  stopTracking(gameId: string): void {
    this.processService.watch.stop(toWatchId(gameId))
    this.tracked.delete(gameId)
  }

  listStatuses(): GameRunningStatus[] {
    return this.processService.watch
      .list()
      .filter((status) => status.watchId.startsWith(WATCH_PREFIX))
      .map(toRunningStatus)
  }

  getStatus(gameId: string): GameRunningStatus | null {
    const status = this.processService.watch.get(toWatchId(gameId))
    return status ? toRunningStatus(status) : null
  }

  /**
   * Resolves the monitor target a game's configuration points at, so the launch
   * config form can preview exactly what tracking will match.
   */
  computeEffectivePath(config: GameMonitorPathConfig): string | null {
    return resolveMonitorTarget(config)
  }

  async dispose(): Promise<void> {
    for (const gameId of [...this.tracked.keys()]) {
      this.stopTracking(gameId)
    }
  }

  /**
   * Translates process facts into game domain effects. Foreground edges carry
   * the play time: a leaving edge is the only moment a session segment is
   * complete, and the watcher already debounced brief switches away.
   */
  private tapProcessHooks(): void {
    this.processService.hooks.processStarted.tap((payload) => {
      const tracked = this.findTracked(payload.watchId)
      if (!tracked) {
        return
      }

      const now = Date.now()
      this.db.client
        .update(games)
        .set({ lastActiveAt: new Date(now) })
        .where(eq(games.id, tracked.gameId))
        .run()

      log.info('Game process started.', { gameId: tracked.gameId, processPid: payload.pid })
      this.ipc.send('activity:game-started', tracked.gameId)
      this.hooks.sessionStarted.dispatch({ gameId: tracked.gameId, pid: payload.pid })
    })

    this.processService.hooks.foregroundChanged.tap(async (payload) => {
      const tracked = this.findTracked(payload.watchId)
      if (!tracked) {
        return
      }

      if (payload.isForeground) {
        tracked.foregroundSince = Date.now()
        this.ipc.send('activity:game-foreground', tracked.gameId)
        return
      }

      tracked.foregroundSince = undefined
      this.ipc.send('activity:game-background', tracked.gameId)
      if (payload.foregroundMs && payload.foregroundMs > 0) {
        // Registered synchronously so a stop edge arriving right after this
        // leaving edge can await the session insert before announcing.
        const save = this.savePlaySession(tracked.gameId, payload.foregroundMs).finally(() => {
          if (this.pendingSessionSaves.get(tracked.gameId) === save) {
            this.pendingSessionSaves.delete(tracked.gameId)
          }
        })
        this.pendingSessionSaves.set(tracked.gameId, save)
        await save
      }
    })

    this.processService.hooks.processStopped.tap(async (payload) => {
      const tracked = this.findTracked(payload.watchId)
      if (!tracked) {
        return
      }

      // The final session segment persists first, so subscribers reading the
      // database on the stop announcement see the completed session.
      await this.pendingSessionSaves.get(tracked.gameId)

      this.db.client
        .update(games)
        .set({ lastActiveAt: new Date() })
        .where(eq(games.id, tracked.gameId))
        .run()

      log.info('Game process stopped.', { gameId: tracked.gameId })

      this.gameAttachment.tryAutoBackup(tracked.gameId).catch((error) => {
        log.error('Save auto-backup failed.', error, { gameId: tracked.gameId })
      })

      this.ipc.send('activity:game-stopped', tracked.gameId)
      this.hooks.sessionEnded.dispatch({
        gameId: tracked.gameId,
        playTimeSeconds: Math.floor(payload.elapsedMs / 1000)
      })
    })
  }

  private findTracked(watchId: string): TrackedGame | undefined {
    if (!watchId.startsWith(WATCH_PREFIX)) {
      return undefined
    }
    return this.tracked.get(watchId.slice(WATCH_PREFIX.length))
  }

  private async savePlaySession(gameId: string, durationMs: number): Promise<void> {
    const record = await this.hooks.sessionEnding.transform({ gameId, durationMs })
    const now = Date.now()

    this.db.client
      .insert(gameSessions)
      .values({
        gameId,
        startedAt: new Date(now - record.durationMs),
        endedAt: new Date(now)
      })
      .run()

    this.db.client
      .update(games)
      .set({
        lastActiveAt: new Date(now),
        totalDuration: sql`${games.totalDuration} + ${record.durationMs}`
      })
      .where(eq(games.id, gameId))
      .run()

    log.info('Play session saved.', { gameId, durationSeconds: Math.round(record.durationMs / 1000) })
  }

  private markNotStartedAsInProgress(game: Game): void {
    if (game.status !== 'notStarted') {
      return
    }

    this.db.client
      .update(games)
      .set({ status: 'inProgress' })
      .where(and(eq(games.id, game.id), eq(games.status, 'notStarted')))
      .run()

    log.info('Game status advanced to in progress.', { gameId: game.id })
  }

  private async selectLauncherPath(game: Game): Promise<string | null> {
    const filters =
      game.launcherMode === 'exec' && isWindows
        ? [
            { name: 'Executable', extensions: ['exe', 'bat', 'cmd', 'com'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        : undefined

    const result = await this.native.dialogs.showOpenDialog({
      title: this.i18n.messages.activity.filePickerTitle,
      buttonLabel: this.i18n.messages.activity.filePickerButton,
      defaultPath: game.gameDirPath ?? undefined,
      properties: ['openFile'],
      filters
    })

    return result.canceled ? null : (result.filePaths[0] ?? null)
  }

  /** Starts the configured launch target, returning why it could not start. */
  private async startLaunchTarget(game: Game): Promise<GameLaunchFailureReason | null> {
    const launcherPath = game.launcherPath
    if (!launcherPath) {
      return 'launcherPathNotSet'
    }

    switch (game.launcherMode) {
      case 'file': {
        const result = await this.processService.launch.openFile(
          toAbsolutePath(launcherPath, game.gameDirPath)
        )
        return result.status === 'failed' ? result.reason : null
      }
      case 'url': {
        const result = await this.processService.launch.openUrl(launcherPath)
        return result.status === 'failed' ? result.reason : null
      }
      case 'exec': {
        const result = await this.processService.launch.exec(
          toAbsolutePath(launcherPath, game.gameDirPath),
          game.gameDirPath ?? undefined
        )
        return result.status === 'failed' ? result.reason : null
      }
    }
  }
}

function toWatchId(gameId: string): string {
  return `${WATCH_PREFIX}${gameId}`
}

function toRunningStatus(status: ProcessWatchStatus): GameRunningStatus {
  return {
    gameId: status.watchId.slice(WATCH_PREFIX.length),
    isRunning: status.isRunning,
    isForeground: status.isForeground,
    ...(status.processName === undefined ? {} : { processName: status.processName }),
    ...(status.pid === undefined ? {} : { pid: status.pid }),
    ...(status.exePath === undefined ? {} : { exePath: status.exePath }),
    ...(status.startedAt === undefined ? {} : { startTime: status.startedAt })
  }
}

function toAbsolutePath(path: string, baseDir: string | null): string {
  return baseDir ? resolve(baseDir, path) : resolve(path)
}

function toMatchRule(config: GameMonitorPathConfig): ProcessMatchRule | null {
  const value = resolveMonitorTarget(config)
  return value ? { mode: config.monitorMode, value } : null
}

function resolveMonitorTarget(config: GameMonitorPathConfig): string | null {
  if (config.monitorPath) {
    return config.monitorPath
  }

  switch (config.monitorMode) {
    case 'folder':
      return config.gameDirPath ?? (config.launcherPath ? dirname(config.launcherPath) : null)
    case 'file':
      return config.launcherMode === 'file' ? config.launcherPath : null
    case 'process':
      return config.launcherPath ? basename(config.launcherPath) : null
  }
}
