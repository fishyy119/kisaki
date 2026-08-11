/**
 * Anime local file sync.
 *
 * Reconciles the video files under an anime's library directory with its
 * episode, episode-file, and extra rows. Metadata scraped from a provider owns
 * episode identity and naming; this pass only attaches playable files to it and
 * creates rows for episodes the provider did not list.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { createLogger } from '@main/log'
import type { DbContext, DbService } from '@main/services/db'
import type { MediaInfoService } from '@main/services/media-info'
import {
  animeEpisodeFiles,
  animeEpisodes,
  animeExtras,
  animeSessions,
  animes,
  type AnimeEpisode,
  type AnimeEpisodeFile,
  type NewAnimeEpisode,
  type NewAnimeEpisodeFile,
  type NewAnimeExtra
} from '@shared/db'
import type { IngestSyncAnimeFilesParams, IngestSyncAnimeFilesResult } from '@shared/ingest'
import type { MediaFileInfo } from '@shared/media-info'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  classifyReleaseFile,
  isExtraCandidate,
  isExtraDirectoryName,
  isVideoFile,
  type AnimeEpisodeCandidate,
  type AnimeExtraCandidate
} from './recognition'

const log = createLogger('Ingest')

/** Depth cap that covers `Anime/Season/Disc` layouts without walking archives. */
const MAX_WALK_DEPTH = 4

export interface AnimeFileSyncParams extends IngestSyncAnimeFilesParams {
  signal?: AbortSignal
}

interface WalkedFiles {
  episodes: AnimeEpisodeCandidate[]
  extras: AnimeExtraCandidate[]
}

interface ProbedEpisodeFile {
  candidate: AnimeEpisodeCandidate
  stat: { size: number; mtimeMs: number }
  info: MediaFileInfo | null
}

/** Sort key that keeps specials after regular episodes and numbers ascending. */
function episodeSortKey(candidate: AnimeEpisodeCandidate): [number, number, string] {
  return [
    candidate.type === 'regular' ? 0 : 1,
    candidate.number ?? Number.MAX_SAFE_INTEGER,
    candidate.fileName
  ]
}

function compareEpisodes(a: AnimeEpisodeCandidate, b: AnimeEpisodeCandidate): number {
  const [aType, aNumber, aName] = episodeSortKey(a)
  const [bType, bNumber, bName] = episodeSortKey(b)
  if (aType !== bType) return aType - bType
  if (aNumber !== bNumber) return aNumber - bNumber
  return aName.localeCompare(bName)
}

/**
 * Identity of a candidate across sync runs: numbered files share their episode
 * by (type, number); unreadable filenames stay one episode per file, keyed by
 * path, since two unreadable names are not evidence of the same episode.
 */
function episodeCandidateKey(candidate: AnimeEpisodeCandidate): string {
  return candidate.number === undefined
    ? `file:${candidate.path}`
    : `${candidate.type}:${candidate.number}`
}

export class AnimeFileSyncHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly mediaInfo: MediaInfoService
  ) {}

  /**
   * Walk the anime directory and write what it finds.
   *
   * Probing runs outside the transaction because ffprobe is slow and the write
   * must stay a single synchronous better-sqlite3 unit.
   */
  async sync(params: AnimeFileSyncParams): Promise<IngestSyncAnimeFilesResult> {
    const { animeId, signal } = params
    const dirPath = params.dirPath ?? this.readAnimeDirPath(animeId)

    if (!dirPath) {
      throw new Error('Anime has no library directory to scan')
    }

    const walked = await this.walk(dirPath, signal)
    walked.episodes.sort(compareEpisodes)

    const probed: ProbedEpisodeFile[] = []
    for (const candidate of walked.episodes) {
      signal?.throwIfAborted()
      const stat = await this.readStat(candidate.path)
      if (!stat) continue
      probed.push({ candidate, stat, info: await this.mediaInfo.probe(candidate.path) })
    }

    const extraDurations = new Map<string, number | null>()
    for (const extra of walked.extras) {
      signal?.throwIfAborted()
      extraDurations.set(extra.path, (await this.mediaInfo.probe(extra.path))?.durationMs ?? null)
    }

    return this.dbService.client.transaction((tx) => {
      // The whole current state loads up front so re-syncs can re-match
      // unnumbered episodes through their files and clean up stale rows.
      const existingEpisodes = tx
        .select()
        .from(animeEpisodes)
        .where(eq(animeEpisodes.animeId, animeId))
        .all()
      const episodeIds = existingEpisodes.map((episode) => episode.id)
      const existingFiles = episodeIds.length
        ? tx
            .select()
            .from(animeEpisodeFiles)
            .where(inArray(animeEpisodeFiles.episodeId, episodeIds))
            .all()
        : []

      const episodeIdByKey = this.writeEpisodes(
        tx,
        animeId,
        probed,
        existingEpisodes,
        existingFiles
      )
      const fileCount = this.writeEpisodeFiles(tx, probed, episodeIdByKey, existingFiles)
      this.deleteOrphanedFileBornEpisodes(tx, existingEpisodes, probed, episodeIdByKey)
      const extraCount = this.writeExtras(tx, animeId, walked.extras, extraDurations)

      return {
        episodeCount: episodeIdByKey.size,
        fileCount,
        extraCount,
        unrecognizedFiles: probed
          .filter(({ candidate }) => candidate.number === undefined)
          .map(({ candidate }) => candidate.path)
      }
    })
  }

  private readAnimeDirPath(animeId: string): string | null {
    const [row] = this.dbService.client
      .select({ animeDirPath: animes.animeDirPath })
      .from(animes)
      .where(eq(animes.id, animeId))
      .limit(1)
      .all()

    return row?.animeDirPath ?? null
  }

  private async readStat(filePath: string): Promise<{ size: number; mtimeMs: number } | null> {
    try {
      const stat = await fs.stat(filePath)
      return { size: stat.size, mtimeMs: stat.mtimeMs }
    } catch (error) {
      log.warn('Failed to stat anime file:', error)
      return null
    }
  }

  private async walk(dirPath: string, signal?: AbortSignal): Promise<WalkedFiles> {
    const result: WalkedFiles = { episodes: [], extras: [] }

    const visit = async (current: string, depth: number, inExtras: boolean): Promise<void> => {
      signal?.throwIfAborted()
      if (depth > MAX_WALK_DEPTH) return

      const entries = await fs.readdir(current, { withFileTypes: true }).catch((error) => {
        log.warn('Failed to read anime directory:', error)
        return []
      })

      for (const entry of entries) {
        const entryPath = path.join(current, entry.name)

        if (entry.isDirectory()) {
          await visit(entryPath, depth + 1, inExtras || isExtraDirectoryName(entry.name))
          continue
        }

        if (!entry.isFile() || !isVideoFile(entry.name)) continue

        const candidate = classifyReleaseFile(entryPath, inExtras)
        if (isExtraCandidate(candidate)) {
          result.extras.push(candidate)
        } else {
          result.episodes.push(candidate)
        }
      }
    }

    await visit(dirPath, 0, false)
    return result
  }

  /**
   * Map each recognized file onto an episode row, creating rows for numbers the
   * scraped list is missing. Unnumbered existing rows are re-matched through
   * the paths of the files they own, so re-syncs stay idempotent instead of
   * duplicating them.
   */
  private writeEpisodes(
    tx: DbContext,
    animeId: string,
    probed: ProbedEpisodeFile[],
    existingEpisodes: AnimeEpisode[],
    existingFiles: AnimeEpisodeFile[]
  ): Map<string, string> {
    const episodeById = new Map(existingEpisodes.map((episode) => [episode.id, episode]))
    const existingByKey = new Map<string, AnimeEpisode>()
    for (const episode of existingEpisodes) {
      if (episode.episodeNumber !== null) {
        existingByKey.set(`${episode.type}:${episode.episodeNumber}`, episode)
      }
    }
    // Unnumbered rows exist only because of their files, so any of their file
    // paths identifies them across runs.
    for (const file of existingFiles) {
      const episode = episodeById.get(file.episodeId)
      if (episode && episode.episodeNumber === null) {
        existingByKey.set(`file:${file.path}`, episode)
      }
    }

    const episodeIdByKey = new Map<string, string>()
    let nextOrder = existingEpisodes.length

    for (const { candidate, info } of probed) {
      const key = episodeCandidateKey(candidate)

      if (episodeIdByKey.has(key)) continue

      const match = existingByKey.get(key)
      if (match) {
        episodeIdByKey.set(key, match.id)
        // A scraped episode rarely carries a runtime; the file always does.
        if (match.durationMs === null && info?.durationMs) {
          tx.update(animeEpisodes)
            .set({ durationMs: info.durationMs })
            .where(eq(animeEpisodes.id, match.id))
            .run()
        }
        continue
      }

      const row: NewAnimeEpisode = {
        id: nanoid(),
        animeId,
        type: candidate.type,
        episodeNumber: candidate.number ?? null,
        name: candidate.number === undefined ? candidate.fileName : null,
        durationMs: info?.durationMs ?? null,
        orderInAnime: nextOrder++
      }

      tx.insert(animeEpisodes).values(row).run()
      episodeIdByKey.set(key, row.id as string)
    }

    return episodeIdByKey
  }

  private writeEpisodeFiles(
    tx: DbContext,
    probed: ProbedEpisodeFile[],
    episodeIdByKey: Map<string, string>,
    existingFiles: AnimeEpisodeFile[]
  ): number {
    const knownIdByPath = new Map(existingFiles.map((file) => [file.path, file.id]))
    const primaryPathsByEpisodeId = new Map<string, Set<string>>()
    for (const file of existingFiles) {
      if (!file.isPrimary) continue
      const paths = primaryPathsByEpisodeId.get(file.episodeId) ?? new Set<string>()
      paths.add(file.path)
      primaryPathsByEpisodeId.set(file.episodeId, paths)
    }

    const probedByEpisodeId = new Map<string, ProbedEpisodeFile[]>()
    for (const item of probed) {
      const episodeId = episodeIdByKey.get(episodeCandidateKey(item.candidate))
      if (!episodeId) continue
      const group = probedByEpisodeId.get(episodeId) ?? []
      group.push(item)
      probedByEpisodeId.set(episodeId, group)
    }

    let count = 0

    for (const [episodeId, group] of probedByEpisodeId) {
      // A stored primary preference survives as long as its file does; a new
      // primary is elected only when no preferred file remains on disk.
      const preferredPaths = primaryPathsByEpisodeId.get(episodeId)
      const primaryPath =
        group.find(({ candidate }) => preferredPaths?.has(candidate.path))?.candidate.path ??
        group[0].candidate.path

      for (const { candidate, stat, info } of group) {
        const values = {
          episodeId,
          path: candidate.path,
          fileSize: stat.size,
          fileMtime: new Date(stat.mtimeMs),
          container: info?.container ?? null,
          videoCodec: info?.video?.codec ?? null,
          bitDepth: info?.video?.bitDepth ?? null,
          width: info?.video?.width ?? null,
          height: info?.video?.height ?? null,
          durationMs: info?.durationMs ?? null,
          audioTracks: [...(info?.audioTracks ?? [])],
          subtitleTracks: [...(info?.subtitleTracks ?? [])],
          isPrimary: candidate.path === primaryPath
        } satisfies Omit<NewAnimeEpisodeFile, 'id'>

        const knownId = knownIdByPath.get(candidate.path)
        if (knownId) {
          tx.update(animeEpisodeFiles).set(values).where(eq(animeEpisodeFiles.id, knownId)).run()
        } else {
          tx.insert(animeEpisodeFiles)
            .values({ id: nanoid(), ...values })
            .run()
        }

        count++
      }
    }

    // Files that vanished from disk must not stay playable, including files of
    // episodes no candidate matched this run.
    const livePaths = new Set(probed.map(({ candidate }) => candidate.path))
    for (const file of existingFiles) {
      if (livePaths.has(file.path)) continue
      tx.delete(animeEpisodeFiles).where(eq(animeEpisodeFiles.id, file.id)).run()
    }

    return count
  }

  /**
   * Unnumbered rows only existed because a file proved them. Once the last
   * file is gone they carry nothing, unless the user watched them or a session
   * still points at them.
   */
  private deleteOrphanedFileBornEpisodes(
    tx: DbContext,
    existingEpisodes: AnimeEpisode[],
    probed: ProbedEpisodeFile[],
    episodeIdByKey: Map<string, string>
  ): void {
    const retainedIds = new Set<string>()
    for (const { candidate } of probed) {
      const episodeId = episodeIdByKey.get(episodeCandidateKey(candidate))
      if (episodeId) retainedIds.add(episodeId)
    }

    const candidates = existingEpisodes.filter(
      (episode) =>
        episode.episodeNumber === null &&
        episode.watchedAt === null &&
        !retainedIds.has(episode.id)
    )
    if (candidates.length === 0) return

    const referencedIds = new Set(
      tx
        .select()
        .from(animeSessions)
        .where(
          inArray(
            animeSessions.episodeId,
            candidates.map((episode) => episode.id)
          )
        )
        .all()
        .flatMap((row) => (row.episodeId ? [row.episodeId] : []))
    )

    for (const episode of candidates) {
      if (referencedIds.has(episode.id)) continue
      tx.delete(animeEpisodes).where(eq(animeEpisodes.id, episode.id)).run()
    }
  }

  private writeExtras(
    tx: DbContext,
    animeId: string,
    extras: AnimeExtraCandidate[],
    durations: Map<string, number | null>
  ): number {
    const known = tx.select().from(animeExtras).where(eq(animeExtras.animeId, animeId)).all()
    const knownIdByPath = new Map(known.map((extra) => [extra.path, extra.id]))

    for (const [index, extra] of extras.entries()) {
      const values = {
        animeId,
        kind: extra.kind,
        name: extra.name,
        path: extra.path,
        durationMs: durations.get(extra.path) ?? null,
        orderInAnime: index
      } satisfies Omit<NewAnimeExtra, 'id'>

      const knownId = knownIdByPath.get(extra.path)
      if (knownId) {
        tx.update(animeExtras).set(values).where(eq(animeExtras.id, knownId)).run()
      } else {
        tx.insert(animeExtras)
          .values({ id: nanoid(), ...values })
          .run()
      }
    }

    const livePaths = new Set(extras.map((extra) => extra.path))
    for (const extra of known) {
      if (livePaths.has(extra.path)) continue
      tx.delete(animeExtras)
        .where(and(eq(animeExtras.id, extra.id), eq(animeExtras.animeId, animeId)))
        .run()
    }

    return extras.length
  }
}
