/**
 * Movie local file sync and manual file attachment.
 *
 * A film has one consumption unit, so sync has no episode grain to reconstruct:
 * every video under the movie directory is either a release of the feature or
 * an extra, and the reconciliation is purely a file-row pass.
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
  movieExtraFiles,
  movieExtras,
  movieFiles,
  movies,
  type MovieExtra,
  type NewMovieExtraFile,
  type NewMovieFile
} from '@shared/db'
import type {
  IngestAttachMovieExtraFileParams,
  IngestAttachMovieFileParams,
  IngestSyncMovieFilesParams,
  IngestSyncMovieFilesResult
} from '@shared/ingest'
import type { MediaFileInfo } from '@shared/media-info'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  classifyMovieReleaseFile,
  isExtraDirectoryName,
  isVideoFile,
  type MovieExtraCandidate,
  type MovieVersionCandidate
} from './recognition'

const log = createLogger('Ingest')

/** Depth cap that covers `Movie/Disc` layouts without walking archives. */
const MAX_WALK_DEPTH = 3

export interface MovieFileSyncParams extends IngestSyncMovieFilesParams {
  signal?: AbortSignal
}

interface WalkedFiles {
  versions: MovieVersionCandidate[]
  extras: MovieExtraCandidate[]
}

interface FileStat {
  size: number
  mtimeMs: number
}

interface ProbedVersionFile {
  candidate: MovieVersionCandidate
  stat: FileStat
  info: MediaFileInfo | null
}

interface ProbedExtraFile {
  candidate: MovieExtraCandidate
  stat: FileStat
  info: MediaFileInfo | null
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

export class MovieFileSyncHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly mediaInfo: MediaInfoService
  ) {}

  /**
   * Walk the movie directory and write what it finds.
   *
   * Probing runs outside the transaction because ffprobe is slow and the write
   * must stay a single synchronous better-sqlite3 unit.
   */
  async sync(params: MovieFileSyncParams): Promise<IngestSyncMovieFilesResult> {
    const { movieId, signal } = params
    const dirPath = params.dirPath ?? this.readMovieDirPath(movieId)

    if (!dirPath) {
      throw new Error('Movie has no library directory to scan')
    }

    const walked = await this.walk(dirPath, signal)

    // Manual rows already claim their paths, so those files leave the
    // candidate set entirely: sync neither re-probes nor re-assigns them.
    const manualPaths = new Set([
      ...this.readManualFiles(movieId).map((file) => file.path),
      ...this.readManualExtraFiles(movieId).map((file) => file.path)
    ])
    walked.versions = walked.versions.filter((candidate) => !manualPaths.has(candidate.path))
    walked.extras = walked.extras.filter((extra) => !manualPaths.has(extra.path))
    walked.versions.sort((a, b) => a.path.localeCompare(b.path))

    const probedVersions: ProbedVersionFile[] = []
    for (const candidate of walked.versions) {
      signal?.throwIfAborted()
      const stat = await this.readStat(candidate.path)
      if (!stat) continue
      probedVersions.push({ candidate, stat, info: await this.mediaInfo.probe(candidate.path) })
    }

    const probedExtras: ProbedExtraFile[] = []
    for (const candidate of walked.extras) {
      signal?.throwIfAborted()
      const stat = await this.readStat(candidate.path)
      if (!stat) continue
      probedExtras.push({ candidate, stat, info: await this.mediaInfo.probe(candidate.path) })
    }

    return this.dbService.client.transaction((tx) => {
      const fileCount = this.writeFiles(tx, movieId, probedVersions)
      const extraCount = this.writeExtras(tx, movieId, probedExtras)
      return { fileCount, extraCount }
    })
  }

  /**
   * Attach one file to the movie as a user-owned release row.
   *
   * Probing runs before the write because ffprobe is slow; the row is marked
   * manual so sync passes leave it alone from now on.
   */
  async attachFile(params: IngestAttachMovieFileParams): Promise<void> {
    const { movieId, path: filePath } = params

    const stat = await this.readStat(filePath)
    if (!stat) {
      throw new Error(`Movie file is not readable: ${filePath}`)
    }
    const info = await this.mediaInfo.probe(filePath)
    const classified = classifyMovieReleaseFile(filePath, false)
    const recognizedEdition = classified.kind === 'version' ? classified.version.edition : undefined

    this.dbService.client.transaction((tx) => {
      const [movie] = tx
        .select({ id: movies.id })
        .from(movies)
        .where(eq(movies.id, movieId))
        .limit(1)
        .all()
      if (!movie) {
        throw new Error(`Movie not found: ${movieId}`)
      }

      this.requirePathUnclaimed(tx, filePath)

      const siblings = tx
        .select({ id: movieFiles.id })
        .from(movieFiles)
        .where(eq(movieFiles.movieId, movieId))
        .all()

      tx.insert(movieFiles)
        .values({
          id: nanoid(),
          movieId,
          path: filePath,
          edition: params.edition?.trim() || recognizedEdition || null,
          ...toProbedFileValues(stat, info),
          isPrimary: siblings.length === 0,
          isManual: true
        })
        .run()
    })
  }

  /**
   * Attach one on-disk video as a user-owned extra file.
   *
   * With `extraId` the file joins that extra as an alternate version;
   * otherwise a new user-owned extra is created, with filename recognition
   * filling name and type unless the caller supplied explicit values.
   */
  async attachExtra(params: IngestAttachMovieExtraFileParams): Promise<void> {
    const { movieId, path: filePath } = params

    const stat = await this.readStat(filePath)
    if (!stat) {
      throw new Error(`Extra file is not readable: ${filePath}`)
    }
    const info = await this.mediaInfo.probe(filePath)
    const classified = classifyMovieReleaseFile(filePath, true)
    const recognized = classified.kind === 'extra' ? classified.extra : undefined

    this.dbService.client.transaction((tx) => {
      this.requirePathUnclaimed(tx, filePath)

      let extraId = params.extraId
      if (extraId) {
        const [extra] = tx
          .select({ id: movieExtras.id })
          .from(movieExtras)
          .where(and(eq(movieExtras.id, extraId), eq(movieExtras.movieId, movieId)))
          .limit(1)
          .all()
        if (!extra) {
          throw new Error(`Extra not found: ${extraId}`)
        }
      } else {
        const [movie] = tx
          .select({ id: movies.id })
          .from(movies)
          .where(eq(movies.id, movieId))
          .limit(1)
          .all()
        if (!movie) {
          throw new Error(`Movie not found: ${movieId}`)
        }

        const siblings = tx
          .select({ orderInMovie: movieExtras.orderInMovie })
          .from(movieExtras)
          .where(eq(movieExtras.movieId, movieId))
          .all()
        const nextOrder = siblings.reduce((max, row) => Math.max(max, row.orderInMovie + 1), 0)

        extraId = nanoid()
        tx.insert(movieExtras)
          .values({
            id: extraId,
            movieId,
            type: params.type ?? recognized?.type ?? 'other',
            name: params.name?.trim() || (recognized?.name ?? path.basename(filePath)),
            orderInMovie: nextOrder,
            isManual: true
          })
          .run()
      }

      const siblingFiles = tx
        .select({ id: movieExtraFiles.id })
        .from(movieExtraFiles)
        .where(eq(movieExtraFiles.extraId, extraId))
        .all()

      tx.insert(movieExtraFiles)
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

  /** Throws when the path is already claimed by any release or extra file row. */
  private requirePathUnclaimed(tx: DbContext, filePath: string): void {
    const [claimedFile] = (tx as DbQueryContext)
      .select({ id: movieFiles.id })
      .from(movieFiles)
      .where(eq(movieFiles.path, filePath))
      .limit(1)
      .all()
    if (claimedFile) {
      throw new Error(`File is already attached to a movie: ${filePath}`)
    }

    const [claimedExtra] = (tx as DbQueryContext)
      .select({ id: movieExtraFiles.id })
      .from(movieExtraFiles)
      .where(eq(movieExtraFiles.path, filePath))
      .limit(1)
      .all()
    if (claimedExtra) {
      throw new Error(`File is already attached to an extra: ${filePath}`)
    }
  }

  private readMovieDirPath(movieId: string): string | null {
    const [row] = this.dbService.client
      .select({ movieDirPath: movies.movieDirPath })
      .from(movies)
      .where(eq(movies.id, movieId))
      .limit(1)
      .all()

    return row?.movieDirPath ?? null
  }

  private readManualFiles(movieId: string): Array<{ path: string }> {
    return this.dbService.client
      .select({ path: movieFiles.path })
      .from(movieFiles)
      .where(and(eq(movieFiles.movieId, movieId), eq(movieFiles.isManual, true)))
      .all()
  }

  private readManualExtraFiles(movieId: string): Array<{ path: string }> {
    return this.dbService.client
      .select({ path: movieExtraFiles.path })
      .from(movieExtraFiles)
      .innerJoin(movieExtras, eq(movieExtraFiles.extraId, movieExtras.id))
      .where(and(eq(movieExtras.movieId, movieId), eq(movieExtraFiles.isManual, true)))
      .all()
  }

  private async readStat(filePath: string): Promise<FileStat | null> {
    try {
      const stat = await fs.stat(filePath)
      return { size: stat.size, mtimeMs: stat.mtimeMs }
    } catch (error) {
      log.warn('Failed to stat movie file:', error)
      return null
    }
  }

  private async walk(dirPath: string, signal?: AbortSignal): Promise<WalkedFiles> {
    const result: WalkedFiles = { versions: [], extras: [] }

    const visit = async (current: string, depth: number, inExtras: boolean): Promise<void> => {
      signal?.throwIfAborted()
      if (depth > MAX_WALK_DEPTH) return

      const entries = await fs.readdir(current, { withFileTypes: true }).catch((error) => {
        log.warn('Failed to read movie directory:', error)
        return []
      })

      for (const entry of entries) {
        const entryPath = path.join(current, entry.name)

        if (entry.isDirectory()) {
          await visit(entryPath, depth + 1, inExtras || isExtraDirectoryName(entry.name))
          continue
        }

        if (!entry.isFile() || !isVideoFile(entry.name)) continue

        const classified = classifyMovieReleaseFile(entryPath, inExtras)
        if (classified.kind === 'extra') {
          result.extras.push(classified.extra)
        } else {
          result.versions.push(classified.version)
        }
      }
    }

    await visit(dirPath, 0, false)
    return result
  }

  /**
   * Reconcile the feature's release rows against the walked candidates.
   *
   * Rows are claimed by path. A stored primary preference survives as long as
   * its file does; a new primary is elected only when no preferred file remains
   * and no manual row already holds the slot.
   */
  private writeFiles(tx: DbContext, movieId: string, probed: ProbedVersionFile[]): number {
    const existingFiles = tx.select().from(movieFiles).where(eq(movieFiles.movieId, movieId)).all()
    const knownByPath = new Map(existingFiles.map((file) => [file.path, file]))

    // Deletion runs first so the partial primary index never sees two rows.
    const livePaths = new Set(probed.map(({ candidate }) => candidate.path))
    const survivingFiles: typeof existingFiles = []
    for (const file of existingFiles) {
      if (!file.isManual && !livePaths.has(file.path)) {
        tx.delete(movieFiles).where(eq(movieFiles.id, file.id)).run()
        continue
      }
      survivingFiles.push(file)
    }

    const preferredPaths = new Set(
      survivingFiles.filter((file) => file.isPrimary).map((file) => file.path)
    )
    const hasManualPrimary = survivingFiles.some((file) => file.isManual && file.isPrimary)
    const primaryPath = hasManualPrimary
      ? null
      : (probed.find(({ candidate }) => preferredPaths.has(candidate.path))?.candidate.path ??
        probed[0]?.candidate.path ??
        null)

    for (const { candidate, stat, info } of probed) {
      const values = {
        movieId,
        path: candidate.path,
        edition: candidate.edition ?? null,
        ...toProbedFileValues(stat, info),
        isPrimary: candidate.path === primaryPath
      } satisfies Omit<NewMovieFile, 'id'>

      const known = knownByPath.get(candidate.path)
      if (known) {
        // A user-set edition label is theirs; recognition never overwrites it.
        const { edition, ...syncValues } = values
        tx.update(movieFiles)
          .set(known.isManual ? syncValues : { ...syncValues, edition })
          .where(eq(movieFiles.id, known.id))
          .run()
      } else {
        tx.insert(movieFiles)
          .values({ id: nanoid(), ...values })
          .run()
      }
    }

    return (tx as DbQueryContext)
      .select({ id: movieFiles.id })
      .from(movieFiles)
      .where(eq(movieFiles.movieId, movieId))
      .all().length
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
  private writeExtras(tx: DbContext, movieId: string, probed: ProbedExtraFile[]): number {
    const existingExtras = tx
      .select()
      .from(movieExtras)
      .where(eq(movieExtras.movieId, movieId))
      .all()
    const extraIds = existingExtras.map((extra) => extra.id)
    const existingFiles = extraIds.length
      ? tx.select().from(movieExtraFiles).where(inArray(movieExtraFiles.extraId, extraIds)).all()
      : []

    const extraById = new Map(existingExtras.map((extra) => [extra.id, extra]))
    const fileByPath = new Map(existingFiles.map((file) => [file.path, file]))

    const livePaths = new Set(probed.map(({ candidate }) => candidate.path))
    const deletedFileIds = new Set<string>()
    for (const file of existingFiles) {
      if (file.isManual || livePaths.has(file.path)) continue
      tx.delete(movieExtraFiles).where(eq(movieExtraFiles.id, file.id)).run()
      deletedFileIds.add(file.id)
    }

    let syncOrder = 0
    for (const { candidate, stat, info } of probed) {
      const known = fileByPath.get(candidate.path)

      if (known) {
        tx.update(movieExtraFiles)
          .set(toProbedFileValues(stat, info))
          .where(eq(movieExtraFiles.id, known.id))
          .run()

        // Recognition may improve across runs, but user-owned extras keep
        // their name, type, and ordering.
        const owner = extraById.get(known.extraId)
        if (owner && !owner.isManual) {
          const patch: Partial<MovieExtra> = {}
          if (owner.name !== candidate.name) patch.name = candidate.name
          if (owner.type !== candidate.type) patch.type = candidate.type
          if (owner.orderInMovie !== syncOrder) patch.orderInMovie = syncOrder
          if (Object.keys(patch).length > 0) {
            tx.update(movieExtras).set(patch).where(eq(movieExtras.id, owner.id)).run()
          }
          syncOrder++
        }
        continue
      }

      const extraId = nanoid()
      tx.insert(movieExtras)
        .values({
          id: extraId,
          movieId,
          type: candidate.type,
          name: candidate.name,
          orderInMovie: syncOrder++
        })
        .run()

      const fileValues = {
        extraId,
        path: candidate.path,
        ...toProbedFileValues(stat, info),
        isPrimary: true
      } satisfies Omit<NewMovieExtraFile, 'id'>
      tx.insert(movieExtraFiles)
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
      tx.delete(movieExtras).where(eq(movieExtras.id, extra.id)).run()
    }

    return (tx as DbQueryContext)
      .select({ id: movieExtras.id })
      .from(movieExtras)
      .where(eq(movieExtras.movieId, movieId))
      .all().length
  }
}
