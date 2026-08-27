/**
 * Anime local file sync and manual file attachment.
 *
 * Sync reconciles the video files under an anime's library directory with its
 * episode, episode-file, extra, and extra-file rows. Metadata scraped from a
 * provider owns episode identity and naming; this pass only attaches playable
 * files to it and creates rows for episodes the provider did not list.
 *
 * File rows have an owner: sync owns only the rows it created and the user
 * never touched. Rows marked `isManual` (attached or reassigned by the user)
 * may point anywhere on disk and are never re-probed, retargeted, deleted, or
 * stripped of their primary mark by a sync pass.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { createLogger } from '@main/log'
import { isProbeCurrent, readFileStat, SyncPassQueue, type FileStat } from '../reconcile'
import { reconcileUnitFiles, type UnitReconcileSpec } from '../unit-reconcile'
import type { DbContext, DbQueryContext, DbService } from '@main/services/db'
import type { VideoProbe } from '@main/services/video'
import {
  animeEpisodeFiles,
  animeEpisodes,
  animeExtraFiles,
  animeExtras,
  animeSessions,
  animes,
  type AnimeEpisode,
  type AnimeEpisodeFile,
  type AnimeExtra,
  type AnimeFormat,
  type NewAnimeEpisode,
  type NewAnimeEpisodeFile,
  type NewAnimeExtraFile
} from '@shared/db'
import type {
  AnimeEpisodeFileAttachParams,
  AnimeExtraFileAttachParams,
  AnimeFileSyncParams,
  AnimeFileSyncResult
} from '@shared/holdings'
import { animeUnitIdentityKey } from '@shared/metadata'
import type { AudioTrack, SubtitleTrack, VideoFileInfo } from '@shared/video'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  classifyReleaseFile,
  isExtraDirectoryName,
  isVideoFile,
  type AnimeEpisodeCandidate,
  type AnimeExtraCandidate
} from './recognition'

const log = createLogger('Holdings')

/** Depth cap that covers `Anime/Season/Disc` layouts without walking archives. */
export const MAX_WALK_DEPTH = 4

/** The one episode a film entry owns; providers list the film as episode 1. */
const FILM_EPISODE_NUMBER = 1

export interface AnimeFileSyncOptions extends AnimeFileSyncParams {
  signal?: AbortSignal
}

interface WalkedFiles {
  episodes: AnimeEpisodeCandidate[]
  extras: AnimeExtraCandidate[]
}

/** Column values a file row carries from one probe pass. */
interface ProbedFileValues {
  fileSize: number | null
  fileMtime: Date | null
  container: string | null
  videoCodec: string | null
  bitDepth: number | null
  width: number | null
  height: number | null
  durationMs: number | null
  audioTracks: AudioTrack[]
  subtitleTracks: SubtitleTrack[]
}

interface ProbedEpisodeFile {
  candidate: AnimeEpisodeCandidate
  values: ProbedFileValues
}

interface ProbedExtraFile {
  candidate: AnimeExtraCandidate
  values: ProbedFileValues
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
    : animeUnitIdentityKey({ type: candidate.type, episodeNumber: candidate.number })
}

/**
 * Shift file-derived regular episode numbers into the entry's metadata
 * numbering (`file number − offset`), so absolutely numbered releases match
 * the scraped episode rows. Specials keep their own sequence, and a shift
 * that leaves no positive number demotes the file to an unnumbered candidate
 * instead of inventing an episode.
 */
function applyEpisodeFileNumberOffset(candidates: AnimeEpisodeCandidate[], offset: number): void {
  if (offset === 0) return

  for (const candidate of candidates) {
    if (candidate.type !== 'regular' || candidate.number === undefined) continue

    const shifted = candidate.number - offset
    candidate.number = shifted > 0 ? shifted : undefined
  }
}

/**
 * Point every regular candidate of a film at its single episode.
 *
 * A film is one consumption unit, so a filename number is not evidence of an
 * episode: numeric titles and part labels would otherwise invent episodes, and
 * an unreadable name would split one film across per-file rows. Every regular
 * file therefore describes the same episode and lands as a version of it.
 * Explicitly marked specials keep their own rows — a bonus video shipped
 * beside the film is not another cut of it.
 */
function claimFilmEpisodeCandidates(candidates: AnimeEpisodeCandidate[]): void {
  for (const candidate of candidates) {
    if (candidate.type !== 'regular') continue
    candidate.number = FILM_EPISODE_NUMBER
  }
}

/** Identity key of a stored row; null keys the row by the files it owns. */
function episodeRowKey(episode: AnimeEpisode): string | null {
  return episode.episodeNumber !== null
    ? animeUnitIdentityKey({ type: episode.type, episodeNumber: episode.episodeNumber })
    : null
}

const ANIME_EPISODE_RECONCILE_SPEC: UnitReconcileSpec<
  AnimeEpisode,
  AnimeEpisodeFile,
  AnimeEpisodeCandidate,
  ProbedFileValues
> = {
  candidateKey: episodeCandidateKey,
  candidatePath: (candidate) => candidate.path,
  rowKey: episodeRowKey,
  // Unnumbered candidates already key by file path, so the group key is the
  // same construction and a stored row is found through any of its files.
  fileGroupKey: (filePath) => `file:${filePath}`,
  onMatched: (tx, episode, _candidate, values) => {
    // A scraped episode rarely carries a runtime; the file always does.
    if (episode.durationMs === null && values.durationMs) {
      tx.update(animeEpisodes)
        .set({ durationMs: values.durationMs })
        .where(eq(animeEpisodes.id, episode.id))
        .run()
    }
  },
  insertUnit: (tx, animeId, candidate, values, order) => {
    const row: NewAnimeEpisode = {
      id: nanoid(),
      animeId,
      type: candidate.type,
      episodeNumber: candidate.number ?? null,
      name: candidate.number === undefined ? candidate.name : null,
      durationMs: values.durationMs,
      orderInAnime: order
    }
    tx.insert(animeEpisodes).values(row).run()
    return row.id as string
  },
  deleteUnit: (tx, unitId) => {
    tx.delete(animeEpisodes).where(eq(animeEpisodes.id, unitId)).run()
  },
  fileUnitId: (file) => file.episodeId,
  insertFile: (tx, unitId, candidate, values, isPrimary) => {
    const fileValues = {
      episodeId: unitId,
      path: candidate.path,
      ...values,
      isPrimary
    } satisfies Omit<NewAnimeEpisodeFile, 'id'>
    tx.insert(animeEpisodeFiles)
      .values({ id: nanoid(), ...fileValues })
      .run()
  },
  updateFile: (tx, fileId, unitId, candidate, values, isPrimary) => {
    const fileValues = {
      episodeId: unitId,
      path: candidate.path,
      ...values,
      isPrimary
    } satisfies Omit<NewAnimeEpisodeFile, 'id'>
    tx.update(animeEpisodeFiles).set(fileValues).where(eq(animeEpisodeFiles.id, fileId)).run()
  },
  deleteFile: (tx, fileId) => {
    tx.delete(animeEpisodeFiles).where(eq(animeEpisodeFiles.id, fileId)).run()
  },
  isUnitProtected: (episode) => episode.watched,
  readSessionReferencedUnitIds: (tx, unitIds) =>
    new Set(
      (tx as DbQueryContext)
        .select({ episodeId: animeSessions.episodeId })
        .from(animeSessions)
        .where(inArray(animeSessions.episodeId, [...unitIds]))
        .all()
        .flatMap((row) => (row.episodeId ? [row.episodeId] : []))
    )
}

/** File-row column values derived from one probe pass. */
function toProbedFileValues(stat: FileStat, info: VideoFileInfo | null): ProbedFileValues {
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

export class AnimeFileSyncHandler {
  private readonly passes = new SyncPassQueue<AnimeFileSyncResult>()

  constructor(
    private readonly dbService: DbService,
    private readonly probe: VideoProbe
  ) {}

  async sync(params: AnimeFileSyncOptions): Promise<AnimeFileSyncResult> {
    return this.passes.run(params.animeId, () => this.runSync(params))
  }

  /**
   * Walk the anime directory and write what it finds.
   *
   * Probing runs outside the transaction because ffprobe is slow and the write
   * must stay a single synchronous better-sqlite3 unit.
   */
  private async runSync(params: AnimeFileSyncOptions): Promise<AnimeFileSyncResult> {
    const { animeId, signal } = params
    const animeRow = this.readAnimeSyncConfig(animeId)
    const dirPath = params.dirPath ?? animeRow?.animeDirPath

    if (!dirPath) {
      throw new Error('Anime has no library directory to scan')
    }

    const walked = await this.walk(dirPath, signal)

    // Manual rows already claim their paths, so those files leave the
    // candidate set entirely: sync neither re-probes nor re-assigns them.
    const manualPaths = new Set([
      ...this.readManualEpisodeFiles(animeId).map((file) => file.path),
      ...this.readManualExtraFiles(animeId).map((file) => file.path)
    ])
    walked.episodes = walked.episodes.filter((candidate) => !manualPaths.has(candidate.path))
    walked.extras = walked.extras.filter((extra) => !manualPaths.has(extra.path))

    // A film's files are versions of one episode, so it reads its numbering
    // from the entry rather than from filenames; a series keeps its own.
    if (animeRow?.format === 'movie') {
      claimFilmEpisodeCandidates(walked.episodes)
    } else {
      applyEpisodeFileNumberOffset(walked.episodes, animeRow?.episodeFileNumberOffset ?? 0)
    }
    walked.episodes.sort(compareEpisodes)

    const storedProbes = this.readStoredProbes(animeId)

    const probedEpisodes: ProbedEpisodeFile[] = []
    for (const candidate of walked.episodes) {
      signal?.throwIfAborted()
      const values = await this.probeFile(candidate.path, storedProbes)
      if (values) {
        probedEpisodes.push({ candidate, values })
      }
    }

    const probedExtras: ProbedExtraFile[] = []
    for (const candidate of walked.extras) {
      signal?.throwIfAborted()
      const values = await this.probeFile(candidate.path, storedProbes)
      if (values) {
        probedExtras.push({ candidate, values })
      }
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

      const reconciled = reconcileUnitFiles(tx, ANIME_EPISODE_RECONCILE_SPEC, {
        ownerId: animeId,
        probed: probedEpisodes,
        existingUnits: existingEpisodes,
        existingFiles
      })
      const extraCount = this.writeExtras(tx, animeId, probedExtras)

      return {
        episodeCount: reconciled.unitIdByKey.size,
        fileCount: reconciled.fileCount,
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
  async attachFile(params: AnimeEpisodeFileAttachParams): Promise<void> {
    const { episodeId, path: filePath } = params

    const stat = await readFileStat(filePath)
    if (!stat) {
      throw new Error(`Episode file is not readable: ${filePath}`)
    }
    const info = await this.probe.read(filePath)

    this.dbService.client.transaction((tx) => {
      const [episode] = tx
        .select()
        .from(animeEpisodes)
        .where(eq(animeEpisodes.id, episodeId))
        .limit(1)
        .all()
      if (!episode) {
        throw new Error(`Episode not found: ${episodeId}`)
      }

      this.requirePathUnclaimed(tx, filePath)

      const siblings = tx
        .select({ id: animeEpisodeFiles.id })
        .from(animeEpisodeFiles)
        .where(eq(animeEpisodeFiles.episodeId, episodeId))
        .all()

      tx.insert(animeEpisodeFiles)
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
        tx.update(animeEpisodes)
          .set({ durationMs: info.durationMs })
          .where(eq(animeEpisodes.id, episodeId))
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
  async attachExtra(params: AnimeExtraFileAttachParams): Promise<void> {
    const { animeId, path: filePath } = params

    const stat = await readFileStat(filePath)
    if (!stat) {
      throw new Error(`Extra file is not readable: ${filePath}`)
    }
    const info = await this.probe.read(filePath)
    const classified = classifyReleaseFile(filePath, true)
    const recognized = classified.kind === 'extra' ? classified.extra : undefined

    this.dbService.client.transaction((tx) => {
      this.requirePathUnclaimed(tx, filePath)

      let extraId = params.extraId
      if (extraId) {
        const [extra] = tx
          .select({ id: animeExtras.id })
          .from(animeExtras)
          .where(and(eq(animeExtras.id, extraId), eq(animeExtras.animeId, animeId)))
          .limit(1)
          .all()
        if (!extra) {
          throw new Error(`Extra not found: ${extraId}`)
        }
      } else {
        const [anime] = tx
          .select({ id: animes.id })
          .from(animes)
          .where(eq(animes.id, animeId))
          .limit(1)
          .all()
        if (!anime) {
          throw new Error(`Anime not found: ${animeId}`)
        }

        const siblings = tx
          .select({ orderInAnime: animeExtras.orderInAnime })
          .from(animeExtras)
          .where(eq(animeExtras.animeId, animeId))
          .all()
        const nextOrder = siblings.reduce((max, row) => Math.max(max, row.orderInAnime + 1), 0)

        extraId = nanoid()
        tx.insert(animeExtras)
          .values({
            id: extraId,
            animeId,
            type: params.type ?? recognized?.type ?? 'other',
            name: params.name?.trim() || (recognized?.name ?? path.basename(filePath)),
            orderInAnime: nextOrder,
            isManual: true
          })
          .run()
      }

      const siblingFiles = tx
        .select({ id: animeExtraFiles.id })
        .from(animeExtraFiles)
        .where(eq(animeExtraFiles.extraId, extraId))
        .all()

      tx.insert(animeExtraFiles)
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
      .select({ id: animeEpisodeFiles.id })
      .from(animeEpisodeFiles)
      .where(eq(animeEpisodeFiles.path, filePath))
      .limit(1)
      .all()
    if (claimedEpisode) {
      throw new Error(`File is already attached to an episode: ${filePath}`)
    }

    const [claimedExtra] = (tx as DbQueryContext)
      .select({ id: animeExtraFiles.id })
      .from(animeExtraFiles)
      .where(eq(animeExtraFiles.path, filePath))
      .limit(1)
      .all()
    if (claimedExtra) {
      throw new Error(`File is already attached to an extra: ${filePath}`)
    }
  }

  private readAnimeSyncConfig(animeId: string): {
    animeDirPath: string | null
    episodeFileNumberOffset: number
    format: AnimeFormat
  } | null {
    const [row] = this.dbService.client
      .select({
        animeDirPath: animes.animeDirPath,
        episodeFileNumberOffset: animes.episodeFileNumberOffset,
        format: animes.format
      })
      .from(animes)
      .where(eq(animes.id, animeId))
      .limit(1)
      .all()

    return row ?? null
  }

  private readManualEpisodeFiles(animeId: string): Array<{ path: string }> {
    return this.dbService.client
      .select({ path: animeEpisodeFiles.path })
      .from(animeEpisodeFiles)
      .innerJoin(animeEpisodes, eq(animeEpisodeFiles.episodeId, animeEpisodes.id))
      .where(and(eq(animeEpisodes.animeId, animeId), eq(animeEpisodeFiles.isManual, true)))
      .all()
  }

  private readManualExtraFiles(animeId: string): Array<{ path: string }> {
    return this.dbService.client
      .select({ path: animeExtraFiles.path })
      .from(animeExtraFiles)
      .innerJoin(animeExtras, eq(animeExtraFiles.extraId, animeExtras.id))
      .where(and(eq(animeExtras.animeId, animeId), eq(animeExtraFiles.isManual, true)))
      .all()
  }

  /**
   * Probe results already stored for this entry's files, keyed by path.
   *
   * Read before the probe pass so a file that has not changed can keep them.
   */
  private readStoredProbes(animeId: string): Map<string, ProbedFileValues> {
    const episodeFiles = this.dbService.client
      .select({
        path: animeEpisodeFiles.path,
        fileSize: animeEpisodeFiles.fileSize,
        fileMtime: animeEpisodeFiles.fileMtime,
        container: animeEpisodeFiles.container,
        videoCodec: animeEpisodeFiles.videoCodec,
        bitDepth: animeEpisodeFiles.bitDepth,
        width: animeEpisodeFiles.width,
        height: animeEpisodeFiles.height,
        durationMs: animeEpisodeFiles.durationMs,
        audioTracks: animeEpisodeFiles.audioTracks,
        subtitleTracks: animeEpisodeFiles.subtitleTracks
      })
      .from(animeEpisodeFiles)
      .innerJoin(animeEpisodes, eq(animeEpisodeFiles.episodeId, animeEpisodes.id))
      .where(eq(animeEpisodes.animeId, animeId))
      .all()

    const extraFiles = this.dbService.client
      .select({
        path: animeExtraFiles.path,
        fileSize: animeExtraFiles.fileSize,
        fileMtime: animeExtraFiles.fileMtime,
        container: animeExtraFiles.container,
        videoCodec: animeExtraFiles.videoCodec,
        bitDepth: animeExtraFiles.bitDepth,
        width: animeExtraFiles.width,
        height: animeExtraFiles.height,
        durationMs: animeExtraFiles.durationMs,
        audioTracks: animeExtraFiles.audioTracks,
        subtitleTracks: animeExtraFiles.subtitleTracks
      })
      .from(animeExtraFiles)
      .innerJoin(animeExtras, eq(animeExtraFiles.extraId, animeExtras.id))
      .where(eq(animeExtras.animeId, animeId))
      .all()

    return new Map(
      [...episodeFiles, ...extraFiles].map(({ path: filePath, ...values }) => [filePath, values])
    )
  }

  /**
   * Row values for one candidate file, or null when it is unreadable.
   *
   * ffprobe is skipped when the stored row already describes this exact file, so
   * a re-sync only pays for what actually changed.
   */
  private async probeFile(
    filePath: string,
    storedProbes: Map<string, ProbedFileValues>
  ): Promise<ProbedFileValues | null> {
    const stat = await readFileStat(filePath)
    if (!stat) return null

    const stored = storedProbes.get(filePath)
    if (stored && isProbeCurrent(stored, stat)) {
      return stored
    }

    return toProbedFileValues(stat, await this.probe.read(filePath))
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

        const classified = classifyReleaseFile(entryPath, inExtras)
        if (classified.kind === 'extra') {
          result.extras.push(classified.extra)
        } else {
          result.episodes.push(classified.episode)
        }
      }
    }

    await visit(dirPath, 0, false)
    return result
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
  private writeExtras(tx: DbContext, animeId: string, probed: ProbedExtraFile[]): number {
    const existingExtras = tx
      .select()
      .from(animeExtras)
      .where(eq(animeExtras.animeId, animeId))
      .all()
    const extraIds = existingExtras.map((extra) => extra.id)
    const existingFiles = extraIds.length
      ? tx.select().from(animeExtraFiles).where(inArray(animeExtraFiles.extraId, extraIds)).all()
      : []

    const extraById = new Map(existingExtras.map((extra) => [extra.id, extra]))
    const fileByPath = new Map(existingFiles.map((file) => [file.path, file]))

    // Sync-owned files that vanished from disk lose their rows first, so the
    // partial primary index never sees a stale primary colliding with a new one.
    const livePaths = new Set(probed.map(({ candidate }) => candidate.path))
    const deletedFileIds = new Set<string>()
    for (const file of existingFiles) {
      if (file.isManual || livePaths.has(file.path)) continue
      tx.delete(animeExtraFiles).where(eq(animeExtraFiles.id, file.id)).run()
      deletedFileIds.add(file.id)
    }

    let syncOrder = 0
    for (const { candidate, values } of probed) {
      const known = fileByPath.get(candidate.path)

      if (known) {
        tx.update(animeExtraFiles).set(values).where(eq(animeExtraFiles.id, known.id)).run()

        // Recognition may improve across runs, but user-owned extras keep
        // their name, type, and ordering.
        const owner = extraById.get(known.extraId)
        if (owner && !owner.isManual) {
          const patch: Partial<AnimeExtra> = {}
          if (owner.name !== candidate.name) patch.name = candidate.name
          if (owner.type !== candidate.type) patch.type = candidate.type
          if (owner.orderInAnime !== syncOrder) patch.orderInAnime = syncOrder
          if (Object.keys(patch).length > 0) {
            tx.update(animeExtras).set(patch).where(eq(animeExtras.id, owner.id)).run()
          }
          syncOrder++
        }
        continue
      }

      const extraId = nanoid()
      tx.insert(animeExtras)
        .values({
          id: extraId,
          animeId,
          type: candidate.type,
          name: candidate.name,
          orderInAnime: syncOrder++
        })
        .run()

      const fileValues = {
        extraId,
        path: candidate.path,
        ...values,
        isPrimary: true
      } satisfies Omit<NewAnimeExtraFile, 'id'>
      tx.insert(animeExtraFiles)
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
      tx.delete(animeExtras).where(eq(animeExtras.id, extra.id)).run()
    }

    return (tx as DbQueryContext)
      .select({ id: animeExtras.id })
      .from(animeExtras)
      .where(eq(animeExtras.animeId, animeId))
      .all().length
  }
}
