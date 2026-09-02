import {
  kisaki,
  type Disposable,
  type ExternalId,
  type HooksRegistrar,
  type LibraryComic,
  type LibraryMediaStatus,
  type LibraryNovel,
  type ScraperEntityType,
  type ScraperProfileSummary
} from '@kisaki3/extension-sdk'
import { m } from '../../i18n'
import { readBangumiSubjectIdFromExternalIds } from '../../identity/subject-ref'
import { BangumiExtensionError } from '../../utils/errors'
import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../../../shared/scopes'
import { parseBangumiSubjectDate } from '../format/dates'
import {
  resolveBangumiBookKind,
  resolveBangumiComicFormat,
  resolveBangumiNovelFormat
} from '../format/formats'
import { readChangeReasons } from '../local/adapter'
import {
  createStaticCollectionByName,
  ensureTag,
  listStaticCollections,
  resolveStaticCollectionById,
  resolveStaticCollectionByTitle
} from '../local/library'
import type {
  BangumiMediaDescriptor,
  LocalCollectionSummary,
  LocalCollectionTarget,
  LocalMediaAdapter,
  LocalMediaAddFromScraperInput,
  LocalMediaAddResult,
  LocalMediaChangeListener,
  LocalMediaItem,
  LocalMediaListQuery,
  LocalMediaUserPatch,
  LocalUnitCapacity,
  LocalUnitProgress
} from '../types'

type BookTarget = 'comic' | 'novel'

interface BookEntity {
  id: string
  name: string
  status: LibraryMediaStatus
  score?: number | null | undefined
  externalIds: readonly ExternalId[]
}

/**
 * One local library the book scope routes into: the comic library or the
 * novel library. Both halves expose the same sync-facing surface, so the
 * composite adapter only decides which half owns an id or a new entry.
 */
interface BookHalf {
  readonly target: BookTarget
  readonly entityType: 'comic' | 'novel'
  readonly tagLinkKind: 'comic-tag' | 'novel-tag'
  readonly collectionLinkKind: 'collection-comic' | 'collection-novel'
  listAll(includeNsfw: boolean): Promise<readonly BookEntity[]>
  get(localId: string): Promise<BookEntity | null>
  update(
    localId: string,
    patch: { status?: LibraryMediaStatus; score?: number | null }
  ): Promise<void>
  readUnitProgress(localId: string): Promise<LocalUnitProgress>
  readUnitCapacity(localId: string): Promise<LocalUnitCapacity>
  applyUnitProgress(localId: string, progress: LocalUnitProgress): Promise<void>
  createTagLink(localId: string, tagId: string): Promise<void>
  createCollectionLink(collectionId: string, localId: string): Promise<void>
}

const comicHalf: BookHalf = {
  target: 'comic',
  entityType: 'comic',
  tagLinkKind: 'comic-tag',
  collectionLinkKind: 'collection-comic',
  async listAll(includeNsfw) {
    return toBookEntities(await kisaki.library.comics.list({ includeNsfw }))
  },
  async get(localId) {
    const comic = await kisaki.library.comics.get(localId)
    return comic ? toBookEntity(comic) : null
  },
  async update(localId, patch) {
    await kisaki.library.comics.update(localId, patch)
  },
  async readUnitProgress(localId) {
    const chapters = await kisaki.library.comics.chapters.list({ comicId: localId })
    let readChapters = 0
    let readVolumes = 0
    for (const chapter of chapters) {
      if (!chapter.read) continue
      // Chapter-grain rows carry a chapter number; the rest are volume-grain.
      if (chapter.chapterNumber != null) readChapters += 1
      else readVolumes += 1
    }
    return { volumes: readVolumes, chapters: readChapters }
  },
  async readUnitCapacity(localId) {
    const chapters = await kisaki.library.comics.chapters.list({ comicId: localId })
    const chapterGrain = chapters.filter((chapter) => chapter.chapterNumber != null).length
    return { volumes: chapters.length - chapterGrain, chapters: chapterGrain }
  },
  async applyUnitProgress(localId, progress) {
    const chapters = await kisaki.library.comics.chapters.list({ comicId: localId })
    const chapterGrain = chapters.filter((chapter) => chapter.chapterNumber != null)
    const volumeGrain = chapters.filter((chapter) => chapter.chapterNumber == null)

    for (const unit of unitsToMark(chapterGrain, progress.chapters)) {
      await kisaki.library.comics.chapters.patchReadState(unit.id, { read: true })
    }
    for (const unit of unitsToMark(volumeGrain, progress.volumes)) {
      await kisaki.library.comics.chapters.patchReadState(unit.id, { read: true })
    }
  },
  async createTagLink(localId, tagId) {
    await kisaki.library.links.create({
      kind: 'comic-tag',
      from: { entityType: 'comic', id: localId },
      to: { entityType: 'tag', id: tagId },
      metadata: { order: 0 }
    })
  },
  async createCollectionLink(collectionId, localId) {
    await kisaki.library.links.create({
      kind: 'collection-comic',
      from: { entityType: 'collection', id: collectionId },
      to: { entityType: 'comic', id: localId },
      metadata: { order: 0 }
    })
  }
}

const novelHalf: BookHalf = {
  target: 'novel',
  entityType: 'novel',
  tagLinkKind: 'novel-tag',
  collectionLinkKind: 'collection-novel',
  async listAll(includeNsfw) {
    return toBookEntities(await kisaki.library.novels.list({ includeNsfw }))
  },
  async get(localId) {
    const novel = await kisaki.library.novels.get(localId)
    return novel ? toBookEntity(novel) : null
  },
  async update(localId, patch) {
    await kisaki.library.novels.update(localId, patch)
  },
  async readUnitProgress(localId) {
    const volumes = await kisaki.library.novels.volumes.list({ novelId: localId })
    return { volumes: volumes.filter((volume) => volume.read).length }
  },
  async readUnitCapacity(localId) {
    const volumes = await kisaki.library.novels.volumes.list({ novelId: localId })
    return { volumes: volumes.length, chapters: 0 }
  },
  async applyUnitProgress(localId, progress) {
    const volumes = await kisaki.library.novels.volumes.list({ novelId: localId })
    for (const unit of unitsToMark(volumes, progress.volumes)) {
      await kisaki.library.novels.volumes.patchReadState(unit.id, { read: true })
    }
  },
  async createTagLink(localId, tagId) {
    await kisaki.library.links.create({
      kind: 'novel-tag',
      from: { entityType: 'novel', id: localId },
      to: { entityType: 'tag', id: tagId },
      metadata: { order: 0 }
    })
  },
  async createCollectionLink(collectionId, localId) {
    await kisaki.library.links.create({
      kind: 'collection-novel',
      from: { entityType: 'collection', id: collectionId },
      to: { entityType: 'novel', id: localId },
      metadata: { order: 0 }
    })
  }
}

export interface BookLocalMediaAdapterDependencies {
  hooks: HooksRegistrar
  /** This extension's own change-feed actor id, for self-echo skipping. */
  selfActor: string
  /**
   * Resolves the platform label of a book subject for entries whose import
   * surface stated no facts (index rows list only ids and names).
   */
  resolveSubjectPlatform(subjectId: string): Promise<string | undefined>
}

/**
 * Local adapter for the Bangumi book scope.
 *
 * Bangumi folds comics and novels into one subject type while the library
 * keeps two media types, so this adapter is a router over two halves: the
 * platform label decides where a new entry lands, and existing ids resolve to
 * whichever library owns them. Unit progress (`vol_status` / `ep_status`)
 * rides the collection payload instead of per-episode sync.
 */
export class BookLocalMediaAdapter implements LocalMediaAdapter {
  readonly scope = 'book' as const
  readonly supportsScraperProfile = true
  readonly supportsAutoSync = true
  readonly supportsImportWrite = true
  readonly supportsUnitProgress = true

  private readonly halves = [comicHalf, novelHalf] as const

  constructor(private readonly deps: BookLocalMediaAdapterDependencies) {}

  async listProfiles(): Promise<readonly ScraperProfileSummary[]> {
    const [comicProfiles, novelProfiles] = await Promise.all([
      kisaki.scrapers.profiles.list({ entityType: 'comic' }),
      kisaki.scrapers.profiles.list({ entityType: 'novel' })
    ])
    return [...comicProfiles, ...novelProfiles]
  }

  async subscribeLocalChanges(listener: LocalMediaChangeListener): Promise<Disposable> {
    return this.deps.hooks.on('library.changed', ({ changes }) => {
      for (const change of changes) {
        if (change.entity !== 'comic' && change.entity !== 'novel') {
          continue
        }

        // Writes this extension caused come back attributed; reacting to them
        // would only echo our own import or push.
        if (change.actors.every((actor) => actor === this.deps.selfActor)) {
          continue
        }

        for (const reason of readChangeReasons(change)) {
          void Promise.resolve(listener({ scope: 'book', localId: change.id, reason }))
        }
      }
    })
  }

  /**
   * Lists both halves in one virtual sequence, comics first.
   *
   * Both libraries are fetched whole and sliced because offsets over a merged
   * sequence cannot be split into two per-half offsets without knowing the
   * comic total; at library scale the full fetch is two cheap local reads.
   */
  async listLocalItems(query: LocalMediaListQuery): Promise<readonly LocalMediaItem[]> {
    const includeNsfw = query.includeNsfw ?? true
    const [comics, novels] = await Promise.all([
      comicHalf.listAll(includeNsfw),
      novelHalf.listAll(includeNsfw)
    ])

    const merged: Array<{ half: BookHalf; entity: BookEntity }> = [
      ...comics.map((entity) => ({ half: comicHalf, entity })),
      ...novels.map((entity) => ({ half: novelHalf, entity }))
    ]
    const offset = query.offset ?? 0
    const end = query.limit === undefined ? merged.length : offset + query.limit
    const page = merged.slice(offset, end)

    return Promise.all(page.map(({ half, entity }) => this.toItem(half, entity)))
  }

  async getLocalItem(localId: string): Promise<LocalMediaItem | null> {
    const owned = await this.resolveHalf(localId)
    return owned ? this.toItem(owned.half, owned.entity) : null
  }

  async findBySubjectIds(
    subjectIds: readonly string[]
  ): Promise<ReadonlyMap<string, LocalMediaItem>> {
    const wanted = new Set(subjectIds.map((id) => id.trim()).filter(Boolean))
    const output = new Map<string, LocalMediaItem>()
    if (wanted.size === 0) {
      return output
    }

    for (const half of this.halves) {
      const entities = await half.listAll(true)
      for (const entity of entities) {
        const subjectId = readBangumiSubjectIdFromExternalIds(entity)
        if (subjectId && wanted.has(subjectId) && !output.has(subjectId)) {
          output.set(subjectId, await this.toItem(half, entity))
        }
      }
    }

    return output
  }

  async addFromScraper(input: LocalMediaAddFromScraperInput): Promise<LocalMediaAddResult> {
    const target = await this.resolveTarget(input)
    const profileId = await this.resolveProfileId(input.profileId, target)

    if (target === 'comic') {
      const result = await kisaki.ingest.comic.add.fromScraper(profileId, {
        name: input.name,
        knownIds: [...input.knownIds],
        releaseDate: parseBangumiSubjectDate(input.facts?.date),
        // An import row states only the platform label, which places the
        // entry in a library but says little about its format; the scrape
        // that follows reads the full subject and settles it.
        format: resolveBangumiComicFormat({ platform: input.facts?.platform })
      })
      return { localId: result.comicId, isNew: result.isNew }
    }

    const result = await kisaki.ingest.novel.add.fromScraper(profileId, {
      name: input.name,
      knownIds: [...input.knownIds],
      releaseDate: parseBangumiSubjectDate(input.facts?.date),
      // Platform-only, as above.
      format: resolveBangumiNovelFormat({ platform: input.facts?.platform })
    })
    return { localId: result.novelId, isNew: result.isNew }
  }

  async patchUserFields(localId: string, patch: LocalMediaUserPatch): Promise<LocalMediaItem> {
    const owned = await this.requireHalf(localId)
    const entityPatch: { status?: LibraryMediaStatus; score?: number | null } = {}

    if (patch.status !== undefined) {
      entityPatch.status = patch.status
    }

    if (patch.score !== undefined) {
      entityPatch.score = patch.score
    }

    if (Object.keys(entityPatch).length > 0) {
      await owned.half.update(localId, entityPatch)
    }

    const item = await this.getLocalItem(localId)
    if (!item) {
      throw new BangumiExtensionError('library_update_failed', m().errors.localMediaMissing)
    }

    return item
  }

  async readUnitCapacity(localId: string): Promise<LocalUnitCapacity> {
    const owned = await this.requireHalf(localId)
    return owned.half.readUnitCapacity(localId)
  }

  async applyUnitProgress(localId: string, progress: LocalUnitProgress): Promise<void> {
    const owned = await this.requireHalf(localId)
    await owned.half.applyUnitProgress(localId, progress)
  }

  async listTagNames(localId: string): Promise<ReadonlySet<string>> {
    const owned = await this.requireHalf(localId)
    const links = await kisaki.library.links.list({
      entity: { entityType: owned.half.entityType, id: localId },
      kinds: [owned.half.tagLinkKind]
    })
    const tagIds = [...new Set(links.map((link) => link.to.id))]
    if (tagIds.length === 0) {
      return new Set()
    }

    const tags = await kisaki.library.tags.list({ ids: tagIds, includeNsfw: true })
    return new Set(tags.map((tag) => tag.name))
  }

  async ensureTag(localId: string, tagName: string): Promise<void> {
    const owned = await this.requireHalf(localId)
    const tag = await ensureTag(tagName)
    const links = await kisaki.library.links.list({
      entity: { entityType: owned.half.entityType, id: localId },
      relatedEntity: { entityType: 'tag', id: tag.id },
      kinds: [owned.half.tagLinkKind]
    })
    if (links.length > 0) {
      return
    }

    await owned.half.createTagLink(localId, tag.id)
  }

  async listCollections(): Promise<readonly LocalCollectionSummary[]> {
    return listStaticCollections()
  }

  async resolveExistingCollection(collectionId: string): Promise<LocalCollectionTarget> {
    return resolveStaticCollectionById(collectionId)
  }

  async resolveCollectionByTitle(title: string): Promise<LocalCollectionTarget> {
    return resolveStaticCollectionByTitle(title)
  }

  async hasCollectionMembership(localId: string, target: LocalCollectionTarget): Promise<boolean> {
    if (!target.id) {
      return false
    }

    const owned = await this.requireHalf(localId)
    const links = await kisaki.library.links.list({
      entity: { entityType: owned.half.entityType, id: localId },
      relatedEntity: { entityType: 'collection', id: target.id },
      kinds: [owned.half.collectionLinkKind]
    })
    return links.length > 0
  }

  async ensureInCollection(localId: string, target: LocalCollectionTarget): Promise<void> {
    let collectionId = target.id
    if (!collectionId) {
      const collection = await createStaticCollectionByName(target.name)
      target.id = collection.id
      target.name = collection.name
      target.willCreate = false
      collectionId = collection.id
    }

    if (await this.hasCollectionMembership(localId, { id: collectionId, name: target.name })) {
      return
    }

    const owned = await this.requireHalf(localId)
    await owned.half.createCollectionLink(collectionId, localId)
  }

  private async resolveHalf(
    localId: string
  ): Promise<{ half: BookHalf; entity: BookEntity } | null> {
    for (const half of this.halves) {
      const entity = await half.get(localId)
      if (entity) {
        return { half, entity }
      }
    }

    return null
  }

  private async requireHalf(localId: string): Promise<{ half: BookHalf; entity: BookEntity }> {
    const owned = await this.resolveHalf(localId)
    if (!owned) {
      throw new BangumiExtensionError('library_update_failed', m().errors.localMediaMissing)
    }

    return owned
  }

  private async toItem(half: BookHalf, entity: BookEntity): Promise<LocalMediaItem> {
    return {
      scope: 'book' as const,
      localId: entity.id,
      name: entity.name,
      status: entity.status,
      score: entity.score,
      externalIds: entity.externalIds.map((externalId) => ({
        source: externalId.source,
        id: externalId.id
      })),
      unitProgress: await half.readUnitProgress(entity.id)
    }
  }

  /**
   * Decides which library a new entry belongs to. The platform label wins;
   * entries without one on the search fact are resolved through one subject
   * read. A subject the label never places — an art book, or one Bangumi left
   * unlabelled — is refused rather than filed into a library by guess.
   */
  private async resolveTarget(input: LocalMediaAddFromScraperInput): Promise<BookTarget> {
    const fromFacts = resolveBangumiBookKind(input.facts?.platform)
    if (fromFacts) return fromFacts

    const subjectId = readBangumiSubjectIdFromExternalIds({ externalIds: input.knownIds })
    if (subjectId) {
      const fromSubject = resolveBangumiBookKind(await this.deps.resolveSubjectPlatform(subjectId))
      if (fromSubject) return fromSubject
    }

    throw new BangumiExtensionError('library_update_failed', m().errors.bookKindUnresolved)
  }

  /**
   * Book jobs carry one profile while entries route to two media types, so a
   * comic entry arriving with a novel profile (or the reverse) swaps to a
   * profile of the right media type, preferring the same search provider.
   */
  private async resolveProfileId(selectedId: string, target: BookTarget): Promise<string> {
    const entityType: ScraperEntityType = target
    const selected = await kisaki.scrapers.profiles.get(selectedId)
    if (selected?.entityType === entityType) {
      return selectedId
    }

    const candidates = await kisaki.scrapers.profiles.list({ entityType })
    const preferred =
      candidates.find(
        (candidate) => selected && candidate.searchProviderId === selected.searchProviderId
      ) ?? candidates[0]
    if (!preferred) {
      throw new BangumiExtensionError('profile_missing', m().errors.profileRequired)
    }

    return preferred.id
  }
}

export function createBookMediaDescriptor(adapter: LocalMediaAdapter): BangumiMediaDescriptor {
  return {
    scope: 'book',
    subjectType: BANGUMI_SUBJECT_TYPE_BY_SCOPE.book,
    localAdapter: adapter
  }
}

function toBookEntity(entity: LibraryComic | LibraryNovel): BookEntity {
  return {
    id: entity.id,
    name: entity.name,
    status: entity.status,
    score: entity.score,
    externalIds: entity.externalIds
  }
}

function toBookEntities(entities: readonly (LibraryComic | LibraryNovel)[]): BookEntity[] {
  return entities.map(toBookEntity)
}

/** First `count` units in reading order that are not read yet. */
function unitsToMark<T extends { id: string; read: boolean }>(
  units: readonly T[],
  count: number | undefined
): T[] {
  if (!count || count <= 0) {
    return []
  }

  return units.slice(0, count).filter((unit) => !unit.read)
}
