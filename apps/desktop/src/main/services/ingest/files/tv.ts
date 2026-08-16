/**
 * TV local file sync and manual file attachment.
 *
 * Sync reconciles the video files under a show's library directory with its
 * season, episode, episode-file, extra, and extra-file rows. Metadata scraped
 * from a provider owns episode identity and naming; this pass only attaches
 * playable files to it and creates rows for episodes the provider did not list.
 *
 * Two layouts are equally common and both are supported: season folders
 * (`Show/Season 2/...`) and a flat directory whose filenames carry `SxxEyy`.
 * A filename that states its season outranks the folder it sits in.
 *
 * File rows have an owner: sync owns only the rows it created and the user
 * never touched. Rows marked `isManual` (attached or reassigned by the user)
 * may point anywhere on disk and are never re-probed, retargeted, deleted, or
 * stripped of their primary mark by a sync pass.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { createLogger } from '@main/log'
import type { DbContext, DbQueryContext, DbService } from '@main/services/db'
import type { MediaInfoService } from '@main/services/media-info'
import {
  tvEpisodeFiles,
  tvEpisodes,
  tvExtraFiles,
  tvExtras,
  tvSeasons,
  tvSessions,
  tvs,
  type NewTvEpisode,
  type NewTvEpisodeFile,
  type NewTvExtraFile,
  type TvEpisode,
  type TvEpisodeFile,
  type TvExtra,
  type TvSeason
} from '@shared/db'
import type {
  IngestAttachTvEpisodeFileParams,
  IngestAttachTvExtraFileParams,
  IngestSyncTvFilesParams,
  IngestSyncTvFilesResult
} from '@shared/ingest'
import type { MediaFileInfo } from '@shared/media-info'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  classifyTvReleaseFile,
  isExtraDirectoryName,
  isVideoFile,
  readSeasonDirectoryNumber,
  type TvEpisodeCandidate,
  type TvExtraCandidate
} from './recognition'

const log = createLogger('Ingest')

/** Depth cap that covers `Show/Season/Disc` layouts without walking archives. */
const MAX_WALK_DEPTH = 4

/** Season a file falls into when neither its name nor its folder states one. */
const DEFAULT_SEASON_NUMBER = 1

export interface TvFileSyncParams extends IngestSyncTvFilesParams {
  signal?: AbortSignal
}

interface WalkedFiles {
  episodes: TvEpisodeCandidate[]
  extras: TvExtraCandidate[]
}

interface FileStat {
  size: number
  mtimeMs: number
}

interface ProbedEpisodeFile {
  candidate: TvEpisodeCandidate
  stat: FileStat
  info: MediaFileInfo | null
}

interface ProbedExtraFile {
  candidate: TvExtraCandidate
  stat: FileStat
  info: MediaFileInfo | null
}

function candidateSeason(candidate: TvEpisodeCandidate): number {
  return candidate.seasonNumber ?? DEFAULT_SEASON_NUMBER
}

function compareEpisodes(a: TvEpisodeCandidate, b: TvEpisodeCandidate): number {
  const seasonDelta = candidateSeason(a) - candidateSeason(b)
  if (seasonDelta !== 0) return seasonDelta

  const numberDelta = (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER)
  if (numberDelta !== 0) return numberDelta

  return a.fileName.localeCompare(b.fileName)
}

/**
 * Identity of a candidate across sync runs: numbered files share their episode
 * by (season, number); unreadable filenames stay one episode per file, keyed by
 * path, since two unreadable names are not evidence of the same episode.
 */
function episodeCandidateKey(candidate: TvEpisodeCandidate): string {
  return candidate.number === undefined
    ? `file:${candidate.path}`
    : `${candidateSeason(candidate)}:${candidate.number}`
}

/** File-row column values derived from one probe pass. */
function toProbedFileValues(stat: FileStat, info: MediaFileInfo | null) {
  return {
    fileSize: stat.size,
    fileMtime: new Date(stat.mtimeMs),
    container: info?.container ?? null,
    videoCodec: info?.video?.codec ?? null,
    bitDepth: info?.video?.bitDepth ?? null,
    width: info?.video?.width ?? null,
    height: info?.video?.height ?? null,
    durationMs: info?.durationMs ?? null,
    audioTracks: [...(info?.audioTracks ?? [])],
    subtitleTracks: [...(info?.subtitleTracks ?? [])]
  }
}

export class TvFileSyncHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly mediaInfo: MediaInfoService
  ) {}

  /**
   * Walk the show directory and write what it finds.
   *
   * Probing runs outside the transaction because ffprobe is slow and the write
   * must stay a single synchronous better-sqlite3 unit.
   */
  async sync(params: TvFileSyncParams): Promise<IngestSyncTvFilesResult> {
    const { tvId, signal } = params
    const dirPath = params.dirPath ?? this.readTvDirPath(tvId)

    if (!dirPath) {
      throw new Error('TV series has no library directory to scan')
    }

    const walked = await this.walk(dirPath, signal)

    // Manual rows already claim their paths, so those files leave the
    // candidate set entirely: sync neither re-probes nor re-assigns them.
    const manualPaths = new Set([
      ...this.readManualEpisodeFiles(tvId).map((file) => file.path),
      ...this.readManualExtraFiles(tvId).map((file) => file.path)
    ])
    walked.episodes = walked.episodes.filter((candidate) => !manualPaths.has(candidate.path))
    walked.extras = walked.extras.filter((extra) => !manualPaths.has(extra.path))
    walked.episodes.sort(compareEpisodes)

    const probedEpisodes: ProbedEpisodeFile[] = []
    for (const candidate of walked.episodes) {
      signal?.throwIfAborted()
      const stat = await this.readStat(candidate.path)
      if (!stat) continue
      probedEpisodes.push({ candidate, stat, info: await this.mediaInfo.probe(candidate.path) })
    }

    const probedExtras: ProbedExtraFile[] = []
    for (const candidate of walked.extras) {
      signal?.throwIfAborted()
      const stat = await this.readStat(candidate.path)
      if (!stat) continue
      probedExtras.push({ candidate, stat, info: await this.mediaInfo.probe(candidate.path) })
    }

    return this.dbService.client.transaction((tx) => {
      // The whole current state loads up front so re-syncs can re-match
      // unnumbered episodes through their files and clean up stale rows.
      const existingSeasons = tx.select().from(tvSeasons).where(eq(tvSeasons.tvId, tvId)).all()
      const existingEpisodes = tx.select().from(tvEpisodes).where(eq(tvEpisodes.tvId, tvId)).all()
      const episodeIds = existingEpisodes.map((episode) => episode.id)
      const existingFiles = episodeIds.length
        ? tx
            .select()
            .from(tvEpisodeFiles)
            .where(inArray(tvEpisodeFiles.episodeId, episodeIds))
            .all()
        : []

      const seasonIdByNumber = this.writeSeasons(tx, tvId, probedEpisodes, existingSeasons)
      const episodeIdByKey = this.writeEpisodes(
        tx,
        tvId,
        probedEpisodes,
        existingEpisodes,
        existingFiles,
        seasonIdByNumber
      )
      const fileCount = this.writeEpisodeFiles(tx, probedEpisodes, episodeIdByKey, existingFiles)
      this.deleteOrphanedFileBornEpisodes(
        tx,
        existingEpisodes,
        existingFiles,
        probedEpisodes,
        episodeIdByKey
      )
      const extraCount = this.writeExtras(tx, tvId, probedExtras)

      return {
        seasonCount: seasonIdByNumber.size,
        episodeCount: episodeIdByKey.size,
        fileCount,
        extraCount,
        unrecognizedFiles: probedEpisodes
          .filter(({ candidate }) => candidate.number === undefined)
          .map(({ candidate }) => candidate.path)
      }
    })
  }

  /**
   * Attach one file to an episode as a user-owned row.
   *
   * Probing runs before the write because ffprobe is slow; the row is marked
   * manual so sync passes leave it alone from now on.
   */
  async attachFile(params: IngestAttachTvEpisodeFileParams): Promise<void> {
    const { episodeId, path: filePath } = params

    const stat = await this.readStat(filePath)
    if (!stat) {
      throw new Error(`Episode file is not readable: ${filePath}`)
    }
    const info = await this.mediaInfo.probe(filePath)

    this.dbService.client.transaction((tx) => {
      const [episode] = tx
        .select()
        .from(tvEpisodes)
        .where(eq(tvEpisodes.id, episodeId))
        .limit(1)
        .all()
      if (!episode) {
        throw new Error(`Episode not found: ${episodeId}`)
      }

      this.requirePathUnclaimed(tx, filePath)

      const siblings = tx
        .select({ id: tvEpisodeFiles.id })
        .from(tvEpisodeFiles)
        .where(eq(tvEpisodeFiles.episodeId, episodeId))
        .all()

      tx.insert(tvEpisodeFiles)
        .values({
          id: nanoid(),
          episodeId,
          path: filePath,
          ...toProbedFileValues(stat, info),
          isPrimary: siblings.length === 0,
          isManual: true
        })
        .run()

      // A scraped episode rarely carries a runtime; the file always does.
      if (episode.durationMs === null && info?.durationMs) {
        tx.update(tvEpisodes)
          .set({ durationMs: info.durationMs })
          .where(eq(tvEpisodes.id, episodeId))
          .run()
      }
    })
  }

  /**
   * Attach one on-disk video as a user-owned extra file.
   *
   * With `extraId` the file joins that extra as an alternate version;
   * otherwise a new user-owned extra is created, with filename recognition
   * filling name and type unless the caller supplied explicit values.
   */
  async attachExtra(params: IngestAttachTvExtraFileParams): Promise<void> {
    const { tvId, path: filePath } = params

    const stat = await this.readStat(filePath)
    if (!stat) {
      throw new Error(`Extra file is not readable: ${filePath}`)
    }
    const info = await this.mediaInfo.probe(filePath)
    const classified = classifyTvReleaseFile(filePath, true, undefined)
    const recognized = classified.kind === 'extra' ? classified.extra : undefined

    this.dbService.client.transaction((tx) => {
      this.requirePathUnclaimed(tx, filePath)

      let extraId = params.extraId
      if (extraId) {
        const [extra] = tx
          .select({ id: tvExtras.id })
          .from(tvExtras)
          .where(and(eq(tvExtras.id, extraId), eq(tvExtras.tvId, tvId)))
          .limit(1)
          .all()
        if (!extra) {
          throw new Error(`Extra not found: ${extraId}`)
        }
      } else {
        const [tv] = tx.select({ id: tvs.id }).from(tvs).where(eq(tvs.id, tvId)).limit(1).all()
        if (!tv) {
          throw new Error(`TV series not found: ${tvId}`)
        }

        const siblings = tx
          .select({ orderInTv: tvExtras.orderInTv })
          .from(tvExtras)
          .where(eq(tvExtras.tvId, tvId))
          .all()
        const nextOrder = siblings.reduce((max, row) => Math.max(max, row.orderInTv + 1), 0)

        extraId = nanoid()
        tx.insert(tvExtras)
          .values({
            id: extraId,
            tvId,
            type: params.type ?? recognized?.type ?? 'other',
            name: params.name?.trim() || (recognized?.name ?? path.basename(filePath)),
            orderInTv: nextOrder,
            isManual: true
          })
          .run()
      }

      const siblingFiles = tx
        .select({ id: tvExtraFiles.id })
        .from(tvExtraFiles)
        .where(eq(tvExtraFiles.extraId, extraId))
        .all()

      tx.insert(tvExtraFiles)
        .values({
          id: nanoid(),
          extraId,
          path: filePath,
          ...toProbedFileValues(stat, info),
          isPrimary: siblingFiles.length === 0,
          isManual: true
        })
        .run()
    })
  }

  /** Throws when the path is already claimed by any episode or extra file row. */
  private requirePathUnclaimed(tx: DbContext, filePath: string): void {
    const [claimedEpisode] = (tx as DbQueryContext)
      .select({ id: tvEpisodeFiles.id })
      .from(tvEpisodeFiles)
      .where(eq(tvEpisodeFiles.path, filePath))
      .limit(1)
      .all()
    if (claimedEpisode) {
      throw new Error(`File is already attached to an episode: ${filePath}`)
    }

    const [claimedExtra] = (tx as DbQueryContext)
      .select({ id: tvExtraFiles.id })
      .from(tvExtraFiles)
      .where(eq(tvExtraFiles.path, filePath))
      .limit(1)
      .all()
    if (claimedExtra) {
      throw new Error(`File is already attached to an extra: ${filePath}`)
    }
  }

  private readTvDirPath(tvId: string): string | null {
    const [row] = this.dbService.client
      .select({ tvDirPath: tvs.tvDirPath })
      .from(tvs)
      .where(eq(tvs.id, tvId))
      .limit(1)
      .all()

    return row?.tvDirPath ?? null
  }

  private readManualEpisodeFiles(tvId: string): Array<{ path: string }> {
    return this.dbService.client
      .select({ path: tvEpisodeFiles.path })
      .from(tvEpisodeFiles)
      .innerJoin(tvEpisodes, eq(tvEpisodeFiles.episodeId, tvEpisodes.id))
      .where(and(eq(tvEpisodes.tvId, tvId), eq(tvEpisodeFiles.isManual, true)))
      .all()
  }

  private readManualExtraFiles(tvId: string): Array<{ path: string }> {
    return this.dbService.client
      .select({ path: tvExtraFiles.path })
      .from(tvExtraFiles)
      .innerJoin(tvExtras, eq(tvExtraFiles.extraId, tvExtras.id))
      .where(and(eq(tvExtras.tvId, tvId), eq(tvExtraFiles.isManual, true)))
      .all()
  }

  private async readStat(filePath: string): Promise<FileStat | null> {
    try {
      const stat = await fs.stat(filePath)
      return { size: stat.size, mtimeMs: stat.mtimeMs }
    } catch (error) {
      log.warn('Failed to stat TV file:', error)
      return null
    }
  }

  /**
   * Walk the show directory, carrying the season the directory tree states
   * down into its children so flat filenames inherit their folder's season.
   */
  private async walk(dirPath: string, signal?: AbortSignal): Promise<WalkedFiles> {
    const result: WalkedFiles = { episodes: [], extras: [] }

    const visit = async (
      current: string,
      depth: number,
      inExtras: boolean,
      seasonHint: number | undefined
    ): Promise<void> => {
      signal?.throwIfAborted()
      if (depth > MAX_WALK_DEPTH) return

      const entries = await fs.readdir(current, { withFileTypes: true }).catch((error) => {
        log.warn('Failed to read TV directory:', error)
        return []
      })

      for (const entry of entries) {
        const entryPath = path.join(current, entry.name)

        if (entry.isDirectory()) {
          const seasonFromDir = readSeasonDirectoryNumber(entry.name)
          await visit(
            entryPath,
            depth + 1,
            // A specials folder names season 0, so it stays an episode folder;
            // only the generic extra folders switch the branch to extras.
            inExtras || (seasonFromDir === undefined && isExtraDirectoryName(entry.name)),
            seasonFromDir ?? seasonHint
          )
          continue
        }

        if (!entry.isFile() || !isVideoFile(entry.name)) continue

        const classified = classifyTvReleaseFile(entryPath, inExtras, seasonHint)
        if (classified.kind === 'extra') {
          result.extras.push(classified.extra)
        } else {
          result.episodes.push(classified.episode)
        }
      }
    }

    await visit(dirPath, 0, false, undefined)
    return result
  }

  /**
   * Ensure a season row exists for every season the walked files land in.
   *
   * Seasons the provider listed keep their scraped metadata; the ones only the
   * files prove are created bare, so the next scrape can fill them in.
   */
  private writeSeasons(
    tx: DbContext,
    tvId: string,
    probed: ProbedEpisodeFile[],
    existingSeasons: TvSeason[]
  ): Map<number, string> {
    const seasonIdByNumber = new Map(
      existingSeasons.map((season) => [season.seasonNumber, season.id])
    )
    let nextOrder = existingSeasons.reduce((max, season) => Math.max(max, season.orderInTv + 1), 0)

    for (const { candidate } of probed) {
      const seasonNumber = candidateSeason(candidate)
      if (seasonIdByNumber.has(seasonNumber)) continue

      const id = nanoid()
      tx.insert(tvSeasons).values({ id, tvId, seasonNumber, orderInTv: nextOrder++ }).run()
      seasonIdByNumber.set(seasonNumber, id)
    }

    return seasonIdByNumber
  }

  /**
   * Map each recognized file onto an episode row, creating rows for numbers the
   * scraped list is missing. Unnumbered existing rows are re-matched through
   * the paths of the files they own, so re-syncs stay idempotent instead of
   * duplicating them.
   */
  private writeEpisodes(
    tx: DbContext,
    tvId: string,
    probed: ProbedEpisodeFile[],
    existingEpisodes: TvEpisode[],
    existingFiles: TvEpisodeFile[],
    seasonIdByNumber: Map<number, string>
  ): Map<string, string> {
    const seasonNumberById = new Map(
      [...seasonIdByNumber].map(([seasonNumber, id]) => [id, seasonNumber])
    )
    const episodeById = new Map(existingEpisodes.map((episode) => [episode.id, episode]))
    const existingByKey = new Map<string, TvEpisode>()
    for (const episode of existingEpisodes) {
      const seasonNumber = seasonNumberById.get(episode.seasonId)
      if (episode.episodeNumber !== null && seasonNumber !== undefined) {
        existingByKey.set(`${seasonNumber}:${episode.episodeNumber}`, episode)
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
    const nextOrderInSeason = new Map<string, number>()
    for (const episode of existingEpisodes) {
      const current = nextOrderInSeason.get(episode.seasonId) ?? 0
      nextOrderInSeason.set(episode.seasonId, Math.max(current, episode.orderInSeason + 1))
    }
    let nextOrderInTv = existingEpisodes.reduce(
      (max, episode) => Math.max(max, episode.orderInTv + 1),
      0
    )

    for (const { candidate, info } of probed) {
      const key = episodeCandidateKey(candidate)

      if (episodeIdByKey.has(key)) continue

      const match = existingByKey.get(key)
      if (match) {
        episodeIdByKey.set(key, match.id)
        // A scraped episode rarely carries a runtime; the file always does.
        if (match.durationMs === null && info?.durationMs) {
          tx.update(tvEpisodes)
            .set({ durationMs: info.durationMs })
            .where(eq(tvEpisodes.id, match.id))
            .run()
        }
        continue
      }

      const seasonId = seasonIdByNumber.get(candidateSeason(candidate))
      if (!seasonId) continue

      const orderInSeason = nextOrderInSeason.get(seasonId) ?? 0
      nextOrderInSeason.set(seasonId, orderInSeason + 1)

      const row: NewTvEpisode = {
        id: nanoid(),
        tvId,
        seasonId,
        episodeNumber: candidate.number ?? null,
        name: candidate.number === undefined ? candidate.name : null,
        durationMs: info?.durationMs ?? null,
        orderInSeason,
        orderInTv: nextOrderInTv++
      }

      tx.insert(tvEpisodes).values(row).run()
      episodeIdByKey.set(key, row.id as string)
    }

    return episodeIdByKey
  }

  private writeEpisodeFiles(
    tx: DbContext,
    probed: ProbedEpisodeFile[],
    episodeIdByKey: Map<string, string>,
    existingFiles: TvEpisodeFile[]
  ): number {
    const knownIdByPath = new Map(existingFiles.map((file) => [file.path, file.id]))
    const primaryPathsByEpisodeId = new Map<string, Set<string>>()
    for (const file of existingFiles) {
      if (!file.isPrimary) continue
      const paths = primaryPathsByEpisodeId.get(file.episodeId) ?? new Set<string>()
      paths.add(file.path)
      primaryPathsByEpisodeId.set(file.episodeId, paths)
    }
    // A user-pinned manual primary keeps the slot; sync rows then never claim it.
    const manualPrimaryEpisodeIds = new Set(
      existingFiles.filter((file) => file.isManual && file.isPrimary).map((file) => file.episodeId)
    )

    const probedByEpisodeId = new Map<string, ProbedEpisodeFile[]>()
    for (const item of probed) {
      const episodeId = episodeIdByKey.get(episodeCandidateKey(item.candidate))
      if (!episodeId) continue
      const group = probedByEpisodeId.get(episodeId) ?? []
      group.push(item)
      probedByEpisodeId.set(episodeId, group)
    }

    let count = 0

    // Sync-owned files that vanished from disk must not stay playable,
    // including files of episodes no candidate matched this run. Manual rows
    // are user-owned and may live outside the walked directory, so they stay.
    // Deletion runs first so the partial primary index never sees two rows.
    const livePaths = new Set(probed.map(({ candidate }) => candidate.path))
    for (const file of existingFiles) {
      if (file.isManual || livePaths.has(file.path)) continue
      tx.delete(tvEpisodeFiles).where(eq(tvEpisodeFiles.id, file.id)).run()
    }

    for (const [episodeId, group] of probedByEpisodeId) {
      // A stored primary preference survives as long as its file does; a new
      // primary is elected only when no preferred file remains on disk and no
      // manual row already holds the slot.
      const preferredPaths = primaryPathsByEpisodeId.get(episodeId)
      const primaryPath = manualPrimaryEpisodeIds.has(episodeId)
        ? null
        : (group.find(({ candidate }) => preferredPaths?.has(candidate.path))?.candidate.path ??
          group[0].candidate.path)

      for (const { candidate, stat, info } of group) {
        const values = {
          episodeId,
          path: candidate.path,
          ...toProbedFileValues(stat, info),
          isPrimary: candidate.path === primaryPath
        } satisfies Omit<NewTvEpisodeFile, 'id'>

        const knownId = knownIdByPath.get(candidate.path)
        if (knownId) {
          tx.update(tvEpisodeFiles).set(values).where(eq(tvEpisodeFiles.id, knownId)).run()
        } else {
          tx.insert(tvEpisodeFiles)
            .values({ id: nanoid(), ...values })
            .run()
        }

        count++
      }
    }

    return count
  }

  /**
   * Unnumbered rows only existed because a file proved them. Once the last
   * file is gone they carry nothing, unless the user watched them, attached a
   * manual file, or a session still points at them.
   */
  private deleteOrphanedFileBornEpisodes(
    tx: DbContext,
    existingEpisodes: TvEpisode[],
    existingFiles: TvEpisodeFile[],
    probed: ProbedEpisodeFile[],
    episodeIdByKey: Map<string, string>
  ): void {
    const retainedIds = new Set<string>()
    for (const { candidate } of probed) {
      const episodeId = episodeIdByKey.get(episodeCandidateKey(candidate))
      if (episodeId) retainedIds.add(episodeId)
    }
    for (const file of existingFiles) {
      if (file.isManual) retainedIds.add(file.episodeId)
    }

    const candidates = existingEpisodes.filter(
      (episode) =>
        episode.episodeNumber === null && !episode.watched && !retainedIds.has(episode.id)
    )
    if (candidates.length === 0) return

    const referencedIds = new Set(
      (tx as DbQueryContext)
        .select({ episodeId: tvSessions.episodeId })
        .from(tvSessions)
        .where(
          inArray(
            tvSessions.episodeId,
            candidates.map((episode) => episode.id)
          )
        )
        .all()
        .flatMap((row) => (row.episodeId ? [row.episodeId] : []))
    )

    for (const episode of candidates) {
      if (referencedIds.has(episode.id)) continue
      tx.delete(tvEpisodes).where(eq(tvEpisodes.id, episode.id)).run()
    }
  }

  /**
   * Reconcile extras and their files against the walked candidates.
   *
   * Candidates claim file rows by path. A file with no row creates a new
   * extra plus its file row (sync keeps one file per extra; grouping alternate
   * versions under one extra is a manual attach). Sync-owned rows whose file
   * vanished are deleted; an extra that lost every file is deleted unless the
   * extra or one of its files is user-owned.
   */
  private writeExtras(tx: DbContext, tvId: string, probed: ProbedExtraFile[]): number {
    const existingExtras = tx.select().from(tvExtras).where(eq(tvExtras.tvId, tvId)).all()
    const extraIds = existingExtras.map((extra) => extra.id)
    const existingFiles = extraIds.length
      ? tx.select().from(tvExtraFiles).where(inArray(tvExtraFiles.extraId, extraIds)).all()
      : []

    const extraById = new Map(existingExtras.map((extra) => [extra.id, extra]))
    const fileByPath = new Map(existingFiles.map((file) => [file.path, file]))

    // Sync-owned files that vanished from disk lose their rows first, so the
    // partial primary index never sees a stale primary colliding with a new one.
    const livePaths = new Set(probed.map(({ candidate }) => candidate.path))
    const deletedFileIds = new Set<string>()
    for (const file of existingFiles) {
      if (file.isManual || livePaths.has(file.path)) continue
      tx.delete(tvExtraFiles).where(eq(tvExtraFiles.id, file.id)).run()
      deletedFileIds.add(file.id)
    }

    let syncOrder = 0
    for (const { candidate, stat, info } of probed) {
      const known = fileByPath.get(candidate.path)

      if (known) {
        tx.update(tvExtraFiles)
          .set(toProbedFileValues(stat, info))
          .where(eq(tvExtraFiles.id, known.id))
          .run()

        // Recognition may improve across runs, but user-owned extras keep
        // their name, type, and ordering.
        const owner = extraById.get(known.extraId)
        if (owner && !owner.isManual) {
          const patch: Partial<TvExtra> = {}
          if (owner.name !== candidate.name) patch.name = candidate.name
          if (owner.type !== candidate.type) patch.type = candidate.type
          if (owner.orderInTv !== syncOrder) patch.orderInTv = syncOrder
          if (Object.keys(patch).length > 0) {
            tx.update(tvExtras).set(patch).where(eq(tvExtras.id, owner.id)).run()
          }
          syncOrder++
        }
        continue
      }

      const extraId = nanoid()
      tx.insert(tvExtras)
        .values({
          id: extraId,
          tvId,
          type: candidate.type,
          name: candidate.name,
          orderInTv: syncOrder++
        })
        .run()

      const fileValues = {
        extraId,
        path: candidate.path,
        ...toProbedFileValues(stat, info),
        isPrimary: true
      } satisfies Omit<NewTvExtraFile, 'id'>
      tx.insert(tvExtraFiles)
        .values({ id: nanoid(), ...fileValues })
        .run()
    }

    // An extra that lost its last file carries nothing, unless the extra row
    // or one of its files is user-owned.
    const survivingFileExtraIds = new Set(
      existingFiles.filter((file) => !deletedFileIds.has(file.id)).map((file) => file.extraId)
    )
    for (const extra of existingExtras) {
      if (extra.isManual || survivingFileExtraIds.has(extra.id)) continue
      tx.delete(tvExtras).where(eq(tvExtras.id, extra.id)).run()
    }

    return (tx as DbQueryContext)
      .select({ id: tvExtras.id })
      .from(tvExtras)
      .where(eq(tvExtras.tvId, tvId))
      .all().length
  }
}
