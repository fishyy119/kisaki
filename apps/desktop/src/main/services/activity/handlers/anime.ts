/**
 * Anime Activity Handler
 *
 * Owns the anime watching workflow: picking the episode and file to play,
 * starting playback through the player service, and turning playback progress
 * into watch state. The player supplies position facts; every domain decision
 * and database write lives here.
 */

import { existsSync } from 'node:fs'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import { createLogger } from '@main/log'
import type { DbContext, DbService } from '@main/services/db'
import type { IpcService } from '@main/services/ipc'
import type { PlayerService } from '@main/services/player'
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
  AnimeExtraPlayResult,
  AnimeStopResult,
  AnimeWatchingState,
  AnimeWatchResult
} from '@shared/activity'
import type { PlaybackTarget } from '@shared/player'
import type { ActivityHooks } from '../hooks'

const log = createLogger('Activity')

/**
 * Fraction of an episode that counts as watched.
 *
 * Releases carry endings and previews after the story ends, so demanding the
 * final seconds would leave most finished episodes unwatched.
 */
const WATCHED_POSITION_RATIO = 0.9

/** Below this, a stop is a mis-click rather than a resume point worth keeping. */
const MIN_RESUME_POSITION_MS = 30_000

/** Progress is reported every second; persisting a resume point that often is waste. */
const RESUME_WRITE_INTERVAL_MS = 15_000

interface WatchingSession {
  animeId: string
  episodeId: string
  startedAt: number
  lastResumeWriteAt: number
}

export class AnimeActivityHandler {
  /** Playback sessions started by this handler, keyed by player session id. */
  private readonly watching = new Map<string, WatchingSession>()

  constructor(
    private readonly db: DbService,
    private readonly player: PlayerService,
    private readonly ipc: IpcService,
    private readonly hooks: ActivityHooks
  ) {
    this.tapPlayerHooks()
  }

  /**
   * Starts watching an anime.
   *
   * Without an episode the next unwatched one is chosen, which is what a user
   * pressing play on the entry itself means.
   */
  async watch(animeId: string, episodeId?: string): Promise<AnimeWatchResult> {
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

    const file = this.readPlayableFile(episode.id)
    if (!file) {
      log.warn('Episode has no playable file.', { animeId, episodeId: episode.id })
      return { status: 'failed', reason: 'noEpisodeFile' }
    }

    if (!existsSync(file.path)) {
      log.warn('Episode file is missing on disk.', { animeId, episodeId: episode.id })
      return { status: 'failed', reason: 'fileNotFound' }
    }

    const started = await this.player.sessions.start(this.toPlaybackTarget(anime, episode, file))
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
    // Guarded by status so a user edit during player startup is never clobbered.
    this.db.client
      .update(animes)
      .set({ status: 'watching' })
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
   * Plays a supplementary asset through its primary file. Extras carry no
   * watch state, so the session is not tracked and nothing is recorded when
   * it ends.
   */
  async playExtra(extraId: string): Promise<AnimeExtraPlayResult> {
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

    const file = this.readPlayableExtraFile(extraId)
    if (!file) {
      log.warn('Extra has no playable file.', { extraId })
      return { status: 'failed', reason: 'noExtraFile' }
    }

    if (!existsSync(file.path)) {
      log.warn('Extra file is missing on disk.', { extraId })
      return { status: 'failed', reason: 'fileNotFound' }
    }

    const { playerAudioLanguages, playerSubtitleLanguages } = this.db.settings.get()
    const started = await this.player.sessions.start({
      path: file.path,
      title: `${row.animeName} · ${row.extra.name}`,
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

    return { status: 'started', sessionId: started.sessionId }
  }

  /** Stops the playback session currently watching this anime. */
  async stop(animeId: string): Promise<AnimeStopResult> {
    const sessionId = this.findSessionId(animeId)
    if (!sessionId) {
      log.warn('Anime to stop is not being watched.', { animeId })
      return { status: 'failed', reason: 'notWatching' }
    }

    try {
      await this.player.sessions.stop(sessionId)
      return { status: 'stopped' }
    } catch (error) {
      log.error('Failed to stop anime playback.', error, { animeId })
      return { status: 'failed', reason: 'stopFailed' }
    }
  }

  /** Player session id currently playing this anime, if any. */
  findSessionId(animeId: string): string | null {
    for (const [sessionId, session] of this.watching) {
      if (session.animeId === animeId) return sessionId
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

  async dispose(): Promise<void> {
    // stop() resolves only after the session's end report ran, so the final
    // watch session is recorded before the tracking map is cleared.
    for (const sessionId of [...this.watching.keys()]) {
      await this.player.sessions.stop(sessionId).catch((error) => {
        log.warn('Failed to stop playback session during dispose.', error, { sessionId })
      })
    }
    this.watching.clear()
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
      this.writeResumePosition(session.episodeId, progress.positionMs, progress.durationMs)
    })

    this.player.hooks.sessionEnded.tap((report) => {
      const session = this.watching.get(report.sessionId)
      if (!session) return

      this.watching.delete(report.sessionId)
      this.recordWatchSession(
        report.sessionId,
        session,
        report.positionMs,
        report.durationMs,
        report.elapsedMs
      )
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

      if (watched) {
        this.advanceAnimeStatus(tx, animeId)
      }
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

  /** An entry is completed once no regular episode is left unwatched. */
  private advanceAnimeStatus(tx: DbContext, animeId: string): void {
    const [pending] = tx
      .select()
      .from(animeEpisodes)
      .where(
        and(
          eq(animeEpisodes.animeId, animeId),
          eq(animeEpisodes.type, 'regular'),
          isNull(animeEpisodes.watchedAt)
        )
      )
      .limit(1)
      .all()

    if (pending) return

    tx.update(animes).set({ status: 'completed' }).where(eq(animes.id, animeId)).run()
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
    const { playerAudioLanguages, playerSubtitleLanguages } = this.db.settings.get()

    return {
      path: file.path,
      title: formatEpisodeTitle(anime, episode),
      ...(episode.resumePositionMs === null ? {} : { startPositionMs: episode.resumePositionMs }),
      trackPreference: {
        audioLanguages: playerAudioLanguages,
        subtitleLanguages: playerSubtitleLanguages
      }
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
    return playable.find((episode) => episode.watchedAt === null) ?? playable[0]
  }

  private readPlayableFile(episodeId: string): AnimeEpisodeFile | undefined {
    const files = this.db.client
      .select()
      .from(animeEpisodeFiles)
      .where(eq(animeEpisodeFiles.episodeId, episodeId))
      .orderBy(asc(animeEpisodeFiles.createdAt))
      .all()

    return files.find((file) => file.isPrimary) ?? files[0]
  }

  private readPlayableExtraFile(extraId: string): AnimeExtraFile | undefined {
    const files = this.db.client
      .select()
      .from(animeExtraFiles)
      .where(eq(animeExtraFiles.extraId, extraId))
      .orderBy(asc(animeExtraFiles.createdAt))
      .all()

    return files.find((file) => file.isPrimary) ?? files[0]
  }
}

function isWatchedPosition(positionMs: number, durationMs: number | null): boolean {
  return durationMs !== null && durationMs > 0 && positionMs >= durationMs * WATCHED_POSITION_RATIO
}

function toResumePosition(positionMs: number): number | null {
  return positionMs >= MIN_RESUME_POSITION_MS ? Math.floor(positionMs) : null
}

function formatEpisodeTitle(anime: Anime, episode: AnimeEpisode): string {
  const parts = [anime.name]
  if (episode.episodeNumber !== null) {
    parts.push(`#${episode.episodeNumber}`)
  }
  if (episode.name) {
    parts.push(episode.name)
  }
  return parts.join(' · ')
}
