import { kisaki, type LibraryCollection, type LibraryTag } from '@kisaki3/extension-sdk'
import { m } from '../../i18n'
import { BangumiExtensionError } from '../../utils/errors'
import type { LocalCollectionSummary, LocalCollectionTarget } from '../types'

/**
 * Library lookups shared by local media adapters.
 *
 * Creation retries a lookup once: names are not unique keys, so a concurrent
 * writer can win the race between "not found" and "create".
 */
export function mapCollectionSummary(collection: LibraryCollection): LocalCollectionSummary {
  return {
    id: collection.id,
    name: collection.name,
    ...(collection.description ? { description: collection.description } : {})
  }
}

/** Static collections an import may file entries into; identical for every scope. */
export async function listStaticCollections(): Promise<readonly LocalCollectionSummary[]> {
  const collections = await kisaki.library.collections.list({
    includeDynamic: false,
    includeStatic: true
  })
  return collections.map(mapCollectionSummary)
}

export async function resolveStaticCollectionById(
  collectionId: string
): Promise<LocalCollectionTarget> {
  const collection = await kisaki.library.collections.get(collectionId)
  if (!collection || collection.isDynamic) {
    throw new BangumiExtensionError('bangumi_validation', m().errors.targetCollectionMissing)
  }

  return { id: collection.id, name: collection.name }
}

/** Resolves a title to a collection, or to the name one would be created under. */
export async function resolveStaticCollectionByTitle(
  title: string
): Promise<LocalCollectionTarget> {
  const name = normalizeCollectionName(title)
  const existing = await findStaticCollectionByName(name)
  return existing ? { id: existing.id, name: existing.name } : { name, willCreate: true }
}

export function normalizeCollectionName(name: string): string {
  const normalized = name.trim()
  if (!normalized) {
    throw new BangumiExtensionError('bangumi_validation', m().errors.indexTitleEmpty)
  }

  return normalized
}

export async function findStaticCollectionByName(
  name: string
): Promise<LibraryCollection | undefined> {
  const collections = await kisaki.library.collections.list({
    search: name,
    includeDynamic: false,
    includeStatic: true
  })
  return collections.find((collection) => collection.name === name && !collection.isDynamic)
}

export async function createStaticCollectionByName(name: string): Promise<LibraryCollection> {
  try {
    return await kisaki.library.collections.create({ name, isDynamic: false, isNsfw: false })
  } catch (error) {
    const retry = await findStaticCollectionByName(name)
    if (retry) {
      return retry
    }

    throw error
  }
}

export async function ensureTag(name: string): Promise<LibraryTag> {
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
  const tags = await kisaki.library.tags.list({ search: name, includeNsfw: true })
  return tags.find((tag) => tag.name === name)
}
