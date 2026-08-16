/**
 * TV Activity Handler
 *
 * Owns the tv watching workflow: picking the episode and file to play, starting
 * playback through the player service, and turning playback progress into watch
 * state. The player supplies position facts; every domain decision and database
 * write lives here.
 */

import { existsSync } from 'node:fs'
import { and, asc, eq, sql } from 'drizzle-orm'

import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { IpcService } from '@main/services/ipc'
import type { PlayerService } from '@main/services/player'
import {
  tvEpisodeFiles,
  tvEpisodes,
  tvExtraFiles,
  tvExtras,
  tvSeasons,
  tvSessions,
  tvs,
  type Tv,
  type TvEpisode,
  type TvEpisodeFile,
  type TvExtraFile
} from '@shared/db'
import type {
  TvExtraPlayingState,
  TvExtraPlayResult,
  TvExtraStopResult,
  TvStopResult,
  TvWatchingState,
  TvWatchResult
} from '@shared/activity'
import type { PlaybackTarget } from '@shared/player'
import type { ActivityHooks } from '../hooks'
import { RESUME_WRITE_INTERVAL_MS, isWatchedPosition, toResumePosition } from './progress'

const log = createLogger('Activity')

interface WatchingSession {
  tvId: string
  episodeId: string
  startedAt: number
  lastResumeWriteAt: number
}

interface PlayingExtraSession {
  tvId: string
  extraId: string
}

export class TvActivityHandler {
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
   * Starts watching a show.
   *
   * Without an episode the next unwatched one is chosen, which is what a user
   * pressing play on the entry itself means. A file id narrows playback to
   * that specific version instead of the primary election.
   */
  async watch(tvId: string, episodeId?: string, fileId?: string): Promise<TvWatchResult> {
    if (this.findSessionId(tvId)) {
      log.warn('TV series is already being watched.', { tvId })
      return { status: 'failed', reason: 'alreadyWatching' }
    }

    const tv = this.db.client.select().from(tvs).where(eq(tvs.id, tvId)).get()
    if (!tv) {
      log.warn('TV series to watch was not found.', { tvId })
      return { status: 'failed', reason: 'tvNotFound' }
    }

    const episode = episodeId ? this.readEpisode(tvId, episodeId) : this.readNextEpisode(tvId)
    if (!episode) {
      return { status: 'failed', reason: episodeId ? 'episodeNotFound' : 'noPlayableEpisode' }
    }

    const file = this.readPlayableFile(episode.id, fileId)
    if (!file) {
      log.warn('Episode has no playable file.', { tvId, episodeId: episode.id, fileId })
      return { status: 'failed', reason: 'noEpisodeFile' }
    }

    if (!existsSync(file.path)) {
      log.warn('Episode file is missing on disk.', { tvId, episodeId: episode.id })
      return { status: 'failed', reason: 'fileNotFound' }
    }

    const started = await this.player.sessions.start(this.toPlaybackTarget(tv, episode, file))
    if (started.status === 'failed') {
      log.warn('TV playback failed to start.', {
        tvId,
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
      tvId,
      episodeId: episode.id,
      startedAt: now,
      lastResumeWriteAt: now
    })

    this.db.client
      .update(tvs)
      .set({ lastActiveAt: new Date(now) })
      .where(eq(tvs.id, tvId))
      .run()
    // Starting playback is the only status transition playback infers, guarded so
    // a user edit during player startup is never clobbered. Completion stays a
    // user declaration: "every episode watched" would rest on metadata being
    // fully scraped, which never holds while a show is still airing.
    this.db.client
      .update(tvs)
      .set({ status: 'watching' })
      .where(and(eq(tvs.id, tvId), eq(tvs.status, 'planned')))
      .run()

    log.info('TV playback started.', { tvId, episodeId: episode.id })
    this.ipc.send('activity:tv-started', {
      tvId,
      episodeId: episode.id,
      sessionId: started.sessionId
    })
    this.hooks.tvWatchStarted.dispatch({ tvId, episodeId: episode.id })

    return { status: 'started', episodeId: episode.id, sessionId: started.sessionId }
  }

  /**
   * Plays a supplementary asset through its primary file, or through the
   * requested version file. Extras carry no watch state: the session is
   * tracked for live UI only and nothing is recorded when it ends.
   */
  async playExtra(extraId: string, fileId?: string): Promise<TvExtraPlayResult> {
    if (this.findExtraSessionId(extraId)) {
      log.warn('Extra is already playing.', { extraId })
      return { status: 'failed', reason: 'alreadyPlaying' }
    }

    const row = this.db.client
      .select({ extra: tvExtras, tvName: tvs.name })
      .from(tvExtras)
      .innerJoin(tvs, eq(tvExtras.tvId, tvs.id))
      .where(eq(tvExtras.id, extraId))
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
      title: `${row.tvName} · ${row.extra.name}`,
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

    const tvId = row.extra.tvId
    this.playingExtras.set(started.sessionId, { tvId, extraId })

    log.info('Extra playback started.', { tvId, extraId })
    this.ipc.send('activity:tv-extra-started', {
      tvId,
      extraId,
      sessionId: started.sessionId
    })

    return { status: 'started', sessionId: started.sessionId }
  }

  /** Stops the playback session currently playing this extra. */
  async stopExtra(extraId: string): Promise<TvExtraStopResult> {
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

  /** Stops the playback session currently watching this show. */
  async stop(tvId: string): Promise<TvStopResult> {
    const sessionId = this.findSessionId(tvId)
    if (!sessionId) {
      log.warn('TV series to stop is not being watched.', { tvId })
      return { status: 'failed', reason: 'notWatching' }
    }

    try {
      await this.player.sessions.stop(sessionId)
      return { status: 'stopped' }
    } catch (error) {
      log.error('Failed to stop TV playback.', error, { tvId })
      return { status: 'failed', reason: 'stopFailed' }
    }
  }

  /** Player session id currently playing this show, if any. */
  findSessionId(tvId: string): string | null {
    for (const [sessionId, session] of this.watching) {
      if (session.tvId === tvId) return sessionId
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
  listWatching(): TvWatchingState[] {
    return [...this.watching.entries()].map(([sessionId, session]) => ({
      tvId: session.tvId,
      episodeId: session.episodeId,
      sessionId
    }))
  }

  /** Live extra playback states, letting a reloaded renderer resynchronize. */
  listPlayingExtras(): TvExtraPlayingState[] {
    return [...this.playingExtras.entries()].map(([sessionId, session]) => ({
      tvId: session.tvId,
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
      this.writeResumePosition(session.episodeId, progress.positionMs, progress.durationMs)
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
      this.ipc.send('activity:tv-extra-stopped', {
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
    const { tvId, episodeId } = session
    const watched = isWatchedPosition(positionMs, durationMs)
    const endedAt = Date.now()

    this.db.client.transaction((tx) => {
      tx.insert(tvSessions)
        .values({
          tvId,
          episodeId,
          startedAt: new Date(session.startedAt),
          endedAt: new Date(endedAt)
        })
        .run()

      tx.update(tvEpisodes)
        .set(
          watched
            ? {
                watched: true,
                watchedAt: new Date(endedAt),
                playCount: sql`${tvEpisodes.playCount} + 1`,
                resumePositionMs: null
              }
            : { resumePositionMs: toResumePosition(positionMs) }
        )
        .where(eq(tvEpisodes.id, episodeId))
        .run()

      tx.update(tvs)
        .set({
          lastActiveAt: new Date(endedAt),
          totalDuration: sql`${tvs.totalDuration} + ${elapsedMs}`
        })
        .where(eq(tvs.id, tvId))
        .run()
    })

    log.info('Watch session recorded.', {
      tvId,
      episodeId,
      watched,
      durationSeconds: Math.round(elapsedMs / 1000)
    })

    this.ipc.send('activity:tv-stopped', { tvId, episodeId, sessionId })
    this.hooks.tvWatchEnded.dispatch({
      tvId,
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
      .update(tvEpisodes)
      .set({ resumePositionMs: toResumePosition(positionMs) })
      .where(eq(tvEpisodes.id, episodeId))
      .run()
  }

  private toPlaybackTarget(tv: Tv, episode: TvEpisode, file: TvEpisodeFile): PlaybackTarget {
    const { playerAudioLanguages, playerSubtitleLanguages } = this.db.settings.get()

    return {
      path: file.path,
      title: this.formatEpisodeTitle(tv, episode),
      ...(episode.resumePositionMs === null ? {} : { startPositionMs: episode.resumePositionMs }),
      trackPreference: {
        audioLanguages: playerAudioLanguages,
        subtitleLanguages: playerSubtitleLanguages
      }
    }
  }

  private readEpisode(tvId: string, episodeId: string): TvEpisode | undefined {
    return this.db.client
      .select()
      .from(tvEpisodes)
      .where(and(eq(tvEpisodes.id, episodeId), eq(tvEpisodes.tvId, tvId)))
      .get()
  }

  /** First unwatched episode that has a file, falling back to the first playable one. */
  private readNextEpisode(tvId: string): TvEpisode | undefined {
    const rows = this.db.client
      .selectDistinct({ episode: tvEpisodes })
      .from(tvEpisodes)
      .innerJoin(tvEpisodeFiles, eq(tvEpisodeFiles.episodeId, tvEpisodes.id))
      .where(eq(tvEpisodes.tvId, tvId))
      .orderBy(asc(tvEpisodes.orderInTv))
      .all()

    const playable = rows.map((row) => row.episode)
    return playable.find((episode) => !episode.watched) ?? playable[0]
  }

  private readPlayableFile(episodeId: string, fileId?: string): TvEpisodeFile | undefined {
    const files = this.db.client
      .select()
      .from(tvEpisodeFiles)
      .where(eq(tvEpisodeFiles.episodeId, episodeId))
      .orderBy(asc(tvEpisodeFiles.createdAt))
      .all()

    // Matching inside the episode's own files keeps ownership validated.
    if (fileId) return files.find((file) => file.id === fileId)
    return files.find((file) => file.isPrimary) ?? files[0]
  }

  private readPlayableExtraFile(extraId: string, fileId?: string): TvExtraFile | undefined {
    const files = this.db.client
      .select()
      .from(tvExtraFiles)
      .where(eq(tvExtraFiles.extraId, extraId))
      .orderBy(asc(tvExtraFiles.createdAt))
      .all()

    // Matching inside the extra's own files keeps ownership validated.
    if (fileId) return files.find((file) => file.id === fileId)
    return files.find((file) => file.isPrimary) ?? files[0]
  }

  /** `Show · S02E05 · Title`, the form viewers read season-numbered media in. */
  private formatEpisodeTitle(tv: Tv, episode: TvEpisode): string {
    const season = this.db.client
      .select({ seasonNumber: tvSeasons.seasonNumber })
      .from(tvSeasons)
      .where(eq(tvSeasons.id, episode.seasonId))
      .get()

    const parts = [tv.name]
    if (season && episode.episodeNumber !== null) {
      parts.push(formatSeasonEpisode(season.seasonNumber, episode.episodeNumber))
    }
    if (episode.name) {
      parts.push(episode.name)
    }
    return parts.join(' · ')
  }
}

function formatSeasonEpisode(seasonNumber: number, episodeNumber: number): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `S${pad(seasonNumber)}E${pad(episodeNumber)}`
}
