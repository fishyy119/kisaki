import {
  kisaki,
  type Disposable,
  type ExternalId,
  type HooksRegistrar,
  type LibraryEntityChangeSummary,
  type LibraryEntityType,
  type LibraryMediaStatus,
  type LibraryLinkKind,
  type ScraperMediaType,
  LIBRARY_MEDIA_STATUSES
} from '@kisaki3/extension-sdk'
import { m } from '../../i18n'
import { readBangumiSubjectIdFromExternalIds } from '../../identity/subject-ref'
import { BangumiExtensionError } from '../../utils/errors'
import { omitUndefined } from '../../utils/object'
import type { BangumiMediaScope } from '../../../shared/scopes'
import type {
  LocalCollectionSummary,
  LocalCollectionTarget,
  LocalMediaAdapter,
  LocalMediaAddFromScraperInput,
  LocalMediaAddResult,
  LocalMediaChangeListener,
  LocalMediaChangeReason,
  LocalMediaItem,
  LocalMediaListQuery,
  LocalMediaUserPatch
} from '../types'
import {
  createStaticCollectionByName,
  ensureTag,
  findStaticCollectionByName,
  mapCollectionSummary,
  normalizeCollectionName
} from './library'

const SUBJECT_LOOKUP_PAGE_SIZE = 500

/** Library row shape every synced media entity shares. */
interface LocalMediaEntity {
  id: string
  name: string
  status?: LibraryMediaStatus
  score?: number | null
  externalIds: readonly ExternalId[]
}

interface LocalMediaEntityPatch {
  status?: LibraryMediaStatus
  score?: number | null
}

/**
 * Sync-facing view of one local media type.
 *
 * Everything the sync engine needs is media-neutral except the library
 * namespace, ingest entry point, and relation kinds, so subclasses only
 * declare those.
 */
export abstract class BangumiLocalMediaAdapter implements LocalMediaAdapter {
  readonly supportsScraperProfile = true
  readonly supportsAutoSync = true
  readonly supportsImportWrite = true

  abstract readonly scope: BangumiMediaScope
  abstract readonly localMediaType: ScraperMediaType

  protected abstract readonly entityType: LibraryEntityType
  protected abstract readonly tagLinkKind: LibraryLinkKind
  protected abstract readonly collectionLinkKind: LibraryLinkKind

  constructor(private readonly hooks: HooksRegistrar) {}

  async listProfiles() {
    return kisaki.scrapers.profiles.list({ mediaType: this.localMediaType })
  }

  async subscribeLocalChanges(listener: LocalMediaChangeListener): Promise<Disposable> {
    return this.hooks.on('library.changed', ({ changes }) => {
      for (const change of changes) {
        if (change.entity !== this.entityType) {
          continue
        }

        for (const reason of readChangeReasons(change)) {
          void Promise.resolve(listener({ scope: this.scope, localId: change.id, reason }))
        }
      }
    })
  }

  async listLocalItems(query: LocalMediaListQuery): Promise<readonly LocalMediaItem[]> {
    const entities = await this.listEntities(
      omitUndefined({
        includeNsfw: query.includeNsfw ?? true,
        limit: query.limit,
        offset: query.offset
      })
    )

    return entities.map((entity) => this.toLocalItem(entity))
  }

  async getLocalItem(localId: string): Promise<LocalMediaItem | null> {
    const entity = await this.getEntity(localId)
    return entity ? this.toLocalItem(entity) : null
  }

  async findBySubjectIds(
    subjectIds: readonly string[]
  ): Promise<ReadonlyMap<string, LocalMediaItem>> {
    const wanted = new Set(subjectIds.map((id) => id.trim()).filter(Boolean))
    const output = new Map<string, LocalMediaItem>()
    if (wanted.size === 0) {
      return output
    }

    let offset = 0

    for (;;) {
      const items = await this.listLocalItems({
        includeNsfw: true,
        limit: SUBJECT_LOOKUP_PAGE_SIZE,
        offset
      })
      for (const item of items) {
        const subjectId = readBangumiSubjectIdFromExternalIds(item)
        if (subjectId && wanted.has(subjectId) && !output.has(subjectId)) {
          output.set(subjectId, item)
        }
      }

      offset += items.length
      if (items.length < SUBJECT_LOOKUP_PAGE_SIZE || output.size >= wanted.size) {
        return output
      }
    }
  }

  async patchUserFields(localId: string, patch: LocalMediaUserPatch): Promise<LocalMediaItem> {
    const entityPatch: LocalMediaEntityPatch = {}

    if (patch.status !== undefined) {
      if (!isLibraryMediaStatus(patch.status)) {
        throw new BangumiExtensionError('bangumi_validation', m().errors.localMediaStatusUnknown)
      }
      entityPatch.status = patch.status
    }

    if (patch.score !== undefined) {
      entityPatch.score = patch.score
    }

    if (Object.keys(entityPatch).length > 0) {
      await this.updateEntity(localId, entityPatch)
    }

    const item = await this.getLocalItem(localId)
    if (!item) {
      throw new BangumiExtensionError('library_update_failed', m().errors.localMediaMissing)
    }

    return item
  }

  async listTagNames(localId: string): Promise<ReadonlySet<string>> {
    const links = await kisaki.library.links.list({
      entity: { entityType: this.entityType, id: localId },
      kinds: [this.tagLinkKind]
    })
    const tagIds = [...new Set(links.map((link) => link.to.id))]
    if (tagIds.length === 0) {
      return new Set()
    }

    const tags = await kisaki.library.tags.list({ ids: tagIds, includeNsfw: true })
    return new Set(tags.map((tag) => tag.name))
  }

  async ensureTag(localId: string, tagName: string): Promise<void> {
    const tag = await ensureTag(tagName)
    const links = await kisaki.library.links.list({
      entity: { entityType: this.entityType, id: localId },
      relatedEntity: { entityType: 'tag', id: tag.id },
      kinds: [this.tagLinkKind]
    })
    if (links.length > 0) {
      return
    }

    await this.createTagLink(localId, tag.id)
  }

  async listCollections(): Promise<readonly LocalCollectionSummary[]> {
    const collections = await kisaki.library.collections.list({
      includeDynamic: false,
      includeStatic: true
    })
    return collections.map(mapCollectionSummary)
  }

  async resolveExistingCollection(collectionId: string): Promise<LocalCollectionTarget> {
    const collection = await kisaki.library.collections.get(collectionId)
    if (!collection || collection.isDynamic) {
      throw new BangumiExtensionError('bangumi_validation', m().errors.targetCollectionMissing)
    }

    return { id: collection.id, name: collection.name }
  }

  async resolveCollectionByTitle(title: string): Promise<LocalCollectionTarget> {
    const name = normalizeCollectionName(title)
    const existing = await findStaticCollectionByName(name)
    return existing ? { id: existing.id, name: existing.name } : { name, willCreate: true }
  }

  async hasCollectionMembership(localId: string, target: LocalCollectionTarget): Promise<boolean> {
    return target.id ? this.hasCollectionLink(localId, target.id) : false
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

    if (await this.hasCollectionLink(localId, collectionId)) {
      return
    }

    await this.createCollectionLink(collectionId, localId)
  }

  abstract addFromScraper(input: LocalMediaAddFromScraperInput): Promise<LocalMediaAddResult>

  protected abstract listEntities(
    query: LocalMediaListQuery
  ): Promise<readonly LocalMediaEntity[]>
  protected abstract getEntity(localId: string): Promise<LocalMediaEntity | null>
  protected abstract updateEntity(localId: string, patch: LocalMediaEntityPatch): Promise<void>
  protected abstract createTagLink(localId: string, tagId: string): Promise<void>
  protected abstract createCollectionLink(collectionId: string, localId: string): Promise<void>

  private async hasCollectionLink(localId: string, collectionId: string): Promise<boolean> {
    const links = await kisaki.library.links.list({
      entity: { entityType: this.entityType, id: localId },
      relatedEntity: { entityType: 'collection', id: collectionId },
      kinds: [this.collectionLinkKind]
    })
    return links.length > 0
  }

  private toLocalItem(entity: LocalMediaEntity): LocalMediaItem {
    return omitUndefined({
      scope: this.scope,
      localId: entity.id,
      name: entity.name,
      status: entity.status,
      score: entity.score,
      externalIds: entity.externalIds.map((externalId) => ({
        source: externalId.source,
        id: externalId.id
      }))
    })
  }
}

/**
 * Entry and episode changes are reported separately: a watch that both marks an
 * episode and advances the entry status has to reach both sync paths.
 */
function readChangeReasons(change: LibraryEntityChangeSummary): LocalMediaChangeReason[] {
  if (change.kind === 'created') {
    return ['created']
  }

  if (change.kind !== 'updated') {
    return []
  }

  const facets = new Set((change.changes ?? []).map((entry) => entry.facet))
  const reasons: LocalMediaChangeReason[] = []

  if (facets.has('status') || facets.has('score') || facets.has('identity')) {
    reasons.push('updated')
  }
  if (facets.has('episodes')) {
    reasons.push('episodes')
  }

  return reasons
}

function isLibraryMediaStatus(value: string): value is LibraryMediaStatus {
  return LIBRARY_MEDIA_STATUSES.includes(value as LibraryMediaStatus)
}
