import {
  kisaki,
  type Disposable,
  type LibraryCollection,
  type LibraryGame,
  type LibraryGamePatch,
  type LibraryGameStatus,
  type LibraryGameUpdatedEvent,
  type LibraryTag
} from '@kisaki3/extension-sdk'
import { BANGUMI_COLLECTION_LABELS_BY_SCOPE, BANGUMI_SCOPE_LABELS } from '../labels'
import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../scopes'
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
  LocalMediaUserPatch
} from '../types'
import { BANGUMI_SOURCE_ID } from '../../shared/constants'
import { BangumiExtensionError } from '../../shared/errors'

const LIBRARY_GAME_STATUS_VALUES = [
  'notStarted',
  'inProgress',
  'partial',
  'completed',
  'multiple',
  'shelved'
] as const satisfies readonly LibraryGameStatus[]

export class GameLocalMediaAdapter implements LocalMediaAdapter {
  readonly scope = 'game'
  readonly localMediaType = 'game'
  readonly supportsScraperProfile = true
  readonly supportsAutoSync = true
  readonly supportsImportWrite = true

  async listProfiles() {
    return kisaki.scrapers.profiles.list({ mediaType: 'game' })
  }

  async subscribeLocalChanges(listener: LocalMediaChangeListener): Promise<Disposable> {
    const registrations = await Promise.all([
      kisaki.events.on('library.game.created', (event) => {
        void Promise.resolve(
          listener({
            scope: this.scope,
            localId: event.gameId,
            reason: 'created'
          })
        )
      }),
      kisaki.events.on('library.game.updated', (event) => {
        if (!hasSyncRelevantGameChange(event)) {
          return
        }

        void Promise.resolve(
          listener({
            scope: this.scope,
            localId: event.gameId,
            reason: 'updated'
          })
        )
      })
    ])

    return {
      dispose() {
        for (const registration of registrations) {
          registration.dispose()
        }
      }
    }
  }

  async listLocalItems(query: LocalMediaListQuery): Promise<readonly LocalMediaItem[]> {
    const games = await kisaki.library.games.list({
      includeNsfw: query.includeNsfw ?? true,
      limit: query.limit,
      offset: query.offset
    })

    return games.map(mapLibraryGame)
  }

  async getLocalItem(localId: string): Promise<LocalMediaItem | null> {
    const game = await kisaki.library.games.get(localId)
    return game ? mapLibraryGame(game) : null
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
    const limit = 500

    while (true) {
      const items = await this.listLocalItems({ includeNsfw: true, limit, offset })
      for (const item of items) {
        const subjectId = readBangumiSubjectId(item)
        if (subjectId && wanted.has(subjectId) && !output.has(subjectId)) {
          output.set(subjectId, item)
        }
      }

      offset += items.length
      if (items.length < limit || output.size >= wanted.size) {
        return output
      }
    }
  }

  async addFromScraper(input: LocalMediaAddFromScraperInput): Promise<LocalMediaAddResult> {
    const result = await kisaki.ingest.games.addFromScraper(input.profileId, {
      name: input.name,
      knownIds: [...input.knownIds]
    })

    return {
      localId: result.gameId,
      isNew: result.isNew
    }
  }

  async patchUserFields(localId: string, patch: LocalMediaUserPatch): Promise<LocalMediaItem> {
    const gamePatch: LibraryGamePatch = {}

    if (patch.status !== undefined) {
      if (!isLibraryGameStatus(patch.status)) {
        throw new BangumiExtensionError('bangumi_validation', '无法识别本地游戏状态。')
      }
      gamePatch.status = patch.status
    }

    if (patch.score !== undefined) {
      gamePatch.score = patch.score
    }

    if (Object.keys(gamePatch).length > 0) {
      await kisaki.library.games.update(localId, gamePatch)
    }

    const item = await this.getLocalItem(localId)
    if (!item) {
      throw new BangumiExtensionError('library_update_failed', '本地游戏不存在。')
    }

    return item
  }

  async listTagNames(localId: string): Promise<ReadonlySet<string>> {
    const relations = await kisaki.library.relations.list({
      entity: { entityType: 'game', id: localId },
      kinds: ['game-tag']
    })
    const tagIds = [...new Set(relations.map((relation) => relation.to.id))]
    if (tagIds.length === 0) {
      return new Set()
    }

    const tags = await kisaki.library.tags.list({
      ids: tagIds,
      includeNsfw: true
    })
    return new Set(tags.map((tag) => tag.name))
  }

  async ensureTag(localId: string, tagName: string): Promise<void> {
    const tag = await ensureTag(tagName)
    await ensureGameTag(localId, tag.id)
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
      throw new BangumiExtensionError('bangumi_validation', '选择的目标合集不存在。')
    }

    return { id: collection.id, name: collection.name }
  }

  async resolveCollectionByTitle(title: string): Promise<LocalCollectionTarget> {
    const name = normalizeCollectionName(title)
    const existing = await findStaticCollectionByName(name)
    if (existing) {
      return { id: existing.id, name: existing.name }
    }

    return { name, willCreate: true }
  }

  async hasCollectionMembership(
    localId: string,
    target: LocalCollectionTarget
  ): Promise<boolean> {
    return target.id ? hasGameCollectionRelation(localId, target.id) : false
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

    await ensureGameInCollection(localId, collectionId)
  }
}

export function createGameMediaDescriptor(
  adapter: LocalMediaAdapter
): BangumiMediaDescriptor {
  return {
    scope: 'game',
    subjectType: BANGUMI_SUBJECT_TYPE_BY_SCOPE.game,
    label: BANGUMI_SCOPE_LABELS.game,
    collectionLabels: BANGUMI_COLLECTION_LABELS_BY_SCOPE.game,
    localAdapter: adapter
  }
}

function mapLibraryGame(game: LibraryGame): LocalMediaItem {
  return {
    scope: 'game',
    localId: game.id,
    name: game.name,
    status: game.status,
    score: game.score,
    externalIds: game.externalIds.map((externalId) => ({
      source: externalId.source,
      id: externalId.id
    }))
  }
}

function mapCollectionSummary(collection: LibraryCollection): LocalCollectionSummary {
  return {
    id: collection.id,
    name: collection.name,
    ...(collection.description ? { description: collection.description } : {})
  }
}

function readBangumiSubjectId(item: LocalMediaItem): string | undefined {
  const externalId = item.externalIds.find((candidate) => candidate.source === BANGUMI_SOURCE_ID)
  const id = externalId?.id.trim()
  return id && /^\d+$/.test(id) ? id : undefined
}

function hasSyncRelevantGameChange(event: LibraryGameUpdatedEvent): boolean {
  return event.changes.some(
    (change) => change.facet === 'status' || change.facet === 'score' || change.facet === 'identity'
  )
}

function isLibraryGameStatus(value: string): value is LibraryGameStatus {
  return LIBRARY_GAME_STATUS_VALUES.includes(value as LibraryGameStatus)
}

async function findStaticCollectionByName(name: string): Promise<LibraryCollection | undefined> {
  const collections = await kisaki.library.collections.list({
    search: name,
    includeDynamic: false,
    includeStatic: true
  })
  return collections.find((collection) => collection.name === name && !collection.isDynamic)
}

async function createStaticCollectionByName(name: string): Promise<LibraryCollection> {
  try {
    return await kisaki.library.collections.create({
      name,
      isDynamic: false,
      isNsfw: false
    })
  } catch (error) {
    const retry = await findStaticCollectionByName(name)
    if (retry) {
      return retry
    }
    throw error
  }
}

function normalizeCollectionName(name: string): string {
  const normalized = name.trim()
  if (!normalized) {
    throw new BangumiExtensionError(
      'bangumi_validation',
      'Bangumi 目录标题为空，无法创建合集。'
    )
  }
  return normalized
}

async function ensureTag(name: string): Promise<LibraryTag> {
  const existing = await findTagByName(name)
  if (existing) {
    return existing
  }

  try {
    return await kisaki.library.tags.create({ name, isNsfw: false })
  } catch (error) {
    const retry = await findTagByName(name)
    if (retry) {
      return retry
    }
    throw error
  }
}

async function findTagByName(name: string): Promise<LibraryTag | undefined> {
  const tags = await kisaki.library.tags.list({
    search: name,
    includeNsfw: true
  })
  return tags.find((tag) => tag.name === name)
}

async function ensureGameTag(localId: string, tagId: string): Promise<void> {
  const relations = await kisaki.library.relations.list({
    entity: { entityType: 'game', id: localId },
    relatedEntity: { entityType: 'tag', id: tagId },
    kinds: ['game-tag']
  })
  if (relations.length > 0) {
    return
  }

  await kisaki.library.relations.create({
    kind: 'game-tag',
    from: { entityType: 'game', id: localId },
    to: { entityType: 'tag', id: tagId },
    metadata: { order: 0 }
  })
}

async function ensureGameInCollection(localId: string, collectionId: string): Promise<void> {
  if (await hasGameCollectionRelation(localId, collectionId)) {
    return
  }

  await kisaki.library.relations.create({
    kind: 'collection-game',
    from: { entityType: 'collection', id: collectionId },
    to: { entityType: 'game', id: localId },
    metadata: { order: 0 }
  })
}

async function hasGameCollectionRelation(localId: string, collectionId: string): Promise<boolean> {
  const relations = await kisaki.library.relations.list({
    entity: { entityType: 'game', id: localId },
    relatedEntity: { entityType: 'collection', id: collectionId },
    kinds: ['collection-game']
  })
  return relations.length > 0
}
