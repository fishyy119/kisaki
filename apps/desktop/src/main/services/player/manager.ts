/**
 * Playback Session Manager
 *
 * Owns the live playback sessions: spawning the engine, wiring its session to
 * the player hooks, and exposing transport control by session id. Progress is
 * throttled here because mpv reports `time-pos` several times per second while
 * subscribers only need a coarse position.
 */

import spawn from 'cross-spawn'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolveBundledBinary } from '@main/binaries'
import { createLogger } from '@main/log'
import type {
  PlaybackSessionState,
  PlaybackStartResult,
  PlaybackTarget,
  PlaybackStartFailureReason
} from '@shared/player'
import type { PlayerHooks } from './hooks'
import { buildIpcSocketPath, buildMpvArguments } from './mpv/arguments'
import { ensureMpvConfigDir } from './mpv/config'
import { MpvIpcClient } from './mpv/ipc-client'
import { PlaybackSession } from './session'

const log = createLogger('Player')

const IPC_CONNECT_TIMEOUT_MS = 8000
const PROGRESS_INTERVAL_MS = 1000

export class PlaybackSessionManager {
  private readonly sessions = new Map<string, PlaybackSession>()
  private readonly lastProgressAt = new Map<string, number>()

  constructor(private readonly hooks: PlayerHooks) {}

  /** True when a playback engine is available on this installation. */
  isEngineAvailable(): boolean {
    return resolveBundledBinary('mpv') !== null
  }

  list(): PlaybackSessionState[] {
    return [...this.sessions.values()].map((session) => session.state)
  }

  async start(target: PlaybackTarget): Promise<PlaybackStartResult> {
    const failure = this.validateTarget(target)
    if (failure) {
      log.warn('Playback could not start.', { reason: failure })
      return { status: 'failed', reason: failure }
    }

    const enginePath = resolveBundledBinary('mpv')
    if (!enginePath) {
      return { status: 'failed', reason: 'engineNotFound' }
    }

    const sessionId = randomUUID()
    const socketPath = buildIpcSocketPath(sessionId)
    // Ensured per start so a user deleting the directory self-heals.
    const configDir = ensureMpvConfigDir()
    const child = spawn(enginePath, buildMpvArguments(target, socketPath, configDir), {
      detached: false,
      stdio: 'ignore'
    })

    if (!child.pid) {
      log.warn('Playback engine did not start.', { sessionId })
      return { status: 'failed', reason: 'engineStartFailed' }
    }

    const client = new MpvIpcClient(socketPath)
    if (!(await client.connect(IPC_CONNECT_TIMEOUT_MS))) {
      client.dispose()
      child.kill()
      log.warn('Playback engine did not expose its IPC socket in time.', { sessionId })
      return { status: 'failed', reason: 'engineNotResponding' }
    }

    const session = new PlaybackSession(sessionId, target, child, client, {
      onProgress: (state) => this.dispatchProgress(state),
      onStatusChanged: (state) => this.hooks.statusChanged.dispatch(state),
      onEnded: (report) => {
        this.sessions.delete(report.sessionId)
        this.lastProgressAt.delete(report.sessionId)
        this.hooks.sessionEnded.dispatch(report)
      }
    })

    this.sessions.set(sessionId, session)
    // Started dispatches before observation so status/progress updates never
    // precede the session's own start announcement.
    log.info('Playback session started.', { sessionId, enginePid: child.pid })
    this.hooks.sessionStarted.dispatch(session.state)

    try {
      await session.observe()
    } catch (error) {
      // The engine died while loading (bad file, immediate exit); the session
      // still emits its end report through the exit path awaited by stop().
      log.warn('Playback engine dropped IPC during property observation.', error, { sessionId })
      await session.stop()
      return { status: 'failed', reason: 'engineNotResponding' }
    }

    return { status: 'started', sessionId }
  }

  async pause(sessionId: string): Promise<void> {
    await this.require(sessionId).pause()
  }

  async resume(sessionId: string): Promise<void> {
    await this.require(sessionId).resume()
  }

  async seek(sessionId: string, positionMs: number): Promise<void> {
    await this.require(sessionId).seek(positionMs)
  }

  async stop(sessionId: string): Promise<void> {
    await this.require(sessionId).stop()
  }

  async dispose(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => session.stop()))
    this.sessions.clear()
    this.lastProgressAt.clear()
  }

  private require(sessionId: string): PlaybackSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Playback session "${sessionId}" is not active.`)
    }
    return session
  }

  private validateTarget(target: PlaybackTarget): PlaybackStartFailureReason | null {
    if (!existsSync(target.path)) {
      return 'fileNotFound'
    }
    return null
  }

  private dispatchProgress(state: PlaybackSessionState): void {
    const now = Date.now()
    const last = this.lastProgressAt.get(state.sessionId) ?? 0
    if (now - last < PROGRESS_INTERVAL_MS) {
      return
    }

    this.lastProgressAt.set(state.sessionId, now)
    this.hooks.progress.dispatch({
      sessionId: state.sessionId,
      positionMs: state.positionMs,
      durationMs: state.durationMs
    })
  }
}
