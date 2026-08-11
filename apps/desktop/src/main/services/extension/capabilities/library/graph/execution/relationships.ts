import { and, eq, type SQL } from 'drizzle-orm'
import type {
  LibraryAnimeCompanyRole,
  LibraryAnimePersonRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryGraphEdge,
  LibraryGraphResultAction,
  LibraryMediaType
} from '@kisaki3/extension-api'
import {
  animeCompanyLinks,
  animePersonLinks,
  animeTagLinks,
  collectionAnimeLinks,
  collectionGameLinks,
  gameCompanyLinks,
  gamePersonLinks,
  gameTagLinks
} from '@shared/db'
import type { ApplyState, ExecuteLibraryGraphOptions } from './types'
import { planOrderUpdate, stripUndefined } from './patches'
import { getEntityId, isEntityNodeFailed, requireEntityId } from './state'

type CollectionMediaEdge = Extract<LibraryGraphEdge, { kind: 'collection-media' }>
type TagEdge = Extract<LibraryGraphEdge, { kind: 'media-tag' }>
type CompanyEdge = Extract<LibraryGraphEdge, { kind: 'media-company' }>
type PersonEdge = Extract<LibraryGraphEdge, { kind: 'media-person' }>
type RelationEdge = TagEdge | CompanyEdge | PersonEdge

interface CollectionMediaLinkTable {
  read(mediaId: string, collectionId: string): { orderInCollection: number } | undefined
  insert(mediaId: string, collectionId: string, order: number): void
  update(mediaId: string, collectionId: string, order: number): void
}

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

  const link = collectionMediaLink(state.mediaTypes.get(edge.to.key), options)
  const existing = link.read(mediaId, collectionId)
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

  const mediaId = getEntityId(state, edge.from.kind, edge.from.key)
  const targetId = getEntityId(state, edge.to.kind, edge.to.key)
  if (!mediaId || !targetId) {
    return 'create'
  }

  const mediaType = state.mediaTypes.get(edge.from.key)

  switch (edge.kind) {
    case 'media-tag': {
      const existing = readTagLink(mediaType, mediaId, targetId, options)
      return existing ? planOrderUpdate(existing.order, edge.order) : 'create'
    }
    case 'media-company': {
      const existing = readCompanyLink(mediaType, mediaId, targetId, edge.role, options)
      return existing ? planOrderUpdate(existing.order, edge.order) : 'create'
    }
    case 'media-person': {
      const existing = readPersonLink(mediaType, mediaId, targetId, edge.role, options)
      if (!existing) {
        return 'create'
      }
      return (edge.order !== undefined && existing.order !== edge.order) ||
        (edge.note !== undefined && existing.note !== edge.note)
        ? 'update'
        : 'skip'
    }
  }
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
  const link = collectionMediaLink(state.mediaTypes.get(edge.to.key), options)
  const existing = link.read(mediaId, collectionId)

  if (!existing) {
    link.insert(mediaId, collectionId, edge.order ?? 0)
    return 'create'
  }

  if (edge.order !== undefined && existing.orderInCollection !== edge.order) {
    link.update(mediaId, collectionId, edge.order)
    return 'update'
  }

  return 'skip'
}

export function applyMediaTagEdge(
  edge: TagEdge,
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
  const tagId = requireEntityId(state, edge.to.kind, edge.to.key)
  const mediaType = state.mediaTypes.get(edge.from.key)
  const existing = readTagLink(mediaType, mediaId, tagId, options)
  if (!existing) {
    if (mediaType === 'anime') {
      options.db.client
        .insert(animeTagLinks)
        .values({ animeId: mediaId, tagId, orderInAnime: edge.order ?? 0 })
        .run()
    } else {
      options.db.client
        .insert(gameTagLinks)
        .values({ gameId: mediaId, tagId, orderInGame: edge.order ?? 0 })
        .run()
    }
    return 'create'
  }

  if (edge.order !== undefined && existing.order !== edge.order) {
    if (mediaType === 'anime') {
      options.db.client
        .update(animeTagLinks)
        .set({ orderInAnime: edge.order })
        .where(and(eq(animeTagLinks.animeId, mediaId), eq(animeTagLinks.tagId, tagId)))
        .run()
    } else {
      options.db.client
        .update(gameTagLinks)
        .set({ orderInGame: edge.order })
        .where(and(eq(gameTagLinks.gameId, mediaId), eq(gameTagLinks.tagId, tagId)))
        .run()
    }
    return 'update'
  }

  return 'skip'
}

export function applyMediaCompanyEdge(
  edge: CompanyEdge,
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
  const companyId = requireEntityId(state, edge.to.kind, edge.to.key)
  const mediaType = state.mediaTypes.get(edge.from.key)
  const existing = readCompanyLink(mediaType, mediaId, companyId, edge.role, options)

  if (mediaType === 'anime') {
    const role = edge.role as LibraryAnimeCompanyRole
    const condition = and(
      eq(animeCompanyLinks.animeId, mediaId),
      eq(animeCompanyLinks.companyId, companyId),
      eq(animeCompanyLinks.type, role)
    )
    if (!existing) {
      options.db.client
        .insert(animeCompanyLinks)
        .values({ animeId: mediaId, companyId, type: role, orderInAnime: edge.order ?? 0 })
        .run()
      return 'create'
    }
    if (edge.order !== undefined && existing.order !== edge.order) {
      options.db.client
        .update(animeCompanyLinks)
        .set({ orderInAnime: edge.order })
        .where(condition)
        .run()
      return 'update'
    }
    return 'skip'
  }

  const role = edge.role as LibraryGameCompanyRole
  const condition = and(
    eq(gameCompanyLinks.gameId, mediaId),
    eq(gameCompanyLinks.companyId, companyId),
    eq(gameCompanyLinks.type, role)
  )
  if (!existing) {
    options.db.client
      .insert(gameCompanyLinks)
      .values({ gameId: mediaId, companyId, type: role, orderInGame: edge.order ?? 0 })
      .run()
    return 'create'
  }
  if (edge.order !== undefined && existing.order !== edge.order) {
    options.db.client.update(gameCompanyLinks).set({ orderInGame: edge.order }).where(condition).run()
    return 'update'
  }

  return 'skip'
}

export function applyMediaPersonEdge(
  edge: PersonEdge,
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
  const personId = requireEntityId(state, edge.to.kind, edge.to.key)
  const mediaType = state.mediaTypes.get(edge.from.key)
  const existing = readPersonLink(mediaType, mediaId, personId, edge.role, options)

  if (mediaType === 'anime') {
    const role = edge.role as LibraryAnimePersonRole
    const condition = and(
      eq(animePersonLinks.animeId, mediaId),
      eq(animePersonLinks.personId, personId),
      eq(animePersonLinks.type, role)
    )
    if (!existing) {
      options.db.client
        .insert(animePersonLinks)
        .values({
          animeId: mediaId,
          personId,
          type: role,
          note: edge.note,
          orderInAnime: edge.order ?? 0
        })
        .run()
      return 'create'
    }

    const patch = stripUndefined({
      orderInAnime: edge.order !== undefined && existing.order !== edge.order ? edge.order : undefined,
      note: edge.note !== undefined && existing.note !== edge.note ? edge.note : undefined
    })
    if (Object.keys(patch).length > 0) {
      options.db.client.update(animePersonLinks).set(patch).where(condition).run()
      return 'update'
    }
    return 'skip'
  }

  const role = edge.role as LibraryGamePersonRole
  const condition = and(
    eq(gamePersonLinks.gameId, mediaId),
    eq(gamePersonLinks.personId, personId),
    eq(gamePersonLinks.type, role)
  )
  if (!existing) {
    options.db.client
      .insert(gamePersonLinks)
      .values({
        gameId: mediaId,
        personId,
        type: role,
        note: edge.note,
        orderInGame: edge.order ?? 0
      })
      .run()
    return 'create'
  }

  const patch = stripUndefined({
    orderInGame: edge.order !== undefined && existing.order !== edge.order ? edge.order : undefined,
    note: edge.note !== undefined && existing.note !== edge.note ? edge.note : undefined
  })
  if (Object.keys(patch).length > 0) {
    options.db.client.update(gamePersonLinks).set(patch).where(condition).run()
    return 'update'
  }

  return 'skip'
}

function collectionMediaLink(
  mediaType: LibraryMediaType | undefined,
  options: ExecuteLibraryGraphOptions
): CollectionMediaLinkTable {
  if (mediaType === 'anime') {
    const condition = (animeId: string, collectionId: string): SQL =>
      and(
        eq(collectionAnimeLinks.collectionId, collectionId),
        eq(collectionAnimeLinks.animeId, animeId)
      ) as SQL

    return {
      read: (animeId, collectionId) =>
        options.db.client
          .select()
          .from(collectionAnimeLinks)
          .where(condition(animeId, collectionId))
          .get(),
      insert: (animeId, collectionId, order) => {
        options.db.client
          .insert(collectionAnimeLinks)
          .values({ collectionId, animeId, orderInCollection: order })
          .run()
      },
      update: (animeId, collectionId, order) => {
        options.db.client
          .update(collectionAnimeLinks)
          .set({ orderInCollection: order })
          .where(condition(animeId, collectionId))
          .run()
      }
    }
  }

  const condition = (gameId: string, collectionId: string): SQL =>
    and(
      eq(collectionGameLinks.collectionId, collectionId),
      eq(collectionGameLinks.gameId, gameId)
    ) as SQL

  return {
    read: (gameId, collectionId) =>
      options.db.client
        .select()
        .from(collectionGameLinks)
        .where(condition(gameId, collectionId))
        .get(),
    insert: (gameId, collectionId, order) => {
      options.db.client
        .insert(collectionGameLinks)
        .values({ collectionId, gameId, orderInCollection: order })
        .run()
    },
    update: (gameId, collectionId, order) => {
      options.db.client
        .update(collectionGameLinks)
        .set({ orderInCollection: order })
        .where(condition(gameId, collectionId))
        .run()
    }
  }
}

function readTagLink(
  mediaType: LibraryMediaType | undefined,
  mediaId: string,
  tagId: string,
  options: ExecuteLibraryGraphOptions
): { order: number } | undefined {
  if (mediaType === 'anime') {
    const row = options.db.client
      .select()
      .from(animeTagLinks)
      .where(and(eq(animeTagLinks.animeId, mediaId), eq(animeTagLinks.tagId, tagId)))
      .get()
    return row ? { order: row.orderInAnime } : undefined
  }

  const row = options.db.client
    .select()
    .from(gameTagLinks)
    .where(and(eq(gameTagLinks.gameId, mediaId), eq(gameTagLinks.tagId, tagId)))
    .get()
  return row ? { order: row.orderInGame } : undefined
}

function readCompanyLink(
  mediaType: LibraryMediaType | undefined,
  mediaId: string,
  companyId: string,
  role: LibraryAnimeCompanyRole | LibraryGameCompanyRole,
  options: ExecuteLibraryGraphOptions
): { order: number } | undefined {
  if (mediaType === 'anime') {
    const row = options.db.client
      .select()
      .from(animeCompanyLinks)
      .where(
        and(
          eq(animeCompanyLinks.animeId, mediaId),
          eq(animeCompanyLinks.companyId, companyId),
          eq(animeCompanyLinks.type, role as LibraryAnimeCompanyRole)
        )
      )
      .get()
    return row ? { order: row.orderInAnime } : undefined
  }

  const row = options.db.client
    .select()
    .from(gameCompanyLinks)
    .where(
      and(
        eq(gameCompanyLinks.gameId, mediaId),
        eq(gameCompanyLinks.companyId, companyId),
        eq(gameCompanyLinks.type, role as LibraryGameCompanyRole)
      )
    )
    .get()
  return row ? { order: row.orderInGame } : undefined
}

function readPersonLink(
  mediaType: LibraryMediaType | undefined,
  mediaId: string,
  personId: string,
  role: LibraryAnimePersonRole | LibraryGamePersonRole,
  options: ExecuteLibraryGraphOptions
): { order: number; note: string | null } | undefined {
  if (mediaType === 'anime') {
    const row = options.db.client
      .select()
      .from(animePersonLinks)
      .where(
        and(
          eq(animePersonLinks.animeId, mediaId),
          eq(animePersonLinks.personId, personId),
          eq(animePersonLinks.type, role as LibraryAnimePersonRole)
        )
      )
      .get()
    return row ? { order: row.orderInAnime, note: row.note } : undefined
  }

  const row = options.db.client
    .select()
    .from(gamePersonLinks)
    .where(
      and(
        eq(gamePersonLinks.gameId, mediaId),
        eq(gamePersonLinks.personId, personId),
        eq(gamePersonLinks.type, role as LibraryGamePersonRole)
      )
    )
    .get()
  return row ? { order: row.orderInGame, note: row.note } : undefined
}

function isEndpointFailed(edge: CollectionMediaEdge | RelationEdge, state: ApplyState): boolean {
  return (
    isEntityNodeFailed(state, edge.from.kind, edge.from.key) ||
    isEntityNodeFailed(state, edge.to.kind, edge.to.key)
  )
}
