/**
 * Anime Activity Handler
 *
 * Owns the anime watching workflow: picking the episode and file to play,
 * starting playback through the video service, and turning playback progress
 * into watch state. The engine supplies position facts; every domain decision
 * and database write lives here.
 */

import { existsSync } from 'node:fs'
import { and, asc, eq, sql } from 'drizzle-orm'

import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { IpcService } from '@main/services/ipc'
import type { VideoService } from '@main/services/video'
import {
  animeEpisodeFiles,
  animeEpisodes,
  animeExtraFiles,
  animeExtras,
  animeSessions,
  animes,
  type Anime,
  type AnimeEpisode,
  type AnimeEpisodeFile,
  type AnimeExtraFile
} from '@shared/db'
import type {
  AnimeExtraPlayingState,
  AnimeExtraPlayResult,
  AnimeExtraStopResult,
  AnimeStopResult,
  AnimeWatchingState,
  AnimeWatchResult
} from '@shared/activity'
import type { PlaybackTarget } from '@shared/video'
import type { ActivityHooks } from '../hooks'
import { RESUME_WRITE_INTERVAL_MS, isWatchedPosition, toResumePosition } from '../progress'

const log = createLogger('Activity')

interface WatchingSession {
  animeId: string
  episodeId: string
  startedAt: number
  lastResumeWriteAt: number
}

interface PlayingExtraSession {
  animeId: string
  extraId: string
}

export class AnimeActivityHandler {
  /** Playback sessions started by this handler, keyed by playback session id. */
  private readonly watching = new Map<string, WatchingSession>()
  /** Untracked-for-history extra sessions, keyed by playback session id. */
  private readonly playingExtras = new Map<string, PlayingExtraSession>()

  constructor(
    private readonly db: DbService,
    private readonly video: VideoService,
    private readonly ipc: IpcService,
    private readonly hooks: ActivityHooks
  ) {
    this.tapVideoHooks()
  }

  /**
   * Starts watching an anime.
   *
   * Without an episode the next unwatched one is chosen, which is what a user
   * pressing play on the entry itself means. A file id narrows playback to
   * that specific version instead of the primary election.
   */
  async watch(animeId: string, episodeId?: string, fileId?: string): Promise<AnimeWatchResult> {
    if (this.findSessionId(animeId)) {
      log.warn('Anime is already being watched.', { animeId })
      return { status: 'failed', reason: 'alreadyWatching' }
    }

    const anime = this.db.client.select().from(animes).where(eq(animes.id, animeId)).get()
    if (!anime) {
      log.warn('Anime to watch was not found.', { animeId })
      return { status: 'failed', reason: 'animeNotFound' }
    }

    const episode = episodeId ? this.readEpisode(animeId, episodeId) : this.readNextEpisode(animeId)
    if (!episode) {
      return { status: 'failed', reason: episodeId ? 'episodeNotFound' : 'noPlayableEpisode' }
    }

    const file = this.readPlayableFile(episode.id, fileId)
    if (!file) {
      log.warn('Episode has no playable file.', { animeId, episodeId: episode.id, fileId })
      return { status: 'failed', reason: 'noEpisodeFile' }
    }

    if (!existsSync(file.path)) {
      log.warn('Episode file is missing on disk.', { animeId, episodeId: episode.id })
      return { status: 'failed', reason: 'fileNotFound' }
    }

    const started = await this.video.sessions.start(this.toPlaybackTarget(anime, episode, file))
    if (started.status === 'failed') {
      log.warn('Anime playback failed to start.', {
        animeId,
        episodeId: episode.id,
        reason: started.reason
      })
      return {
        status: 'failed',
        reason: started.reason === 'engineNotFound' ? 'playerUnavailable' : 'playerStartFailed'
      }
    }

    const now = Date.now()
    this.watching.set(started.sessionId, {
      animeId,
      episodeId: episode.id,
      startedAt: now,
      lastResumeWriteAt: now
    })

    this.db.client
      .update(animes)
      .set({ lastActiveAt: new Date(now) })
      .where(eq(animes.id, animeId))
      .run()
    // Starting playback is the only status transition playback infers, guarded so
    // a user edit during engine startup is never clobbered. Completion stays a
    // user declaration: "every episode watched" would rest on metadata being
    // fully scraped, which never holds while a show is still airing.
    this.db.client
      .update(animes)
      .set({ status: 'active' })
      .where(and(eq(animes.id, animeId), eq(animes.status, 'planned')))
      .run()

    log.info('Anime playback started.', { animeId, episodeId: episode.id })
    this.ipc.send('activity:anime-started', {
      animeId,
      episodeId: episode.id,
      sessionId: started.sessionId
    })
    this.hooks.animeWatchStarted.dispatch({ animeId, episodeId: episode.id })

    return { status: 'started', episodeId: episode.id, sessionId: started.sessionId }
  }

  /**
   * Plays a supplementary asset through its primary file, or through the
   * requested version file. Extras carry no watch state: the session is
   * tracked for live UI only and nothing is recorded when it ends.
   */
  async playExtra(extraId: string, fileId?: string): Promise<AnimeExtraPlayResult> {
    if (this.findExtraSessionId(extraId)) {
      log.warn('Extra is already playing.', { extraId })
      return { status: 'failed', reason: 'alreadyPlaying' }
    }

    const row = this.db.client
      .select({ extra: animeExtras, animeName: animes.name })
      .from(animeExtras)
      .innerJoin(animes, eq(animeExtras.animeId, animes.id))
      .where(eq(animeExtras.id, extraId))
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

    const started = await this.video.sessions.start({
      path: file.path,
      title: `${row.animeName} · ${row.extra.name}`
    })

    if (started.status === 'failed') {
      log.warn('Extra playback failed to start.', { extraId, reason: started.reason })
      return {
        status: 'failed',
        reason: started.reason === 'engineNotFound' ? 'playerUnavailable' : 'playerStartFailed'
      }
    }

    const animeId = row.extra.animeId
    this.playingExtras.set(started.sessionId, { animeId, extraId })

    log.info('Extra playback started.', { animeId, extraId })
    this.ipc.send('activity:anime-extra-started', {
      animeId,
      extraId,
      sessionId: started.sessionId
    })

    return { status: 'started', sessionId: started.sessionId }
  }

  /** Stops the playback session currently playing this extra. */
  async stopExtra(extraId: string): Promise<AnimeExtraStopResult> {
    const sessionId = this.findExtraSessionId(extraId)
    if (!sessionId) {
      log.warn('Extra to stop is not playing.', { extraId })
      return { status: 'failed', reason: 'notPlaying' }
    }

    try {
      await this.video.sessions.stop(sessionId)
      return { status: 'stopped' }
    } catch (error) {
      log.error('Failed to stop extra playback.', error, { extraId })
      return { status: 'failed', reason: 'stopFailed' }
    }
  }

  /** Stops the playback session currently watching this anime. */
  async stop(animeId: string): Promise<AnimeStopResult> {
    const sessionId = this.findSessionId(animeId)
    if (!sessionId) {
      log.warn('Anime to stop is not being watched.', { animeId })
      return { status: 'failed', reason: 'notWatching' }
    }

    try {
      await this.video.sessions.stop(sessionId)
      return { status: 'stopped' }
    } catch (error) {
      log.error('Failed to stop anime playback.', error, { animeId })
      return { status: 'failed', reason: 'stopFailed' }
    }
  }

  /** Playback session id currently playing this anime, if any. */
  findSessionId(animeId: string): string | null {
    for (const [sessionId, session] of this.watching) {
      if (session.animeId === animeId) return sessionId
    }
    return null
  }

  /** Playback session id currently playing this extra, if any. */
  findExtraSessionId(extraId: string): string | null {
    for (const [sessionId, session] of this.playingExtras) {
      if (session.extraId === extraId) return sessionId
    }
    return null
  }

  /** Live watching states, letting a reloaded renderer resynchronize. */
  listWatching(): AnimeWatchingState[] {
    return [...this.watching.entries()].map(([sessionId, session]) => ({
      animeId: session.animeId,
      episodeId: session.episodeId,
      sessionId
    }))
  }

  /** Live extra playback states, letting a reloaded renderer resynchronize. */
  listPlayingExtras(): AnimeExtraPlayingState[] {
    return [...this.playingExtras.entries()].map(([sessionId, session]) => ({
      animeId: session.animeId,
      extraId: session.extraId,
      sessionId
    }))
  }

  async dispose(): Promise<void> {
    // stop() resolves only after the session's end report ran, so the final
    // watch session is recorded before the tracking map is cleared.
    for (const sessionId of [...this.watching.keys(), ...this.playingExtras.keys()]) {
      await this.video.sessions.stop(sessionId).catch((error) => {
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
  private tapVideoHooks(): void {
    this.video.hooks.progress.tap((progress) => {
      const session = this.watching.get(progress.sessionId)
      if (!session) return

      const now = Date.now()
      if (now - session.lastResumeWriteAt < RESUME_WRITE_INTERVAL_MS) return

      session.lastResumeWriteAt = now
      this.writeResumePosition(session.episodeId, progress.positionMs, progress.durationMs)
    })

    this.video.hooks.sessionEnded.tap((report) => {
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
      this.ipc.send('activity:anime-extra-stopped', {
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
    const { animeId, episodeId } = session
    const watched = isWatchedPosition(positionMs, durationMs)
    const endedAt = Date.now()

    this.db.client.transaction((tx) => {
      tx.insert(animeSessions)
        .values({
          animeId,
          episodeId,
          startedAt: new Date(session.startedAt),
          endedAt: new Date(endedAt)
        })
        .run()

      tx.update(animeEpisodes)
        .set(
          watched
            ? {
                watched: true,
                watchedAt: new Date(endedAt),
                playCount: sql`${animeEpisodes.playCount} + 1`,
                resumePositionMs: null
              }
            : { resumePositionMs: toResumePosition(positionMs) }
        )
        .where(eq(animeEpisodes.id, episodeId))
        .run()

      tx.update(animes)
        .set({
          lastActiveAt: new Date(endedAt),
          totalDuration: sql`${animes.totalDuration} + ${elapsedMs}`
        })
        .where(eq(animes.id, animeId))
        .run()
    })

    log.info('Watch session recorded.', {
      animeId,
      episodeId,
      watched,
      durationSeconds: Math.round(elapsedMs / 1000)
    })

    this.ipc.send('activity:anime-stopped', { animeId, episodeId, sessionId })
    this.hooks.animeWatchEnded.dispatch({
      animeId,
      episodeId,
      watched,
      watchTimeSeconds: Math.floor(elapsedMs / 1000)
    })
  }

  private writeResumePosition(
    episodeId: string,
    positionMs: number,
    durationMs: number | null
  ): void {
    if (isWatchedPosition(positionMs, durationMs)) return

    this.db.client
      .update(animeEpisodes)
      .set({ resumePositionMs: toResumePosition(positionMs) })
      .where(eq(animeEpisodes.id, episodeId))
      .run()
  }

  private toPlaybackTarget(
    anime: Anime,
    episode: AnimeEpisode,
    file: AnimeEpisodeFile
  ): PlaybackTarget {
    return {
      path: file.path,
      title: formatEpisodeTitle(anime, episode),
      ...(episode.resumePositionMs === null ? {} : { startPositionMs: episode.resumePositionMs })
    }
  }

  private readEpisode(animeId: string, episodeId: string): AnimeEpisode | undefined {
    return this.db.client
      .select()
      .from(animeEpisodes)
      .where(and(eq(animeEpisodes.id, episodeId), eq(animeEpisodes.animeId, animeId)))
      .get()
  }

  /** First unwatched episode that has a file, falling back to the first playable one. */
  private readNextEpisode(animeId: string): AnimeEpisode | undefined {
    const rows = this.db.client
      .selectDistinct({ episode: animeEpisodes })
      .from(animeEpisodes)
      .innerJoin(animeEpisodeFiles, eq(animeEpisodeFiles.episodeId, animeEpisodes.id))
      .where(eq(animeEpisodes.animeId, animeId))
      .orderBy(asc(animeEpisodes.orderInAnime))
      .all()

    const playable = rows.map((row) => row.episode)
    return playable.find((episode) => !episode.watched) ?? playable[0]
  }

  private readPlayableFile(episodeId: string, fileId?: string): AnimeEpisodeFile | undefined {
    const files = this.db.client
      .select()
      .from(animeEpisodeFiles)
      .where(eq(animeEpisodeFiles.episodeId, episodeId))
      .orderBy(asc(animeEpisodeFiles.createdAt))
      .all()

    // Matching inside the episode's own files keeps ownership validated.
    if (fileId) return files.find((file) => file.id === fileId)
    return files.find((file) => file.isPrimary) ?? files[0]
  }

  private readPlayableExtraFile(extraId: string, fileId?: string): AnimeExtraFile | undefined {
    const files = this.db.client
      .select()
      .from(animeExtraFiles)
      .where(eq(animeExtraFiles.extraId, extraId))
      .orderBy(asc(animeExtraFiles.createdAt))
      .all()

    // Matching inside the extra's own files keeps ownership validated.
    if (fileId) return files.find((file) => file.id === fileId)
    return files.find((file) => file.isPrimary) ?? files[0]
  }
}

/**
 * Playback window title for one playing episode.
 *
 * A film is its entry, so its single episode adds nothing but repetition; a
 * series names the episode being watched within it.
 */
function formatEpisodeTitle(anime: Anime, episode: AnimeEpisode): string {
  if (anime.format === 'movie') {
    return anime.name
  }

  const parts = [anime.name]
  if (episode.episodeNumber !== null) {
    parts.push(`#${episode.episodeNumber}`)
  }
  if (episode.name) {
    parts.push(episode.name)
  }
  return parts.join(' · ')
}
