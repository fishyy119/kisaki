/**
 * Movie Activity Handler
 *
 * Owns the movie watching workflow: picking the release file to play, starting
 * playback through the player service, and turning playback progress into watch
 * state. A film is one consumption unit, so the watch state it maintains sits
 * on the entry row rather than on a part of it.
 */

import { existsSync } from 'node:fs'
import { and, asc, eq, sql } from 'drizzle-orm'

import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { IpcService } from '@main/services/ipc'
import type { PlayerService } from '@main/services/player'
import {
  movieExtraFiles,
  movieExtras,
  movieFiles,
  movieSessions,
  movies,
  type Movie,
  type MovieExtraFile,
  type MovieFile
} from '@shared/db'
import type {
  MovieExtraPlayingState,
  MovieExtraPlayResult,
  MovieExtraStopResult,
  MovieStopResult,
  MovieWatchingState,
  MovieWatchResult
} from '@shared/activity'
import type { PlaybackTarget } from '@shared/player'
import type { ActivityHooks } from '../hooks'
import { RESUME_WRITE_INTERVAL_MS, isWatchedPosition, toResumePosition } from './progress'

const log = createLogger('Activity')

interface WatchingSession {
  movieId: string
  fileId: string
  startedAt: number
  lastResumeWriteAt: number
}

interface PlayingExtraSession {
  movieId: string
  extraId: string
}

export class MovieActivityHandler {
  /** Playback sessions started by this handler, keyed by player session id. */
  private readonly watching = new Map<string, WatchingSession>()
  /** Untracked-for-history extra sessions, keyed by player session id. */
  private readonly playingExtras = new Map<string, PlayingExtraSession>()

  constructor(
    private readonly db: DbService,
    private readonly player: PlayerService,
    private readonly ipc: IpcService,
    private readonly hooks: ActivityHooks
  ) {
    this.tapPlayerHooks()
  }

  /**
   * Starts watching a movie.
   *
   * A file id picks one of the entry's releases; without it the primary
   * release plays, which is what pressing play on the entry means.
   */
  async watch(movieId: string, fileId?: string): Promise<MovieWatchResult> {
    if (this.findSessionId(movieId)) {
      log.warn('Movie is already being watched.', { movieId })
      return { status: 'failed', reason: 'alreadyWatching' }
    }

    const movie = this.db.client.select().from(movies).where(eq(movies.id, movieId)).get()
    if (!movie) {
      log.warn('Movie to watch was not found.', { movieId })
      return { status: 'failed', reason: 'movieNotFound' }
    }

    const file = this.readPlayableFile(movieId, fileId)
    if (!file) {
      log.warn('Movie has no playable file.', { movieId, fileId })
      return { status: 'failed', reason: 'noMovieFile' }
    }

    if (!existsSync(file.path)) {
      log.warn('Movie file is missing on disk.', { movieId, fileId: file.id })
      return { status: 'failed', reason: 'fileNotFound' }
    }

    const started = await this.player.sessions.start(this.toPlaybackTarget(movie, file))
    if (started.status === 'failed') {
      log.warn('Movie playback failed to start.', {
        movieId,
        fileId: file.id,
        reason: started.reason
      })
      return {
        status: 'failed',
        reason: started.reason === 'engineNotFound' ? 'playerUnavailable' : 'playerStartFailed'
      }
    }

    const now = Date.now()
    this.watching.set(started.sessionId, {
      movieId,
      fileId: file.id,
      startedAt: now,
      lastResumeWriteAt: now
    })

    this.db.client
      .update(movies)
      .set({ lastActiveAt: new Date(now) })
      .where(eq(movies.id, movieId))
      .run()
    // Starting playback is the only status transition playback infers, guarded so
    // a user edit during player startup is never clobbered. Reaching the end of
    // the film marks it watched, but the entry's status stays the user's call.
    this.db.client
      .update(movies)
      .set({ status: 'watching' })
      .where(and(eq(movies.id, movieId), eq(movies.status, 'planned')))
      .run()

    log.info('Movie playback started.', { movieId, fileId: file.id })
    this.ipc.send('activity:movie-started', {
      movieId,
      fileId: file.id,
      sessionId: started.sessionId
    })
    this.hooks.movieWatchStarted.dispatch({ movieId })

    return { status: 'started', fileId: file.id, sessionId: started.sessionId }
  }

  /**
   * Plays a supplementary asset through its primary file, or through the
   * requested version file. Extras carry no watch state: the session is
   * tracked for live UI only and nothing is recorded when it ends.
   */
  async playExtra(extraId: string, fileId?: string): Promise<MovieExtraPlayResult> {
    if (this.findExtraSessionId(extraId)) {
      log.warn('Extra is already playing.', { extraId })
      return { status: 'failed', reason: 'alreadyPlaying' }
    }

    const row = this.db.client
      .select({ extra: movieExtras, movieName: movies.name })
      .from(movieExtras)
      .innerJoin(movies, eq(movieExtras.movieId, movies.id))
      .where(eq(movieExtras.id, extraId))
      .get()
    if (!row) {
      log.warn('Extra to play was not found.', { extraId })
      return { status: 'failed', reason: 'extraNotFound' }
    }

    const file = this.readPlayableExtraFile(extraId, fileId)
    if (!file) {
      log.warn('Extra has no playable file.', { extraId, fileId })
      return { status: 'failed', reason: 'noExtraFile' }
    }

    if (!existsSync(file.path)) {
      log.warn('Extra file is missing on disk.', { extraId })
      return { status: 'failed', reason: 'fileNotFound' }
    }

    const { playerAudioLanguages, playerSubtitleLanguages } = this.db.settings.get()
    const started = await this.player.sessions.start({
      path: file.path,
      title: `${row.movieName} · ${row.extra.name}`,
      trackPreference: {
        audioLanguages: playerAudioLanguages,
        subtitleLanguages: playerSubtitleLanguages
      }
    })

    if (started.status === 'failed') {
      log.warn('Extra playback failed to start.', { extraId, reason: started.reason })
      return {
        status: 'failed',
        reason: started.reason === 'engineNotFound' ? 'playerUnavailable' : 'playerStartFailed'
      }
    }

    const movieId = row.extra.movieId
    this.playingExtras.set(started.sessionId, { movieId, extraId })

    log.info('Extra playback started.', { movieId, extraId })
    this.ipc.send('activity:movie-extra-started', {
      movieId,
      extraId,
      sessionId: started.sessionId
    })

    return { status: 'started', sessionId: started.sessionId }
  }

  /** Stops the playback session currently playing this extra. */
  async stopExtra(extraId: string): Promise<MovieExtraStopResult> {
    const sessionId = this.findExtraSessionId(extraId)
    if (!sessionId) {
      log.warn('Extra to stop is not playing.', { extraId })
      return { status: 'failed', reason: 'notPlaying' }
    }

    try {
      await this.player.sessions.stop(sessionId)
      return { status: 'stopped' }
    } catch (error) {
      log.error('Failed to stop extra playback.', error, { extraId })
      return { status: 'failed', reason: 'stopFailed' }
    }
  }

  /** Stops the playback session currently watching this movie. */
  async stop(movieId: string): Promise<MovieStopResult> {
    const sessionId = this.findSessionId(movieId)
    if (!sessionId) {
      log.warn('Movie to stop is not being watched.', { movieId })
      return { status: 'failed', reason: 'notWatching' }
    }

    try {
      await this.player.sessions.stop(sessionId)
      return { status: 'stopped' }
    } catch (error) {
      log.error('Failed to stop movie playback.', error, { movieId })
      return { status: 'failed', reason: 'stopFailed' }
    }
  }

  /** Player session id currently playing this movie, if any. */
  findSessionId(movieId: string): string | null {
    for (const [sessionId, session] of this.watching) {
      if (session.movieId === movieId) return sessionId
    }
    return null
  }

  /** Player session id currently playing this extra, if any. */
  findExtraSessionId(extraId: string): string | null {
    for (const [sessionId, session] of this.playingExtras) {
      if (session.extraId === extraId) return sessionId
    }
    return null
  }

  /** Live watching states, letting a reloaded renderer resynchronize. */
  listWatching(): MovieWatchingState[] {
    return [...this.watching.entries()].map(([sessionId, session]) => ({
      movieId: session.movieId,
      fileId: session.fileId,
      sessionId
    }))
  }

  /** Live extra playback states, letting a reloaded renderer resynchronize. */
  listPlayingExtras(): MovieExtraPlayingState[] {
    return [...this.playingExtras.entries()].map(([sessionId, session]) => ({
      movieId: session.movieId,
      extraId: session.extraId,
      sessionId
    }))
  }

  async dispose(): Promise<void> {
    // stop() resolves only after the session's end report ran, so the final
    // watch session is recorded before the tracking map is cleared.
    for (const sessionId of [...this.watching.keys(), ...this.playingExtras.keys()]) {
      await this.player.sessions.stop(sessionId).catch((error) => {
        log.warn('Failed to stop playback session during dispose.', error, { sessionId })
      })
    }
    this.watching.clear()
    this.playingExtras.clear()
  }

  /**
   * Translates playback facts into watch state. Progress only maintains the
   * resume point; watched state is decided once, when the session ends.
   */
  private tapPlayerHooks(): void {
    this.player.hooks.progress.tap((progress) => {
      const session = this.watching.get(progress.sessionId)
      if (!session) return

      const now = Date.now()
      if (now - session.lastResumeWriteAt < RESUME_WRITE_INTERVAL_MS) return

      session.lastResumeWriteAt = now
      this.writeResumePosition(session.movieId, progress.positionMs, progress.durationMs)
    })

    this.player.hooks.sessionEnded.tap((report) => {
      const session = this.watching.get(report.sessionId)
      if (session) {
        this.watching.delete(report.sessionId)
        this.recordWatchSession(
          report.sessionId,
          session,
          report.positionMs,
          report.durationMs,
          report.elapsedMs
        )
        return
      }

      const extraSession = this.playingExtras.get(report.sessionId)
      if (!extraSession) return

      this.playingExtras.delete(report.sessionId)
      log.info('Extra playback ended.', extraSession)
      this.ipc.send('activity:movie-extra-stopped', {
        ...extraSession,
        sessionId: report.sessionId
      })
    })
  }

  private recordWatchSession(
    sessionId: string,
    session: WatchingSession,
    positionMs: number,
    durationMs: number | null,
    elapsedMs: number
  ): void {
    const { movieId } = session
    const watched = isWatchedPosition(positionMs, durationMs)
    const endedAt = Date.now()

    this.db.client.transaction((tx) => {
      tx.insert(movieSessions)
        .values({
          movieId,
          startedAt: new Date(session.startedAt),
          endedAt: new Date(endedAt)
        })
        .run()

      tx.update(movies)
        .set({
          lastActiveAt: new Date(endedAt),
          totalDuration: sql`${movies.totalDuration} + ${elapsedMs}`,
          ...(watched
            ? {
                watched: true,
                watchedAt: new Date(endedAt),
                playCount: sql`${movies.playCount} + 1`,
                resumePositionMs: null
              }
            : { resumePositionMs: toResumePosition(positionMs) })
        })
        .where(eq(movies.id, movieId))
        .run()
    })

    log.info('Watch session recorded.', {
      movieId,
      watched,
      durationSeconds: Math.round(elapsedMs / 1000)
    })

    this.ipc.send('activity:movie-stopped', { movieId, fileId: session.fileId, sessionId })
    this.hooks.movieWatchEnded.dispatch({
      movieId,
      watched,
      watchTimeSeconds: Math.floor(elapsedMs / 1000)
    })
  }

  private writeResumePosition(
    movieId: string,
    positionMs: number,
    durationMs: number | null
  ): void {
    if (isWatchedPosition(positionMs, durationMs)) return

    this.db.client
      .update(movies)
      .set({ resumePositionMs: toResumePosition(positionMs) })
      .where(eq(movies.id, movieId))
      .run()
  }

  private toPlaybackTarget(movie: Movie, file: MovieFile): PlaybackTarget {
    const { playerAudioLanguages, playerSubtitleLanguages } = this.db.settings.get()

    return {
      path: file.path,
      title: file.edition ? `${movie.name} · ${file.edition}` : movie.name,
      ...(movie.resumePositionMs === null ? {} : { startPositionMs: movie.resumePositionMs }),
      trackPreference: {
        audioLanguages: playerAudioLanguages,
        subtitleLanguages: playerSubtitleLanguages
      }
    }
  }

  private readPlayableFile(movieId: string, fileId?: string): MovieFile | undefined {
    const files = this.db.client
      .select()
      .from(movieFiles)
      .where(eq(movieFiles.movieId, movieId))
      .orderBy(asc(movieFiles.createdAt))
      .all()

    // Matching inside the movie's own files keeps ownership validated.
    if (fileId) return files.find((file) => file.id === fileId)
    return files.find((file) => file.isPrimary) ?? files[0]
  }

  private readPlayableExtraFile(extraId: string, fileId?: string): MovieExtraFile | undefined {
    const files = this.db.client
      .select()
      .from(movieExtraFiles)
      .where(eq(movieExtraFiles.extraId, extraId))
      .orderBy(asc(movieExtraFiles.createdAt))
      .all()

    // Matching inside the extra's own files keeps ownership validated.
    if (fileId) return files.find((file) => file.id === fileId)
    return files.find((file) => file.isPrimary) ?? files[0]
  }
}
