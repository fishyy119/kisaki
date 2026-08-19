import { and, eq, type SQL } from 'drizzle-orm'
import type {
  LibraryGraphEdge,
  LibraryGraphResultAction,
  LibraryMediaType
} from '@kisaki3/extension-api'
import {
  arePlayingEqual,
  characterPersonLinks,
  getMediaRelationTypeRules,
  mediaRelations,
  normalizePlaying
} from '@shared/db'
import type { ApplyState, ExecuteLibraryGraphOptions } from './types'
import {
  insertMediaLink,
  mediaLinkConfigs,
  readMediaLink,
  updateMediaLink,
  type MediaLinkConfig,
  type MediaLinkRow
} from './media-links'
import { planOrderUpdate, stripUndefined } from './patches'
import { getEntityId, isEntityNodeFailed, requireEntityId } from './state'

type CollectionMediaEdge = Extract<LibraryGraphEdge, { kind: 'collection-media' }>
type TagEdge = Extract<LibraryGraphEdge, { kind: 'media-tag' }>
type CompanyEdge = Extract<LibraryGraphEdge, { kind: 'media-company' }>
type PersonEdge = Extract<LibraryGraphEdge, { kind: 'media-person' }>
type CharacterEdge = Extract<LibraryGraphEdge, { kind: 'media-character' }>
type CharacterPersonEdge = Extract<LibraryGraphEdge, { kind: 'character-person' }>
type MediaMediaEdge = Extract<LibraryGraphEdge, { kind: 'media-media' }>
type RelationEdge = TagEdge | CompanyEdge | PersonEdge | CharacterEdge

export function previewCollectionMediaEdge(
  edge: CollectionMediaEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  const collectionId = getEntityId(state, edge.from.kind, edge.from.key)
  const mediaId = getEntityId(state, edge.to.kind, edge.to.key)
  if (!collectionId || !mediaId) {
    return 'create'
  }

  const config = mediaLinkConfigs(state.mediaTypes.get(edge.to.key)).collection
  const existing = readMediaLink(options.db.client, config, mediaId, collectionId)
  if (!existing) {
    return 'create'
  }
  return planOrderUpdate(existing.order, edge.order)
}

export function previewRelationEdge(
  edge: RelationEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  if (state.skippedMedia.has(edge.from.key)) {
    return 'skip'
  }

  const mediaId = getEntityId(state, edge.from.kind, edge.from.key)
  const targetId = getEntityId(state, edge.to.kind, edge.to.key)
  if (!mediaId || !targetId) {
    return 'create'
  }

  const { config, role } = resolveRelationLink(edge, state)
  const existing = readMediaLink(options.db.client, config, mediaId, targetId, role)
  if (!existing) {
    return 'create'
  }
  return planLinkUpdate(existing, edge)
}

export function previewCharacterPersonEdge(
  edge: CharacterPersonEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  const characterId = getEntityId(state, edge.from.kind, edge.from.key)
  const personId = getEntityId(state, edge.to.kind, edge.to.key)
  if (!characterId || !personId) {
    return 'create'
  }

  const existing = readCharacterPersonLink(characterId, personId, edge.role, options)
  if (!existing) {
    return 'create'
  }
  return planLinkUpdate(existing, edge)
}

export function previewMediaMediaEdge(
  edge: MediaMediaEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  if (state.skippedMedia.has(edge.from.key)) {
    return 'skip'
  }

  const endpoints = resolveMediaRelationEndpoints(edge, state)
  if (!endpoints) {
    return 'fail'
  }

  if (edge.from.key === edge.to.key) {
    return 'skip'
  }

  const fromId = getEntityId(state, edge.from.kind, edge.from.key)
  const toId = getEntityId(state, edge.to.kind, edge.to.key)
  if (!fromId || !toId) {
    return 'create'
  }
  if (fromId === toId) {
    return 'skip'
  }

  const existing = readMediaRelation(endpoints, fromId, toId, edge.type, options)
  if (!existing) {
    return 'create'
  }
  return (edge.order !== undefined && existing.orderInFrom !== edge.order) ||
    (edge.note !== undefined && existing.note !== edge.note)
    ? 'update'
    : 'skip'
}

export function applyCollectionMediaEdge(
  edge: CollectionMediaEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  const collectionId = requireEntityId(state, edge.from.kind, edge.from.key)
  const mediaId = requireEntityId(state, edge.to.kind, edge.to.key)
  const config = mediaLinkConfigs(state.mediaTypes.get(edge.to.key)).collection
  const existing = readMediaLink(options.db.client, config, mediaId, collectionId)

  if (!existing) {
    insertMediaLink(options.db.client, config, {
      mediaId,
      targetId: collectionId,
      order: edge.order ?? 0
    })
    return 'create'
  }

  if (edge.order !== undefined && existing.order !== edge.order) {
    updateMediaLink(options.db.client, config, mediaId, collectionId, undefined, {
      order: edge.order
    })
    return 'update'
  }

  return 'skip'
}

export function applyMediaTagEdge(
  edge: TagEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  return applyRelationEdge(edge, state, options)
}

export function applyMediaCompanyEdge(
  edge: CompanyEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  return applyRelationEdge(edge, state, options)
}

export function applyMediaPersonEdge(
  edge: PersonEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  return applyRelationEdge(edge, state, options)
}

export function applyMediaCharacterEdge(
  edge: CharacterEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  return applyRelationEdge(edge, state, options)
}

export function applyCharacterPersonEdge(
  edge: CharacterPersonEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  const characterId = requireEntityId(state, edge.from.kind, edge.from.key)
  const personId = requireEntityId(state, edge.to.kind, edge.to.key)
  const existing = readCharacterPersonLink(characterId, personId, edge.role, options)
  const condition = and(
    eq(characterPersonLinks.characterId, characterId),
    eq(characterPersonLinks.personId, personId),
    eq(characterPersonLinks.role, edge.role)
  )
  if (!existing) {
    options.db.client
      .insert(characterPersonLinks)
      .values({
        characterId,
        personId,
        role: edge.role,
        note: edge.note,
        orderInCharacter: edge.order ?? 0
      })
      .run()
    return 'create'
  }

  const patch = stripUndefined({
    orderInCharacter:
      edge.order !== undefined && existing.order !== edge.order ? edge.order : undefined,
    note: edge.note !== undefined && existing.note !== edge.note ? edge.note : undefined
  })
  if (Object.keys(patch).length > 0) {
    options.db.client.update(characterPersonLinks).set(patch).where(condition).run()
    return 'update'
  }

  return 'skip'
}

export function applyMediaMediaEdge(
  edge: MediaMediaEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  if (state.skippedMedia.has(edge.from.key)) {
    return 'skip'
  }

  const endpoints = resolveMediaRelationEndpoints(edge, state)
  if (!endpoints) {
    return 'fail'
  }

  const fromId = requireEntityId(state, edge.from.kind, edge.from.key)
  const toId = requireEntityId(state, edge.to.kind, edge.to.key)
  if (fromId === toId) {
    return 'skip'
  }

  const existing = readMediaRelation(endpoints, fromId, toId, edge.type, options)
  if (!existing) {
    options.db.client
      .insert(mediaRelations)
      .values({
        fromType: endpoints.fromType,
        fromId,
        toType: endpoints.toType,
        toId,
        type: edge.type,
        note: edge.note,
        orderInFrom: edge.order ?? 0
      })
      .run()
    return 'create'
  }

  const patch = stripUndefined({
    orderInFrom:
      edge.order !== undefined && existing.orderInFrom !== edge.order ? edge.order : undefined,
    note: edge.note !== undefined && existing.note !== edge.note ? edge.note : undefined
  })
  if (Object.keys(patch).length > 0) {
    options.db.client
      .update(mediaRelations)
      .set(patch)
      .where(mediaRelationCondition(endpoints, fromId, toId, edge.type))
      .run()
    return 'update'
  }

  return 'skip'
}

function applyRelationEdge(
  edge: RelationEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  if (state.skippedMedia.has(edge.from.key)) {
    return 'skip'
  }

  const mediaId = requireEntityId(state, edge.from.kind, edge.from.key)
  const targetId = requireEntityId(state, edge.to.kind, edge.to.key)
  const { config, role } = resolveRelationLink(edge, state)
  const existing = readMediaLink(options.db.client, config, mediaId, targetId, role)
  const note = edge.kind === 'media-tag' || edge.kind === 'media-company' ? undefined : edge.note
  const playing = edge.kind === 'media-person' ? toStoredPlaying(edge.playing) : undefined

  if (!existing) {
    insertMediaLink(options.db.client, config, {
      mediaId,
      targetId,
      role,
      note,
      playing,
      order: edge.order ?? 0
    })
    return 'create'
  }

  const patch = stripUndefined({
    order: edge.order !== undefined && existing.order !== edge.order ? edge.order : undefined,
    note: note !== undefined && existing.note !== note ? note : undefined,
    playing:
      playing !== undefined && !arePlayingEqual(existing.playing, playing) ? playing : undefined
  })
  if (Object.keys(patch).length > 0) {
    updateMediaLink(options.db.client, config, mediaId, targetId, role, patch)
    return 'update'
  }

  return 'skip'
}

function resolveRelationLink(
  edge: RelationEdge,
  state: ApplyState
): { config: MediaLinkConfig; role: string | undefined } {
  const configs = mediaLinkConfigs(state.mediaTypes.get(edge.from.key))
  switch (edge.kind) {
    case 'media-tag':
      return { config: configs.tag, role: undefined }
    case 'media-company':
      return { config: configs.company, role: edge.role }
    case 'media-person':
      return { config: configs.person, role: edge.role }
    case 'media-character':
      return { config: configs.character, role: edge.role }
  }
}

function planLinkUpdate(
  existing: MediaLinkRow,
  edge: { order?: number; note?: string; playing?: readonly string[] }
): LibraryGraphResultAction {
  const playing = toStoredPlaying(edge.playing)
  return (edge.order !== undefined && existing.order !== edge.order) ||
    (edge.note !== undefined && existing.note !== edge.note) ||
    (playing !== undefined && !arePlayingEqual(existing.playing, playing))
    ? 'update'
    : 'skip'
}

/**
 * Brings a stated list to storage shape. `undefined` marks an edge that left
 * the stored list alone, and an empty list clears it.
 */
function toStoredPlaying(playing: readonly string[] | undefined): string[] | null | undefined {
  if (playing === undefined) {
    return undefined
  }

  const names = normalizePlaying(playing)
  return names.length > 0 ? names : null
}

function readCharacterPersonLink(
  characterId: string,
  personId: string,
  role: CharacterPersonEdge['role'],
  options: ExecuteLibraryGraphOptions
): MediaLinkRow | undefined {
  const row = options.db.client
    .select()
    .from(characterPersonLinks)
    .where(
      and(
        eq(characterPersonLinks.characterId, characterId),
        eq(characterPersonLinks.personId, personId),
        eq(characterPersonLinks.role, role)
      )
    )
    .get()
  return row ? { order: row.orderInCharacter, note: row.note } : undefined
}

interface MediaRelationEndpoints {
  fromType: LibraryMediaType
  toType: LibraryMediaType
}

/**
 * Resolves both endpoint media types and re-checks the relation type against
 * the per-pair vocabulary as a safety net behind input validation. Returns
 * null when the edge cannot be written.
 */
function resolveMediaRelationEndpoints(
  edge: MediaMediaEdge,
  state: ApplyState
): MediaRelationEndpoints | null {
  const fromType = state.mediaTypes.get(edge.from.key)
  const toType = state.mediaTypes.get(edge.to.key)
  if (!fromType || !toType) {
    return null
  }

  return getMediaRelationTypeRules(fromType, toType).includes(edge.type)
    ? { fromType, toType }
    : null
}

function mediaRelationCondition(
  endpoints: MediaRelationEndpoints,
  fromId: string,
  toId: string,
  type: MediaMediaEdge['type']
): SQL {
  return and(
    eq(mediaRelations.fromType, endpoints.fromType),
    eq(mediaRelations.fromId, fromId),
    eq(mediaRelations.toType, endpoints.toType),
    eq(mediaRelations.toId, toId),
    eq(mediaRelations.type, type)
  ) as SQL
}

function readMediaRelation(
  endpoints: MediaRelationEndpoints,
  fromId: string,
  toId: string,
  type: MediaMediaEdge['type'],
  options: ExecuteLibraryGraphOptions
): { orderInFrom: number; note: string | null } | undefined {
  const row = options.db.client
    .select()
    .from(mediaRelations)
    .where(mediaRelationCondition(endpoints, fromId, toId, type))
    .get()
  return row ? { orderInFrom: row.orderInFrom, note: row.note } : undefined
}

function isEndpointFailed(
  edge: CollectionMediaEdge | RelationEdge | CharacterPersonEdge | MediaMediaEdge,
  state: ApplyState
): boolean {
  return (
    isEntityNodeFailed(state, edge.from.kind, edge.from.key) ||
    isEntityNodeFailed(state, edge.to.kind, edge.to.key)
  )
}
