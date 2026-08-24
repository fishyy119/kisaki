/**
 * Invocation-scoped loaders for one visual novel.
 *
 * Slots overlap heavily — characters need traits and voice credits, companies
 * need both the VN's developers and every release's producers — so each read
 * is memoized per session and the by-id fan-outs happen once for the whole
 * session.
 */

import type { VndbClient } from '../../api/client'
import type {
  VndbCharacter,
  VndbKanaSchema,
  VndbProducer,
  VndbRelease,
  VndbStaff,
  VndbTag,
  VndbTrait,
  VndbVn
} from '../../api/types'
import { m } from '../../i18n'
import { VndbExtensionError } from '../../utils/errors'
import {
  CHARACTER_FIELDS,
  PRODUCER_FIELDS,
  RELEASE_FIELDS,
  STAFF_FIELDS,
  TAG_FIELDS,
  TRAIT_FIELDS,
  VN_CORE_FIELDS,
  VN_RELATION_FIELDS
} from '../fields'
import type { VndbRequestContext } from '../runtime'

export interface VndbGameLoaders {
  /** The VN's own fields; rejects when the entry no longer exists. */
  getVn(): Promise<VndbVn>
  getRelations(): Promise<VndbVn | null>
  getSchema(): Promise<VndbKanaSchema>
  getCharacters(): Promise<VndbCharacter[]>
  getReleases(): Promise<VndbRelease[]>
  getTags(): Promise<Map<string, VndbTag>>
  getTraits(): Promise<Map<string, VndbTrait>>
  getStaff(): Promise<Map<string, VndbStaff>>
  getProducers(): Promise<Map<string, VndbProducer>>
}

export function createGameLoaders(
  client: VndbClient,
  vnId: string,
  ctx: VndbRequestContext
): VndbGameLoaders {
  const request = { signal: ctx.signal }

  const getVn = memoize(async () => {
    const vn = await client.getVnById(vnId, VN_CORE_FIELDS, request)
    if (!vn) {
      throw new VndbExtensionError('vndb_not_found', m().errors.notFound)
    }
    return vn
  })

  const getRelations = memoize(() => client.getVnById(vnId, VN_RELATION_FIELDS, request))
  const getSchema = memoize(() => client.getSchema(request))
  const getCharacters = memoize(() => client.getCharactersByVn(vnId, CHARACTER_FIELDS, request))
  const getReleases = memoize(() => client.getReleasesByVn(vnId, RELEASE_FIELDS, request))

  const getTags = memoize(async () => {
    const vn = await getVn()
    const ids = collectIds((vn.tags ?? []).map((tag) => tag.id))
    return toMap(await client.getTagsByIds(ids, TAG_FIELDS, request))
  })

  const getTraits = memoize(async () => {
    const characters = await getCharacters()
    const ids = collectIds(
      characters.flatMap((character) => (character.traits ?? []).map((trait) => trait.id))
    )
    return toMap(await client.getTraitsByIds(ids, TRAIT_FIELDS, request))
  })

  const getStaff = memoize(async () => {
    const relations = await getRelations()
    const ids = collectIds([
      ...(relations?.staff ?? []).map((entry) => entry.id),
      ...(relations?.va ?? []).map((entry) => entry.staff?.id)
    ])
    return toMap(await client.getStaffByIds(ids, STAFF_FIELDS, request))
  })

  const getProducers = memoize(async () => {
    const [relations, releases] = await Promise.all([getRelations(), getReleases()])
    const ids = collectIds([
      ...(relations?.developers ?? []).map((developer) => developer.id),
      ...releases.flatMap((release) => (release.producers ?? []).map((producer) => producer.id))
    ])
    return toMap(await client.getProducersByIds(ids, PRODUCER_FIELDS, request))
  })

  return {
    getVn,
    getRelations,
    getSchema,
    getCharacters,
    getReleases,
    getTags,
    getTraits,
    getStaff,
    getProducers
  }
}

function collectIds(values: readonly (string | null | undefined)[]): string[] {
  const ids = new Set<string>()
  for (const value of values) {
    const id = value?.trim()
    if (id) {
      ids.add(id)
    }
  }
  return [...ids]
}

function toMap<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]))
}

function memoize<T>(load: () => Promise<T>): () => Promise<T> {
  let task: Promise<T> | undefined
  return () => (task ??= load())
}
