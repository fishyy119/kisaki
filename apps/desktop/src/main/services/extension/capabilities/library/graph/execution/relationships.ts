import { and, eq, type SQL } from 'drizzle-orm'
import type {
  LibraryGraphEdge,
  LibraryGraphResultAction,
  LibraryMediaType
} from '@kisaki3/extension-api'
import {
  characterPersonLinks,
  companyRelations,
  isMediaRelationTypeAllowed,
  mediaRelations
} from '@shared/db'
import type { ApplyState, ExecuteLibraryGraphOptions } from './types'
import {
  insertMediaCast,
  insertMediaLink,
  mediaLinkConfigs,
  readMediaCast,
  readMediaLink,
  updateMediaCastNote,
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
type CastEdge = Extract<LibraryGraphEdge, { kind: 'media-cast' }>
type CharacterPersonEdge = Extract<LibraryGraphEdge, { kind: 'character-person' }>
type MediaMediaEdge = Extract<LibraryGraphEdge, { kind: 'media-media' }>
type CompanyCompanyEdge = Extract<LibraryGraphEdge, { kind: 'company-company' }>
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

export function previewMediaCastEdge(
  edge: CastEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isCastEndpointFailed(edge, state)) {
    return 'fail'
  }

  if (state.skippedMedia.has(edge.from.key)) {
    return 'skip'
  }

  const mediaId = getEntityId(state, edge.from.kind, edge.from.key)
  const characterId = getEntityId(state, edge.to.kind, edge.to.key)
  const personId = getEntityId(state, edge.person.kind, edge.person.key)
  if (!mediaId || !characterId || !personId) {
    return 'create'
  }

  const config = requireCastConfig(state, edge.from.key)
  const existing = readMediaCast(options.db.client, config, mediaId, characterId, personId)
  if (!existing) {
    return 'create'
  }
  return edge.note !== undefined && existing.note !== edge.note ? 'update' : 'skip'
}

export function applyMediaCastEdge(
  edge: CastEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isCastEndpointFailed(edge, state)) {
    return 'fail'
  }

  if (state.skippedMedia.has(edge.from.key)) {
    return 'skip'
  }

  const mediaId = requireEntityId(state, edge.from.kind, edge.from.key)
  const characterId = requireEntityId(state, edge.to.kind, edge.to.key)
  const personId = requireEntityId(state, edge.person.kind, edge.person.key)
  const config = requireCastConfig(state, edge.from.key)
  const existing = readMediaCast(options.db.client, config, mediaId, characterId, personId)

  if (!existing) {
    insertMediaCast(options.db.client, config, {
      mediaId,
      characterId,
      personId,
      note: edge.note
    })
    return 'create'
  }

  if (edge.note !== undefined && existing.note !== edge.note) {
    updateMediaCastNote(options.db.client, config, mediaId, characterId, personId, edge.note)
    return 'update'
  }

  return 'skip'
}

/** Input validation already rejects cast edges on media types without one. */
function requireCastConfig(state: ApplyState, mediaNodeKey: string) {
  const config = mediaLinkConfigs(state.mediaTypes.get(mediaNodeKey)).cast
  if (!config) {
    throw new Error(`Media node "${mediaNodeKey}" has no cast table.`)
  }
  return config
}

export function previewCompanyCompanyEdge(
  edge: CompanyCompanyEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
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

  const existing = readCompanyRelation(fromId, toId, edge.type, options)
  if (!existing) {
    return 'create'
  }
  return (edge.order !== undefined && existing.orderInFrom !== edge.order) ||
    (edge.note !== undefined && existing.note !== edge.note)
    ? 'update'
    : 'skip'
}

export function applyCompanyCompanyEdge(
  edge: CompanyCompanyEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  const fromId = requireEntityId(state, edge.from.kind, edge.from.key)
  const toId = requireEntityId(state, edge.to.kind, edge.to.key)
  if (fromId === toId) {
    return 'skip'
  }

  const existing = readCompanyRelation(fromId, toId, edge.type, options)
  if (!existing) {
    options.db.client
      .insert(companyRelations)
      .values({
        fromId,
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
      .update(companyRelations)
      .set(patch)
      .where(companyRelationCondition(fromId, toId, edge.type))
      .run()
    return 'update'
  }

  return 'skip'
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

  if (!existing) {
    insertMediaLink(options.db.client, config, {
      mediaId,
      targetId,
      role,
      note,
      order: edge.order ?? 0
    })
    return 'create'
  }

  const patch = stripUndefined({
    order: edge.order !== undefined && existing.order !== edge.order ? edge.order : undefined,
    note: note !== undefined && existing.note !== note ? note : undefined
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
  edge: { order?: number; note?: string }
): LibraryGraphResultAction {
  return (edge.order !== undefined && existing.order !== edge.order) ||
    (edge.note !== undefined && existing.note !== edge.note)
    ? 'update'
    : 'skip'
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
 * the endpoint rule as a safety net behind input validation. Returns null when
 * the edge cannot be written.
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

  return isMediaRelationTypeAllowed(edge.type, fromType, toType) ? { fromType, toType } : null
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

function companyRelationCondition(
  fromId: string,
  toId: string,
  type: CompanyCompanyEdge['type']
): SQL {
  return and(
    eq(companyRelations.fromId, fromId),
    eq(companyRelations.toId, toId),
    eq(companyRelations.type, type)
  ) as SQL
}

function readCompanyRelation(
  fromId: string,
  toId: string,
  type: CompanyCompanyEdge['type'],
  options: ExecuteLibraryGraphOptions
): { orderInFrom: number; note: string | null } | undefined {
  const row = options.db.client
    .select()
    .from(companyRelations)
    .where(companyRelationCondition(fromId, toId, type))
    .get()
  return row ? { orderInFrom: row.orderInFrom, note: row.note } : undefined
}

function isEndpointFailed(
  edge:
    CollectionMediaEdge | RelationEdge | CharacterPersonEdge | MediaMediaEdge | CompanyCompanyEdge,
  state: ApplyState
): boolean {
  return (
    isEntityNodeFailed(state, edge.from.kind, edge.from.key) ||
    isEntityNodeFailed(state, edge.to.kind, edge.to.key)
  )
}

/** A cast edge fails when any of its three endpoints did. */
function isCastEndpointFailed(edge: CastEdge, state: ApplyState): boolean {
  return (
    isEntityNodeFailed(state, edge.from.kind, edge.from.key) ||
    isEntityNodeFailed(state, edge.to.kind, edge.to.key) ||
    isEntityNodeFailed(state, edge.person.kind, edge.person.key)
  )
}
