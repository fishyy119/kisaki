import { and, eq, inArray, or } from 'drizzle-orm'
import {
  animeEpisodeExternalIds,
  animeEpisodeFiles,
  animeEpisodes,
  animeExtras,
  animeNotes,
  animeSessions,
  comicChapterExternalIds,
  comicChapterFiles,
  comicChapters,
  comicNotes,
  comicSessions,
  companyRelations,
  gameNotes,
  gameSessions,
  mediaRelations,
  novelNotes,
  novelSessions,
  novelVolumeExternalIds,
  novelVolumeFiles,
  novelVolumes,
  type AnimeEpisode,
  type ComicChapter,
  type NovelVolume
} from '@shared/db'
import type { AllEntityType, MediaType } from '@shared/entity-types'
import {
  animeUnitIdentityKey,
  comicUnitIdentityKey,
  isNumberedComicUnit,
  isNumberedNovelVolume,
  novelUnitIdentityKey
} from '@shared/metadata'
import type { DbContext, DbQueryContext, DbWriteContext } from '../../types'
import type { OwnedDataMerge, RelationMergeConfig, SameClassRelationMerge, MergeRow } from './types'

/**
 * Owned-row merges that a plain link-table rewrite cannot express. Keyed by
 * entity type so adding a media type forces an explicit decision here instead
 * of silently cascading the source's owned rows away with the source row.
 */
export const OWNED_DATA_MERGES: Record<AllEntityType, OwnedDataMerge | null> = {
  game: mergeGameOwnedData,
  anime: mergeAnimeOwnedData,
  comic: mergeComicOwnedData,
  novel: mergeNovelOwnedData,
  character: null,
  person: null,
  company: null,
  collection: null,
  tag: null
}

/**
 * Same-class relation merges, one per class that owns an entry graph. Keyed by
 * entity type for the same reason as the owned-data seam above: a class that
 * gains a relation table has to answer here.
 */
export const SAME_CLASS_RELATION_MERGES: Record<AllEntityType, SameClassRelationMerge | null> = {
  game: (db, targetId, sourceId, now) => mergeMediaRelations(db, 'game', targetId, sourceId, now),
  anime: (db, targetId, sourceId, now) => mergeMediaRelations(db, 'anime', targetId, sourceId, now),
  comic: (db, targetId, sourceId, now) => mergeMediaRelations(db, 'comic', targetId, sourceId, now),
  novel: (db, targetId, sourceId, now) => mergeMediaRelations(db, 'novel', targetId, sourceId, now),
  character: null,
  person: null,
  company: mergeCompanyRelations,
  collection: null,
  tag: null
}

function mergeGameOwnedData(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  return (
    mergeGameSessions(db, targetId, sourceId, now) + mergeGameNotes(db, targetId, sourceId, now)
  )
}

/**
 * Merging two entries of the same show must preserve the source's watch data.
 * Source episodes align to target episodes by shared external id first, then
 * by (type, episode number); aligned episodes fold their watch state, files,
 * identities, and sessions into the target row, unmatched episodes move to the
 * target entry wholesale (keeping their id, so episode attachments stay valid).
 */
function mergeAnimeOwnedData(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const targetEpisodes = readAnimeEpisodes(db, targetId)
  const sourceEpisodes = readAnimeEpisodes(db, sourceId)
  let changed = 0

  const alignment = buildEpisodeAlignmentIndex(db, targetEpisodes, sourceEpisodes)
  let nextEpisodeOrder = nextOrderAfter(targetEpisodes.map((episode) => episode.orderInAnime))
  const takenNumberKeys = collectNumberKeys(targetEpisodes, animeEpisodeNumberKey)

  for (const episode of sourceEpisodes) {
    const alignedId = alignment.get(episode.id)
    if (alignedId) {
      foldEpisodeIntoTarget(db, episode, alignedId, now)
    } else {
      // Numbering is unique per entry and type, so a moved episode whose
      // number the target already holds gives the number up instead of
      // failing the merge; its files and watch state cross over untouched.
      const numberKey = animeEpisodeNumberKey(episode)
      const taken = numberKey !== null && takenNumberKeys.has(numberKey)
      if (numberKey !== null && !taken) takenNumberKeys.add(numberKey)

      db.update(animeEpisodes)
        .set({
          animeId: targetId,
          orderInAnime: nextEpisodeOrder++,
          updatedAt: now,
          ...(taken ? { episodeNumber: null } : {})
        })
        .where(eq(animeEpisodes.id, episode.id))
        .run()
    }
    changed++
  }

  changed += mergeAnimeSessions(db, targetId, sourceId, now)
  changed += mergeAnimeExtras(db, targetId, sourceId, now)
  changed += mergeAnimeNotes(db, targetId, sourceId, now)
  return changed
}

function readAnimeEpisodes(db: DbContext, animeId: string): AnimeEpisode[] {
  return db.select().from(animeEpisodes).where(eq(animeEpisodes.animeId, animeId)).all()
}

/** Identity key of a stored episode; null for unnumbered rows, which never collide. */
function animeEpisodeNumberKey(episode: AnimeEpisode): string | null {
  return episode.episodeNumber === null
    ? null
    : animeUnitIdentityKey({ type: episode.type, episodeNumber: episode.episodeNumber })
}

/** Maps each source episode id to the target episode id it aligns with. */
function buildEpisodeAlignmentIndex(
  db: DbContext,
  targetEpisodes: AnimeEpisode[],
  sourceEpisodes: AnimeEpisode[]
): Map<string, string> {
  const byExternalId = new Map<string, string>()
  const byNumber = new Map<string, string>()
  for (const episode of targetEpisodes) {
    const numberKey = animeEpisodeNumberKey(episode)
    if (numberKey) byNumber.set(numberKey, episode.id)
  }
  for (const row of readEpisodeExternalIds(db, targetEpisodes)) {
    byExternalId.set(`${row.source}\0${row.externalId}`, row.episodeId)
  }

  const sourceExternalIds = new Map<string, { source: string; externalId: string }[]>()
  for (const row of readEpisodeExternalIds(db, sourceEpisodes)) {
    const list = sourceExternalIds.get(row.episodeId) ?? []
    list.push(row)
    sourceExternalIds.set(row.episodeId, list)
  }

  const alignment = new Map<string, string>()
  const claimed = new Set<string>()
  for (const episode of sourceEpisodes) {
    const identityMatch = (sourceExternalIds.get(episode.id) ?? [])
      .map((row) => byExternalId.get(`${row.source}\0${row.externalId}`))
      .find((id) => id && !claimed.has(id))
    const numberKey = animeEpisodeNumberKey(episode)
    const numberMatch = numberKey === null ? undefined : byNumber.get(numberKey)
    const alignedId =
      identityMatch ?? (numberMatch && !claimed.has(numberMatch) ? numberMatch : undefined)
    if (alignedId) {
      alignment.set(episode.id, alignedId)
      claimed.add(alignedId)
    }
  }
  return alignment
}

function readEpisodeExternalIds(
  db: DbContext,
  episodes: AnimeEpisode[]
): { episodeId: string; source: string; externalId: string }[] {
  if (episodes.length === 0) return []
  return (db as DbQueryContext)
    .select({
      episodeId: animeEpisodeExternalIds.episodeId,
      source: animeEpisodeExternalIds.source,
      externalId: animeEpisodeExternalIds.externalId
    })
    .from(animeEpisodeExternalIds)
    .where(
      inArray(
        animeEpisodeExternalIds.episodeId,
        episodes.map((episode) => episode.id)
      )
    )
    .all()
}

/**
 * Folds a source episode into its aligned target episode: watch state merges
 * field-wise, while files, external ids, and sessions repoint to the target
 * row before the now-empty source row is removed. The target episode's own
 * still stays; the source's still would dangle once its attachment row dies.
 */
function foldEpisodeIntoTarget(
  db: DbContext,
  source: AnimeEpisode,
  targetEpisodeId: string,
  now: Date
): void {
  const target = db.select().from(animeEpisodes).where(eq(animeEpisodes.id, targetEpisodeId)).get()
  if (!target) return

  db.update(animeEpisodes)
    .set({
      watched: target.watched || source.watched,
      watchedAt: target.watchedAt ?? source.watchedAt,
      playCount: target.playCount + source.playCount,
      resumePositionMs: target.resumePositionMs ?? source.resumePositionMs,
      durationMs: target.durationMs ?? source.durationMs,
      updatedAt: now
    })
    .where(eq(animeEpisodes.id, targetEpisodeId))
    .run()

  const targetHasFiles =
    (db as DbQueryContext)
      .select({ id: animeEpisodeFiles.id })
      .from(animeEpisodeFiles)
      .where(eq(animeEpisodeFiles.episodeId, targetEpisodeId))
      .all().length > 0
  db.update(animeEpisodeFiles)
    .set({
      episodeId: targetEpisodeId,
      // The target's existing primary keeps priority over incoming files.
      ...(targetHasFiles && { isPrimary: false }),
      updatedAt: now
    })
    .where(eq(animeEpisodeFiles.episodeId, source.id))
    .run()

  db.update(animeEpisodeExternalIds)
    .set({ episodeId: targetEpisodeId, updatedAt: now })
    .where(eq(animeEpisodeExternalIds.episodeId, source.id))
    .run()

  db.update(animeSessions)
    .set({ episodeId: targetEpisodeId, updatedAt: now })
    .where(eq(animeSessions.episodeId, source.id))
    .run()

  db.delete(animeEpisodes).where(eq(animeEpisodes.id, source.id)).run()
}

function mergeAnimeSessions(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = (db as DbQueryContext)
    .select({ id: animeSessions.id })
    .from(animeSessions)
    .where(eq(animeSessions.animeId, sourceId))
    .all()
  if (rows.length === 0) return 0

  db.update(animeSessions)
    .set({ animeId: targetId, updatedAt: now })
    .where(eq(animeSessions.animeId, sourceId))
    .run()
  return rows.length
}

function mergeAnimeExtras(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const sourceRows = db
    .select()
    .from(animeExtras)
    .where(eq(animeExtras.animeId, sourceId))
    .all()
    .sort((a, b) => a.orderInAnime - b.orderInAnime || toTime(a.createdAt) - toTime(b.createdAt))
  if (sourceRows.length === 0) return 0

  const targetOrders = (db as DbQueryContext)
    .select({ orderInAnime: animeExtras.orderInAnime })
    .from(animeExtras)
    .where(eq(animeExtras.animeId, targetId))
    .all()
  let nextOrder = nextOrderAfter(targetOrders.map((row) => row.orderInAnime))

  for (const row of sourceRows) {
    db.update(animeExtras)
      .set({ animeId: targetId, orderInAnime: nextOrder++, updatedAt: now })
      .where(eq(animeExtras.id, row.id))
      .run()
  }
  return sourceRows.length
}

function mergeAnimeNotes(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = db
    .select()
    .from(animeNotes)
    .where(inArray(animeNotes.animeId, [targetId, sourceId]))
    .all()

  const targetRows = rows.filter((row) => row.animeId === targetId)
  const sourceRows = rows
    .filter((row) => row.animeId === sourceId)
    .sort((a, b) => a.orderInAnime - b.orderInAnime || toTime(a.createdAt) - toTime(b.createdAt))
  if (sourceRows.length === 0) return 0

  const usedNames = new Set(targetRows.map((row) => row.name))
  let nextOrder = targetRows.reduce((max, row) => Math.max(max, row.orderInAnime), -1) + 1

  for (const note of sourceRows) {
    const name = createMergedNoteName(note.name, usedNames)
    usedNames.add(name)

    db.update(animeNotes)
      .set({
        animeId: targetId,
        name,
        orderInAnime: nextOrder++,
        updatedAt: now
      })
      .where(eq(animeNotes.id, note.id))
      .run()
  }

  return sourceRows.length
}

/**
 * Merging two entries of the same comic must preserve the source's read data.
 * Source units align to target units by shared external id first, then by
 * number at the same grain (chapter number for chapter rows, volume number for
 * volume rows); aligned units fold their read state, files, identities, and
 * sessions into the target row, unmatched units move to the target entry
 * wholesale (keeping their id, so unit attachments stay valid).
 */
function mergeComicOwnedData(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const targetChapters = readComicChapters(db, targetId)
  const sourceChapters = readComicChapters(db, sourceId)
  let changed = 0

  const alignment = buildChapterAlignmentIndex(db, targetChapters, sourceChapters)
  let nextChapterOrder = nextOrderAfter(targetChapters.map((chapter) => chapter.orderInComic))
  const takenNumberKeys = collectNumberKeys(targetChapters, comicChapterNumberKey)

  for (const chapter of sourceChapters) {
    const alignedId = alignment.get(chapter.id)
    if (alignedId) {
      foldChapterIntoTarget(db, chapter, alignedId, now)
    } else {
      // A target row aligned by external id can already hold this number, and
      // numbering is unique per entry. The moved row gives up its numbers
      // rather than failing the merge; its name, files, and read state cross
      // over untouched and the user can renumber it.
      const numberKey = comicChapterNumberKey(chapter)
      const taken = numberKey !== null && takenNumberKeys.has(numberKey)
      if (numberKey !== null && !taken) takenNumberKeys.add(numberKey)

      db.update(comicChapters)
        .set({
          comicId: targetId,
          orderInComic: nextChapterOrder++,
          updatedAt: now,
          ...(taken ? { volumeNumber: null, chapterNumber: null } : {})
        })
        .where(eq(comicChapters.id, chapter.id))
        .run()
    }
    changed++
  }

  changed += mergeComicSessions(db, targetId, sourceId, now)
  changed += mergeComicNotes(db, targetId, sourceId, now)
  return changed
}

function readComicChapters(db: DbContext, comicId: string): ComicChapter[] {
  return db.select().from(comicChapters).where(eq(comicChapters.comicId, comicId)).all()
}

/** Identity key of a stored unit; null for unnumbered rows, which never collide. */
function comicChapterNumberKey(chapter: ComicChapter): string | null {
  return isNumberedComicUnit(chapter) ? comicUnitIdentityKey(chapter) : null
}

/** Numbers already spoken for on the target side of a merge. */
function collectNumberKeys<T>(rows: readonly T[], keyOf: (row: T) => string | null): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    const key = keyOf(row)
    if (key !== null) keys.add(key)
  }
  return keys
}

/** Maps each source chapter id to the target chapter id it aligns with. */
function buildChapterAlignmentIndex(
  db: DbContext,
  targetChapters: ComicChapter[],
  sourceChapters: ComicChapter[]
): Map<string, string> {
  const byExternalId = new Map<string, string>()
  const byNumber = new Map<string, string>()
  for (const chapter of targetChapters) {
    const numberKey = comicChapterNumberKey(chapter)
    if (numberKey) byNumber.set(numberKey, chapter.id)
  }
  for (const row of readChapterExternalIds(db, targetChapters)) {
    byExternalId.set(`${row.source}\0${row.externalId}`, row.chapterId)
  }

  const sourceExternalIds = new Map<string, { source: string; externalId: string }[]>()
  for (const row of readChapterExternalIds(db, sourceChapters)) {
    const list = sourceExternalIds.get(row.chapterId) ?? []
    list.push(row)
    sourceExternalIds.set(row.chapterId, list)
  }

  const alignment = new Map<string, string>()
  const claimed = new Set<string>()
  for (const chapter of sourceChapters) {
    const identityMatch = (sourceExternalIds.get(chapter.id) ?? [])
      .map((row) => byExternalId.get(`${row.source}\0${row.externalId}`))
      .find((id) => id && !claimed.has(id))
    const numberKey = comicChapterNumberKey(chapter)
    const numberMatch = numberKey === null ? undefined : byNumber.get(numberKey)
    const alignedId =
      identityMatch ?? (numberMatch && !claimed.has(numberMatch) ? numberMatch : undefined)
    if (alignedId) {
      alignment.set(chapter.id, alignedId)
      claimed.add(alignedId)
    }
  }
  return alignment
}

function readChapterExternalIds(
  db: DbContext,
  chapters: ComicChapter[]
): { chapterId: string; source: string; externalId: string }[] {
  if (chapters.length === 0) return []
  return (db as DbQueryContext)
    .select({
      chapterId: comicChapterExternalIds.chapterId,
      source: comicChapterExternalIds.source,
      externalId: comicChapterExternalIds.externalId
    })
    .from(comicChapterExternalIds)
    .where(
      inArray(
        comicChapterExternalIds.chapterId,
        chapters.map((chapter) => chapter.id)
      )
    )
    .all()
}

/**
 * Folds a source chapter into its aligned target chapter: read state merges
 * field-wise, while files, external ids, and sessions repoint to the target
 * row before the now-empty source row is removed. The target chapter's own
 * cover stays; the source's cover would dangle once its attachment row dies.
 */
function foldChapterIntoTarget(
  db: DbContext,
  source: ComicChapter,
  targetChapterId: string,
  now: Date
): void {
  const target = db.select().from(comicChapters).where(eq(comicChapters.id, targetChapterId)).get()
  if (!target) return

  db.update(comicChapters)
    .set({
      read: target.read || source.read,
      readAt: target.readAt ?? source.readAt,
      readCount: target.readCount + source.readCount,
      resumePage: target.resumePage ?? source.resumePage,
      updatedAt: now
    })
    .where(eq(comicChapters.id, targetChapterId))
    .run()

  const targetHasFiles =
    (db as DbQueryContext)
      .select({ id: comicChapterFiles.id })
      .from(comicChapterFiles)
      .where(eq(comicChapterFiles.chapterId, targetChapterId))
      .all().length > 0
  db.update(comicChapterFiles)
    .set({
      chapterId: targetChapterId,
      // The target's existing primary keeps priority over incoming files.
      ...(targetHasFiles && { isPrimary: false }),
      updatedAt: now
    })
    .where(eq(comicChapterFiles.chapterId, source.id))
    .run()

  db.update(comicChapterExternalIds)
    .set({ chapterId: targetChapterId, updatedAt: now })
    .where(eq(comicChapterExternalIds.chapterId, source.id))
    .run()

  db.update(comicSessions)
    .set({ chapterId: targetChapterId, updatedAt: now })
    .where(eq(comicSessions.chapterId, source.id))
    .run()

  db.delete(comicChapters).where(eq(comicChapters.id, source.id)).run()
}

function mergeComicSessions(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = (db as DbQueryContext)
    .select({ id: comicSessions.id })
    .from(comicSessions)
    .where(eq(comicSessions.comicId, sourceId))
    .all()
  if (rows.length === 0) return 0

  db.update(comicSessions)
    .set({ comicId: targetId, updatedAt: now })
    .where(eq(comicSessions.comicId, sourceId))
    .run()
  return rows.length
}

function mergeComicNotes(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = db
    .select()
    .from(comicNotes)
    .where(inArray(comicNotes.comicId, [targetId, sourceId]))
    .all()

  const targetRows = rows.filter((row) => row.comicId === targetId)
  const sourceRows = rows
    .filter((row) => row.comicId === sourceId)
    .sort((a, b) => a.orderInComic - b.orderInComic || toTime(a.createdAt) - toTime(b.createdAt))
  if (sourceRows.length === 0) return 0

  const usedNames = new Set(targetRows.map((row) => row.name))
  let nextOrder = targetRows.reduce((max, row) => Math.max(max, row.orderInComic), -1) + 1

  for (const note of sourceRows) {
    const name = createMergedNoteName(note.name, usedNames)
    usedNames.add(name)

    db.update(comicNotes)
      .set({
        comicId: targetId,
        name,
        orderInComic: nextOrder++,
        updatedAt: now
      })
      .where(eq(comicNotes.id, note.id))
      .run()
  }

  return sourceRows.length
}

/**
 * Merging two entries of the same novel must preserve the source's read data.
 * Source volumes align to target volumes by shared external id first, then by
 * volume number; aligned volumes fold their read state, files, identities, and
 * sessions into the target row, unmatched volumes move to the target entry
 * wholesale (keeping their id, so volume attachments stay valid).
 */
function mergeNovelOwnedData(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const targetVolumes = readNovelVolumes(db, targetId)
  const sourceVolumes = readNovelVolumes(db, sourceId)
  let changed = 0

  const alignment = buildVolumeAlignmentIndex(db, targetVolumes, sourceVolumes)
  let nextVolumeOrder = nextOrderAfter(targetVolumes.map((volume) => volume.orderInNovel))
  const takenNumberKeys = collectNumberKeys(targetVolumes, novelVolumeNumberKey)

  for (const volume of sourceVolumes) {
    const alignedId = alignment.get(volume.id)
    if (alignedId) {
      foldVolumeIntoTarget(db, volume, alignedId, now)
    } else {
      // See the comic merge: numbering is unique per entry, so a moved volume
      // whose number the target already holds gives the number up instead of
      // failing the merge.
      const numberKey = novelVolumeNumberKey(volume)
      const taken = numberKey !== null && takenNumberKeys.has(numberKey)
      if (numberKey !== null && !taken) takenNumberKeys.add(numberKey)

      db.update(novelVolumes)
        .set({
          novelId: targetId,
          orderInNovel: nextVolumeOrder++,
          updatedAt: now,
          ...(taken ? { volumeNumber: null } : {})
        })
        .where(eq(novelVolumes.id, volume.id))
        .run()
    }
    changed++
  }

  changed += mergeNovelSessions(db, targetId, sourceId, now)
  changed += mergeNovelNotes(db, targetId, sourceId, now)
  return changed
}

function readNovelVolumes(db: DbContext, novelId: string): NovelVolume[] {
  return db.select().from(novelVolumes).where(eq(novelVolumes.novelId, novelId)).all()
}

function novelVolumeNumberKey(volume: NovelVolume): string | null {
  return isNumberedNovelVolume(volume) ? novelUnitIdentityKey(volume) : null
}

/** Maps each source volume id to the target volume id it aligns with. */
function buildVolumeAlignmentIndex(
  db: DbContext,
  targetVolumes: NovelVolume[],
  sourceVolumes: NovelVolume[]
): Map<string, string> {
  const byExternalId = new Map<string, string>()
  const byNumber = new Map<number, string>()
  for (const volume of targetVolumes) {
    if (volume.volumeNumber !== null) {
      byNumber.set(volume.volumeNumber, volume.id)
    }
  }
  for (const row of readVolumeExternalIds(db, targetVolumes)) {
    byExternalId.set(`${row.source}\0${row.externalId}`, row.volumeId)
  }

  const sourceExternalIds = new Map<string, { source: string; externalId: string }[]>()
  for (const row of readVolumeExternalIds(db, sourceVolumes)) {
    const list = sourceExternalIds.get(row.volumeId) ?? []
    list.push(row)
    sourceExternalIds.set(row.volumeId, list)
  }

  const alignment = new Map<string, string>()
  const claimed = new Set<string>()
  for (const volume of sourceVolumes) {
    const identityMatch = (sourceExternalIds.get(volume.id) ?? [])
      .map((row) => byExternalId.get(`${row.source}\0${row.externalId}`))
      .find((id) => id && !claimed.has(id))
    const numberMatch = volume.volumeNumber === null ? undefined : byNumber.get(volume.volumeNumber)
    const alignedId =
      identityMatch ?? (numberMatch && !claimed.has(numberMatch) ? numberMatch : undefined)
    if (alignedId) {
      alignment.set(volume.id, alignedId)
      claimed.add(alignedId)
    }
  }
  return alignment
}

function readVolumeExternalIds(
  db: DbContext,
  volumes: NovelVolume[]
): { volumeId: string; source: string; externalId: string }[] {
  if (volumes.length === 0) return []
  return (db as DbQueryContext)
    .select({
      volumeId: novelVolumeExternalIds.volumeId,
      source: novelVolumeExternalIds.source,
      externalId: novelVolumeExternalIds.externalId
    })
    .from(novelVolumeExternalIds)
    .where(
      inArray(
        novelVolumeExternalIds.volumeId,
        volumes.map((volume) => volume.id)
      )
    )
    .all()
}

/**
 * Folds a source volume into its aligned target volume: read state merges
 * field-wise, while files, external ids, and sessions repoint to the target
 * row before the now-empty source row is removed. The target volume's own
 * cover stays; the source's cover would dangle once its attachment row dies.
 */
function foldVolumeIntoTarget(
  db: DbContext,
  source: NovelVolume,
  targetVolumeId: string,
  now: Date
): void {
  const target = db.select().from(novelVolumes).where(eq(novelVolumes.id, targetVolumeId)).get()
  if (!target) return

  db.update(novelVolumes)
    .set({
      read: target.read || source.read,
      readAt: target.readAt ?? source.readAt,
      readCount: target.readCount + source.readCount,
      resumeLocator: target.resumeLocator ?? source.resumeLocator,
      resumeProgress: target.resumeProgress ?? source.resumeProgress,
      updatedAt: now
    })
    .where(eq(novelVolumes.id, targetVolumeId))
    .run()

  const targetHasFiles =
    (db as DbQueryContext)
      .select({ id: novelVolumeFiles.id })
      .from(novelVolumeFiles)
      .where(eq(novelVolumeFiles.volumeId, targetVolumeId))
      .all().length > 0
  db.update(novelVolumeFiles)
    .set({
      volumeId: targetVolumeId,
      // The target's existing primary keeps priority over incoming files.
      ...(targetHasFiles && { isPrimary: false }),
      updatedAt: now
    })
    .where(eq(novelVolumeFiles.volumeId, source.id))
    .run()

  db.update(novelVolumeExternalIds)
    .set({ volumeId: targetVolumeId, updatedAt: now })
    .where(eq(novelVolumeExternalIds.volumeId, source.id))
    .run()

  db.update(novelSessions)
    .set({ volumeId: targetVolumeId, updatedAt: now })
    .where(eq(novelSessions.volumeId, source.id))
    .run()

  db.delete(novelVolumes).where(eq(novelVolumes.id, source.id)).run()
}

function mergeNovelSessions(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = (db as DbQueryContext)
    .select({ id: novelSessions.id })
    .from(novelSessions)
    .where(eq(novelSessions.novelId, sourceId))
    .all()
  if (rows.length === 0) return 0

  db.update(novelSessions)
    .set({ novelId: targetId, updatedAt: now })
    .where(eq(novelSessions.novelId, sourceId))
    .run()
  return rows.length
}

function mergeNovelNotes(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = db
    .select()
    .from(novelNotes)
    .where(inArray(novelNotes.novelId, [targetId, sourceId]))
    .all()

  const targetRows = rows.filter((row) => row.novelId === targetId)
  const sourceRows = rows
    .filter((row) => row.novelId === sourceId)
    .sort((a, b) => a.orderInNovel - b.orderInNovel || toTime(a.createdAt) - toTime(b.createdAt))
  if (sourceRows.length === 0) return 0

  const usedNames = new Set(targetRows.map((row) => row.name))
  let nextOrder = targetRows.reduce((max, row) => Math.max(max, row.orderInNovel), -1) + 1

  for (const note of sourceRows) {
    const name = createMergedNoteName(note.name, usedNames)
    usedNames.add(name)

    db.update(novelNotes)
      .set({
        novelId: targetId,
        name,
        orderInNovel: nextOrder++,
        updatedAt: now
      })
      .where(eq(novelNotes.id, note.id))
      .run()
  }

  return sourceRows.length
}

/**
 * Media relations reference entries on both polymorphic ends, so both are
 * remapped in one pass when the type matches; edges that collapse into
 * self-references disappear and duplicates keep the earliest row. Only the
 * target's own outgoing rows are renumbered — third entries' edge lists were
 * only partially loaded and must keep their ordering.
 */
function mergeMediaRelations(
  db: DbContext,
  mediaType: MediaType,
  targetId: string,
  sourceId: string,
  now: Date
): number {
  const rows = db
    .select()
    .from(mediaRelations)
    .where(
      or(
        and(
          eq(mediaRelations.fromType, mediaType),
          inArray(mediaRelations.fromId, [targetId, sourceId])
        ),
        and(
          eq(mediaRelations.toType, mediaType),
          inArray(mediaRelations.toId, [targetId, sourceId])
        )
      )
    )
    .all()
  const isSourceEnd = (row: (typeof rows)[number]): boolean =>
    (row.fromType === mediaType && row.fromId === sourceId) ||
    (row.toType === mediaType && row.toId === sourceId)
  const sourceCount = rows.filter(isSourceEnd).length
  if (sourceCount === 0) return 0

  const survivors = new Map<string, (typeof rows)[number]>()
  for (const row of [...rows].sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))) {
    const remapped = {
      ...row,
      fromId: row.fromType === mediaType && row.fromId === sourceId ? targetId : row.fromId,
      toId: row.toType === mediaType && row.toId === sourceId ? targetId : row.toId,
      updatedAt: now
    }
    if (remapped.fromType === remapped.toType && remapped.fromId === remapped.toId) continue

    const key = `${remapped.fromType}\0${remapped.fromId}\0${remapped.toType}\0${remapped.toId}\0${remapped.type}`
    const existing = survivors.get(key)
    if (!existing) {
      survivors.set(key, remapped)
    } else if (!hasText(existing.note) && hasText(remapped.note)) {
      existing.note = remapped.note
    }
  }

  const finalRows = [...survivors.values()]
  finalRows
    .filter((row) => row.fromType === mediaType && row.fromId === targetId)
    .sort((a, b) => a.orderInFrom - b.orderInFrom || toTime(a.createdAt) - toTime(b.createdAt))
    .forEach((row, index) => {
      row.orderInFrom = index
    })

  db.delete(mediaRelations)
    .where(
      inArray(
        mediaRelations.id,
        rows.map((row) => row.id)
      )
    )
    .run()
  if (finalRows.length > 0) {
    db.insert(mediaRelations).values(finalRows).run()
  }
  return sourceCount
}

/**
 * Company relations are the same directed shape as media relations, with real
 * foreign keys instead of polymorphic ends, so both ends are remapped in one
 * pass for the same reason: an edge between the two merged companies collapses
 * onto itself and must vanish. Only the target's own outgoing rows are
 * renumbered — third companies' edge lists were only partially loaded and must
 * keep their ordering.
 */
function mergeCompanyRelations(
  db: DbContext,
  targetId: string,
  sourceId: string,
  now: Date
): number {
  const rows = db
    .select()
    .from(companyRelations)
    .where(
      or(
        inArray(companyRelations.fromId, [targetId, sourceId]),
        inArray(companyRelations.toId, [targetId, sourceId])
      )
    )
    .all()
  const sourceCount = rows.filter((row) => row.fromId === sourceId || row.toId === sourceId).length
  if (sourceCount === 0) return 0

  const survivors = new Map<string, (typeof rows)[number]>()
  for (const row of [...rows].sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))) {
    const remapped = {
      ...row,
      fromId: row.fromId === sourceId ? targetId : row.fromId,
      toId: row.toId === sourceId ? targetId : row.toId,
      updatedAt: now
    }
    if (remapped.fromId === remapped.toId) continue

    const key = `${remapped.fromId}\0${remapped.toId}\0${remapped.type}`
    const existing = survivors.get(key)
    if (!existing) {
      survivors.set(key, remapped)
    } else if (!hasText(existing.note) && hasText(remapped.note)) {
      existing.note = remapped.note
    }
  }

  const finalRows = [...survivors.values()]
  finalRows
    .filter((row) => row.fromId === targetId)
    .sort((a, b) => a.orderInFrom - b.orderInFrom || toTime(a.createdAt) - toTime(b.createdAt))
    .forEach((row, index) => {
      row.orderInFrom = index
    })

  db.delete(companyRelations)
    .where(
      inArray(
        companyRelations.id,
        rows.map((row) => row.id)
      )
    )
    .run()
  if (finalRows.length > 0) {
    db.insert(companyRelations).values(finalRows).run()
  }
  return sourceCount
}

function nextOrderAfter(orders: number[]): number {
  return orders.reduce((max, order) => Math.max(max, order), -1) + 1
}

export function mergeRelationRows(
  db: DbContext,
  config: RelationMergeConfig,
  targetId: string,
  sourceId: string,
  now: Date
): number {
  const rows = (db as DbQueryContext)
    .select()
    .from(config.table)
    .where(inArray(config.mergeColumn, [targetId, sourceId]))
    .all() as MergeRow[]

  const sourceCount = rows.filter((row) => row[config.mergeField] === sourceId).length
  if (sourceCount === 0) return 0

  const targetRows = rows
    .filter((row) => row[config.mergeField] === targetId)
    .sort((a, b) => compareRelationRows(a, b, config.orderField))
  const sourceRows = rows
    .filter((row) => row[config.mergeField] === sourceId)
    .sort((a, b) => compareRelationRows(a, b, config.orderField))

  const byKey = new Map<string, MergeRow>()
  for (const row of [...targetRows, ...sourceRows]) {
    const normalized = {
      ...row,
      [config.mergeField]: targetId,
      updatedAt: now
    }
    const key = buildRelationKey(normalized, config.uniqueKeyFields)
    const current = byKey.get(key)
    if (!current) {
      byKey.set(key, normalized)
      continue
    }

    mergeDuplicateRelation(current, normalized, config, now)
  }

  const finalRows = [...byKey.values()]
  if (config.orderField) {
    finalRows.forEach((row, index) => {
      row[config.orderField!] = index
    })
  }

  ;(db as DbWriteContext)
    .delete(config.table)
    .where(inArray(config.mergeColumn, [targetId, sourceId]))
    .run()
  if (finalRows.length > 0) {
    ;(db as DbWriteContext).insert(config.table).values(finalRows).run()
  }

  return sourceCount
}

function mergeGameSessions(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = (db as DbQueryContext)
    .select({ id: gameSessions.id })
    .from(gameSessions)
    .where(eq(gameSessions.gameId, sourceId))
    .all()
  if (rows.length === 0) return 0

  db.update(gameSessions)
    .set({ gameId: targetId, updatedAt: now })
    .where(eq(gameSessions.gameId, sourceId))
    .run()
  return rows.length
}

function mergeGameNotes(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = db
    .select()
    .from(gameNotes)
    .where(inArray(gameNotes.gameId, [targetId, sourceId]))
    .all()

  const targetRows = rows.filter((row) => row.gameId === targetId)
  const sourceRows = rows
    .filter((row) => row.gameId === sourceId)
    .sort((a, b) => a.orderInGame - b.orderInGame || toTime(a.createdAt) - toTime(b.createdAt))
  if (sourceRows.length === 0) return 0

  const usedNames = new Set(targetRows.map((row) => row.name))
  let nextOrder = targetRows.reduce((max, row) => Math.max(max, row.orderInGame), -1) + 1

  for (const note of sourceRows) {
    const name = createMergedNoteName(note.name, usedNames)
    usedNames.add(name)

    db.update(gameNotes)
      .set({
        gameId: targetId,
        name,
        orderInGame: nextOrder++,
        updatedAt: now
      })
      .where(eq(gameNotes.id, note.id))
      .run()
  }

  return sourceRows.length
}

function mergeDuplicateRelation(
  target: MergeRow,
  source: MergeRow,
  config: RelationMergeConfig,
  now: Date
): void {
  if (config.spoilerField) {
    target[config.spoilerField] = Boolean(
      target[config.spoilerField] || source[config.spoilerField]
    )
  }
  if (config.noteField && !hasText(target[config.noteField]) && hasText(source[config.noteField])) {
    target[config.noteField] = source[config.noteField]
  }
  target.updatedAt = now
}

function buildRelationKey(row: MergeRow, fields: string[]): string {
  return fields.map((field) => String(row[field] ?? '')).join('\0')
}

function compareRelationRows(a: MergeRow, b: MergeRow, orderField?: string): number {
  if (orderField) {
    const orderA = typeof a[orderField] === 'number' ? a[orderField] : 0
    const orderB = typeof b[orderField] === 'number' ? b[orderField] : 0
    if (orderA !== orderB) return orderA - orderB
  }

  return toTime(a.createdAt) - toTime(b.createdAt)
}

function toTime(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return 0
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function createMergedNoteName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) return name

  const first = `${name} (merged)`
  if (!usedNames.has(first)) return first

  let index = 2
  while (usedNames.has(`${name} (merged ${index})`)) {
    index++
  }
  return `${name} (merged ${index})`
}
