import { and, eq } from 'drizzle-orm'
import type { LibraryGraphEdge, LibraryGraphResultAction } from '@kisaki3/extension-api'
import { collectionGameLinks, gameCompanyLinks, gamePersonLinks, gameTagLinks } from '@shared/db'
import type { ApplyState, ExecuteLibraryGraphOptions } from './types'
import { planOrderUpdate, stripUndefined } from './patches'
import { getEntityId, isEntityNodeFailed, requireEntityId } from './state'

type CollectionMediaEdge = Extract<LibraryGraphEdge, { kind: 'collection-media' }>
type RelationEdge = Extract<
  LibraryGraphEdge,
  { kind: 'media-tag' | 'media-company' | 'media-person' }
>

export function previewCollectionGameEdge(
  edge: CollectionMediaEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  const collectionId = getEntityId(state, edge.from.kind, edge.from.key)
  const gameId = getEntityId(state, edge.to.kind, edge.to.key)
  if (!collectionId || !gameId) {
    return 'create'
  }

  const existing = options.db.client
    .select()
    .from(collectionGameLinks)
    .where(
      and(
        eq(collectionGameLinks.collectionId, collectionId),
        eq(collectionGameLinks.gameId, gameId)
      )
    )
    .get()
  if (!existing) {
    return 'create'
  }
  return edge.order !== undefined && existing.orderInCollection !== edge.order ? 'update' : 'skip'
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

  const gameId = getEntityId(state, edge.from.kind, edge.from.key)
  const targetId = getEntityId(state, edge.to.kind, edge.to.key)
  if (!gameId || !targetId) {
    return 'create'
  }

  switch (edge.kind) {
    case 'media-tag': {
      const existing = options.db.client
        .select()
        .from(gameTagLinks)
        .where(and(eq(gameTagLinks.gameId, gameId), eq(gameTagLinks.tagId, targetId)))
        .get()
      return existing ? planOrderUpdate(existing.orderInGame, edge.order) : 'create'
    }
    case 'media-company': {
      const existing = options.db.client
        .select()
        .from(gameCompanyLinks)
        .where(
          and(
            eq(gameCompanyLinks.gameId, gameId),
            eq(gameCompanyLinks.companyId, targetId),
            eq(gameCompanyLinks.type, edge.role)
          )
        )
        .get()
      return existing ? planOrderUpdate(existing.orderInGame, edge.order) : 'create'
    }
    case 'media-person': {
      const existing = options.db.client
        .select()
        .from(gamePersonLinks)
        .where(
          and(
            eq(gamePersonLinks.gameId, gameId),
            eq(gamePersonLinks.personId, targetId),
            eq(gamePersonLinks.type, edge.role)
          )
        )
        .get()
      if (!existing) {
        return 'create'
      }
      return edge.order !== undefined && existing.orderInGame !== edge.order
        ? 'update'
        : edge.note !== undefined && existing.note !== edge.note
          ? 'update'
          : 'skip'
    }
  }
}

export function applyCollectionGameEdge(
  edge: CollectionMediaEdge,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  const collectionId = requireEntityId(state, edge.from.kind, edge.from.key)
  const gameId = requireEntityId(state, edge.to.kind, edge.to.key)
  const existing = options.db.client
    .select()
    .from(collectionGameLinks)
    .where(
      and(
        eq(collectionGameLinks.collectionId, collectionId),
        eq(collectionGameLinks.gameId, gameId)
      )
    )
    .get()

  if (!existing) {
    options.db.client
      .insert(collectionGameLinks)
      .values({ collectionId, gameId, orderInCollection: edge.order ?? 0 })
      .run()
    return 'create'
  }

  if (edge.order !== undefined && existing.orderInCollection !== edge.order) {
    options.db.client
      .update(collectionGameLinks)
      .set({ orderInCollection: edge.order })
      .where(
        and(
          eq(collectionGameLinks.collectionId, collectionId),
          eq(collectionGameLinks.gameId, gameId)
        )
      )
      .run()
    return 'update'
  }

  return 'skip'
}

export function applyGameTagEdge(
  edge: Extract<LibraryGraphEdge, { kind: 'media-tag' }>,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  if (state.skippedMedia.has(edge.from.key)) {
    return 'skip'
  }

  const gameId = requireEntityId(state, edge.from.kind, edge.from.key)
  const tagId = requireEntityId(state, edge.to.kind, edge.to.key)
  const existing = options.db.client
    .select()
    .from(gameTagLinks)
    .where(and(eq(gameTagLinks.gameId, gameId), eq(gameTagLinks.tagId, tagId)))
    .get()
  if (!existing) {
    options.db.client
      .insert(gameTagLinks)
      .values({ gameId, tagId, orderInGame: edge.order ?? 0 })
      .run()
    return 'create'
  }
  if (edge.order !== undefined && existing.orderInGame !== edge.order) {
    options.db.client
      .update(gameTagLinks)
      .set({ orderInGame: edge.order })
      .where(and(eq(gameTagLinks.gameId, gameId), eq(gameTagLinks.tagId, tagId)))
      .run()
    return 'update'
  }

  return 'skip'
}

export function applyGameCompanyEdge(
  edge: Extract<LibraryGraphEdge, { kind: 'media-company' }>,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  if (state.skippedMedia.has(edge.from.key)) {
    return 'skip'
  }

  const gameId = requireEntityId(state, edge.from.kind, edge.from.key)
  const companyId = requireEntityId(state, edge.to.kind, edge.to.key)
  const condition = and(
    eq(gameCompanyLinks.gameId, gameId),
    eq(gameCompanyLinks.companyId, companyId),
    eq(gameCompanyLinks.type, edge.role)
  )
  const existing = options.db.client.select().from(gameCompanyLinks).where(condition).get()
  if (!existing) {
    options.db.client
      .insert(gameCompanyLinks)
      .values({ gameId, companyId, type: edge.role, orderInGame: edge.order ?? 0 })
      .run()
    return 'create'
  }
  if (edge.order !== undefined && existing.orderInGame !== edge.order) {
    options.db.client
      .update(gameCompanyLinks)
      .set({ orderInGame: edge.order })
      .where(condition)
      .run()
    return 'update'
  }

  return 'skip'
}

export function applyGamePersonEdge(
  edge: Extract<LibraryGraphEdge, { kind: 'media-person' }>,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (isEndpointFailed(edge, state)) {
    return 'fail'
  }

  if (state.skippedMedia.has(edge.from.key)) {
    return 'skip'
  }

  const gameId = requireEntityId(state, edge.from.kind, edge.from.key)
  const personId = requireEntityId(state, edge.to.kind, edge.to.key)
  const condition = and(
    eq(gamePersonLinks.gameId, gameId),
    eq(gamePersonLinks.personId, personId),
    eq(gamePersonLinks.type, edge.role)
  )
  const existing = options.db.client.select().from(gamePersonLinks).where(condition).get()
  if (!existing) {
    options.db.client
      .insert(gamePersonLinks)
      .values({
        gameId,
        personId,
        type: edge.role,
        note: edge.note,
        orderInGame: edge.order ?? 0
      })
      .run()
    return 'create'
  }

  const patch = stripUndefined({
    orderInGame:
      edge.order !== undefined && existing.orderInGame !== edge.order ? edge.order : undefined,
    note: edge.note !== undefined && existing.note !== edge.note ? edge.note : undefined
  })
  if (Object.keys(patch).length > 0) {
    options.db.client.update(gamePersonLinks).set(patch).where(condition).run()
    return 'update'
  }

  return 'skip'
}

function isEndpointFailed(edge: CollectionMediaEdge | RelationEdge, state: ApplyState): boolean {
  return (
    isEntityNodeFailed(state, edge.from.kind, edge.from.key) ||
    isEntityNodeFailed(state, edge.to.kind, edge.to.key)
  )
}
