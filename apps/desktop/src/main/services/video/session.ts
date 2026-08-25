/**
 * Playback Session
 *
 * One mpv process plus its IPC connection, projected onto the shared playback
 * state machine. The session is the only place that knows mpv vocabulary: it
 * translates property changes and `end-file` reasons into playback status and
 * end reasons, and it reports the last observed position so a caller can resume.
 */

import type { ChildProcess } from 'node:child_process'
import { createLogger } from '@main/log'
import type {
  PlaybackEndReason,
  PlaybackEndReport,
  PlaybackSessionState,
  PlaybackStatus,
  PlaybackTarget
} from '@shared/video'
import { MpvIpcClient, type MpvEvent } from './mpv/ipc-client'

const log = createLogger('Video')

/** Observed property ids; mpv echoes these back on every property change. */
const PROPERTY_TIME_POS = 1
const PROPERTY_DURATION = 2
const PROPERTY_PAUSE = 3

/** Grace period for the engine to exit after acknowledging `quit`. */
const QUIT_EXIT_TIMEOUT_MS = 5000
/** Grace period for the process to die after an escalated kill. */
const KILL_EXIT_TIMEOUT_MS = 2000

export interface PlaybackSessionCallbacks {
  onProgress: (state: PlaybackSessionState) => void
  onStatusChanged: (state: PlaybackSessionState) => void
  onEnded: (report: PlaybackEndReport) => void
}

export class PlaybackSession {
  private status: PlaybackStatus = 'loading'
  private positionMs = 0
  private durationMs: number | null = null
  private endReason: PlaybackEndReason | null = null
  private finished = false
  private readonly startedAt = Date.now()
  private resolveFinished!: () => void
  /** Settles when the end report has been emitted; see {@link finish}. */
  private readonly whenFinished = new Promise<void>((resolve) => {
    this.resolveFinished = resolve
  })

  constructor(
    readonly id: string,
    private readonly target: PlaybackTarget,
    private readonly child: ChildProcess,
    private readonly client: MpvIpcClient,
    private readonly callbacks: PlaybackSessionCallbacks
  ) {
    this.positionMs = target.startPositionMs ?? 0
    this.client.onEvent((event) => this.handleEvent(event))
    this.client.onClose(() => this.finish('closed'))
    this.child.once('exit', () => this.finish('closed'))
  }

  /** Subscribes to the properties the session projects into its state. */
  async observe(): Promise<void> {
    await this.client.observeProperty(PROPERTY_TIME_POS, 'time-pos')
    await this.client.observeProperty(PROPERTY_DURATION, 'duration')
    await this.client.observeProperty(PROPERTY_PAUSE, 'pause')
  }

  get state(): PlaybackSessionState {
    return {
      sessionId: this.id,
      path: this.target.path,
      status: this.status,
      positionMs: this.positionMs,
      durationMs: this.durationMs
    }
  }

  async pause(): Promise<void> {
    await this.client.setProperty('pause', true)
  }

  async resume(): Promise<void> {
    await this.client.setProperty('pause', false)
  }

  async seek(positionMs: number): Promise<void> {
    await this.client.setProperty('time-pos', positionMs / 1000)
  }

  /**
   * Requests a graceful quit and resolves only after the end report has been
   * emitted, so callers (including service disposal) observe the terminal
   * position and the subscribers' bookkeeping instead of racing the exit.
   */
  async stop(): Promise<void> {
    this.endReason = 'stopped'

    try {
      await this.client.command('quit')
    } catch {
      // A session whose IPC is already gone is killed instead.
      this.child.kill()
    }

    await Promise.race([this.whenFinished, delay(QUIT_EXIT_TIMEOUT_MS)])
    if (this.finished) return

    this.child.kill()
    await Promise.race([this.whenFinished, delay(KILL_EXIT_TIMEOUT_MS)])
    if (!this.finished) {
      // A process that survives the kill must not keep the session open.
      this.finish('closed')
    }
  }

  private handleEvent(event: MpvEvent): void {
    switch (event.event) {
      case 'property-change':
        this.handlePropertyChange(event)
        return
      case 'end-file':
        this.endReason = toEndReason(event.reason)
        return
      case 'playback-restart':
        this.setStatus('playing')
    }
  }

  private handlePropertyChange(event: MpvEvent): void {
    switch (event.name) {
      case 'time-pos': {
        if (typeof event.data !== 'number') {
          return
        }
        this.positionMs = Math.max(0, Math.round(event.data * 1000))
        this.callbacks.onProgress(this.state)
        return
      }
      case 'duration': {
        this.durationMs = typeof event.data === 'number' ? Math.round(event.data * 1000) : null
        return
      }
      case 'pause': {
        if (typeof event.data !== 'boolean') {
          return
        }
        this.setStatus(event.data ? 'paused' : 'playing')
      }
    }
  }

  private setStatus(status: PlaybackStatus): void {
    if (this.status === status || this.finished) {
      return
    }

    this.status = status
    this.callbacks.onStatusChanged(this.state)
  }

  /**
   * Emits the single end report for this session. Process exit and socket close
   * both land here, so the first one wins and the fallback reason only applies
   * when no `end-file` event explained the stop.
   */
  private finish(fallbackReason: PlaybackEndReason): void {
    if (this.finished) {
      return
    }

    this.finished = true
    // Terminal state intentionally bypasses setStatus, so statusChanged never
    // broadcasts 'ended' - sessionEnded is the terminal signal.
    this.status = 'ended'
    this.client.dispose()

    const reason = this.endReason ?? fallbackReason
    log.info('Playback session ended.', {
      sessionId: this.id,
      reason,
      positionSeconds: Math.round(this.positionMs / 1000)
    })

    this.callbacks.onEnded({
      sessionId: this.id,
      path: this.target.path,
      reason,
      positionMs: this.positionMs,
      durationMs: this.durationMs,
      elapsedMs: Date.now() - this.startedAt
    })
    this.resolveFinished()
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.()
  })
}

function toEndReason(reason: string | undefined): PlaybackEndReason {
  switch (reason) {
    case 'eof':
      return 'completed'
    case 'error':
    case 'unknown':
      return 'error'
    case 'quit':
    case 'stop':
      return 'stopped'
    default:
      return 'closed'
  }
}
