import { and, eq } from 'drizzle-orm'
import type {
  LibraryGraphEdge,
  LibraryGraphNoteNode,
  LibraryGraphResultAction
} from '@kisaki3/extension-api'
import { gameNotes, gameSessions } from '@shared/db'
import { persistNoteCover } from '../attachments'
import { createAttachmentPersistDiagnostic } from '../diagnostics'
import { mergeNodeAction } from '../results'
import type {
  LibraryGraphExecutionContext,
  LibraryGraphNodeEntry,
  LibraryGraphResultDraft,
  NormalizedLibraryGraph
} from '../types'
import type { ApplyState, ExecuteLibraryGraphOptions } from './types'
import { shouldOverwriteValue, stripUndefined } from './patches'
import {
  getEntityId,
  requireEntityId,
  requireNodeEntry,
  setOwnedEntityId,
  setOwnedNodeResult
} from './state'

type NoteEdge = Extract<LibraryGraphEdge, { kind: 'media-note' }>
type SessionEdge = Extract<LibraryGraphEdge, { kind: 'media-session' }>
type EpisodeEdge = Extract<LibraryGraphEdge, { kind: 'media-episode' }>

export function previewNoteEdge(
  edge: NoteEdge,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  state.noteOwners.set(edge.to.key, edge.from.key)
  const noteEntry = requireNodeEntry(graph, 'note', edge.to.key)
  if (state.skippedMedia.has(edge.from.key)) {
    setOwnedNodeResult(draft, noteEntry, 'skip')
    return 'skip'
  }

  const gameId = getEntityId(state, edge.from.kind, edge.from.key)
  if (!gameId) {
    setOwnedNodeResult(draft, noteEntry, 'create')
    return 'create'
  }

  const existing = findNote(options.db, gameId, noteEntry.node.input.name)
  const action = existing ? 'skip' : 'create'
  setOwnedNodeResult(draft, noteEntry, action, existing?.id)
  return action
}

export function previewSessionEdge(
  edge: SessionEdge,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  state.sessionOwners.set(edge.to.key, edge.from.key)
  const sessionEntry = requireNodeEntry(graph, 'session', edge.to.key)
  if (state.skippedMedia.has(edge.from.key)) {
    setOwnedNodeResult(draft, sessionEntry, 'skip')
    return 'skip'
  }

  const gameId = getEntityId(state, edge.from.kind, edge.from.key)
  if (!gameId) {
    setOwnedNodeResult(draft, sessionEntry, 'create')
    return 'create'
  }

  const existing = findSession(
    options.db,
    gameId,
    sessionEntry.node.input.startedAt,
    sessionEntry.node.input.endedAt
  )
  const action = existing ? 'skip' : 'create'
  setOwnedNodeResult(draft, sessionEntry, action, existing?.id)
  return action
}

export function previewEpisodeEdge(
  edge: EpisodeEdge,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  state.episodeOwners.set(edge.to.key, edge.from.key)
  const episodeEntry = requireNodeEntry(graph, 'episode', edge.to.key)
  if (state.skippedMedia.has(edge.from.key)) {
    setOwnedNodeResult(draft, episodeEntry, 'skip')
    return 'skip'
  }

  const mediaId = getEntityId(state, edge.from.kind, edge.from.key)
  if (!mediaId) {
    setOwnedNodeResult(draft, episodeEntry, 'create')
    return 'create'
  }

  const existing = options.episodes.findMatch(mediaId, episodeEntry.node.input)
  const action = existing ? 'update' : 'create'
  setOwnedNodeResult(draft, episodeEntry, action, existing?.id)
  if (existing) {
    setOwnedEntityId(state, 'episode', edge.to.key, existing.id)
  }
  return action
}

export function applyEpisodeEdge(
  edge: EpisodeEdge,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  state.episodeOwners.set(edge.to.key, edge.from.key)
  const episodeEntry = requireNodeEntry(graph, 'episode', edge.to.key)
  if (state.skippedMedia.has(edge.from.key)) {
    setOwnedNodeResult(draft, episodeEntry, 'skip')
    return 'skip'
  }

  const mediaId = requireEntityId(state, edge.from.kind, edge.from.key)
  const input = episodeEntry.node.input
  const existing = options.episodes.findMatch(mediaId, input)
  const episode = existing
    ? options.episodes.update(existing.id, input)
    : options.episodes.create(mediaId, input)
  const action = existing ? 'update' : 'create'

  setOwnedEntityId(state, 'episode', edge.to.key, episode.id)
  setOwnedNodeResult(draft, episodeEntry, action, episode.id)
  return action
}

export async function applyNoteEdge(
  edge: NoteEdge,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  context: LibraryGraphExecutionContext,
  options: ExecuteLibraryGraphOptions
): Promise<LibraryGraphResultAction> {
  state.noteOwners.set(edge.to.key, edge.from.key)
  const noteEntry = requireNodeEntry(graph, 'note', edge.to.key)
  if (state.skippedMedia.has(edge.from.key)) {
    setOwnedNodeResult(draft, noteEntry, 'skip')
    return 'skip'
  }

  const gameId = requireEntityId(state, edge.from.kind, edge.from.key)
  const input = noteEntry.node.input
  const existing = findNote(options.db, gameId, input.name)
  const noteId =
    existing?.id ??
    options.db.client
      .insert(gameNotes)
      .values({
        gameId,
        name: input.name,
        content: input.content,
        orderInGame: input.order ?? 0,
        createdAt: input.createdAt === undefined ? undefined : new Date(input.createdAt),
        updatedAt: input.updatedAt === undefined ? undefined : new Date(input.updatedAt)
      })
      .returning({ id: gameNotes.id })
      .get().id

  let action: LibraryGraphResultAction = existing ? 'skip' : 'create'
  if (existing) {
    const patch = stripUndefined({
      content: shouldOverwriteValue(existing.content, input.content, graph.options.conflictMode)
        ? input.content
        : undefined,
      orderInGame:
        input.order !== undefined && existing.orderInGame !== input.order ? input.order : undefined
    })
    if (Object.keys(patch).length > 0) {
      options.db.client.update(gameNotes).set(patch).where(eq(gameNotes.id, existing.id)).run()
      action = 'update'
    }
  }

  if (input.coverPath) {
    try {
      await persistNoteCover(options.db, noteId, input.coverPath, context.signal)
      action = mergeNodeAction(action, existing ? 'update' : 'create')
    } catch (error) {
      return handleOwnedAttachmentFailure(
        error,
        edge.to.key,
        graph,
        draft,
        noteEntry,
        action,
        noteId
      )
    }
  }

  setOwnedNodeResult(draft, noteEntry, action, noteId)
  return action
}

export function applySessionEdge(
  edge: SessionEdge,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  state.sessionOwners.set(edge.to.key, edge.from.key)
  const sessionEntry = requireNodeEntry(graph, 'session', edge.to.key)
  if (state.skippedMedia.has(edge.from.key)) {
    setOwnedNodeResult(draft, sessionEntry, 'skip')
    return 'skip'
  }

  const gameId = requireEntityId(state, edge.from.kind, edge.from.key)
  const existing = findSession(
    options.db,
    gameId,
    sessionEntry.node.input.startedAt,
    sessionEntry.node.input.endedAt
  )
  if (existing) {
    setOwnedNodeResult(draft, sessionEntry, 'skip', existing.id)
    return 'skip'
  }

  const inserted = options.db.client
    .insert(gameSessions)
    .values({
      gameId,
      startedAt: new Date(sessionEntry.node.input.startedAt),
      endedAt: new Date(sessionEntry.node.input.endedAt)
    })
    .returning({ id: gameSessions.id })
    .get()
  setOwnedNodeResult(draft, sessionEntry, 'create', inserted.id)
  return 'create'
}

function findNote(
  db: ExecuteLibraryGraphOptions['db'],
  gameId: string,
  name: string
): typeof gameNotes.$inferSelect | undefined {
  return db.client
    .select()
    .from(gameNotes)
    .where(and(eq(gameNotes.gameId, gameId), eq(gameNotes.name, name)))
    .get()
}

function findSession(
  db: ExecuteLibraryGraphOptions['db'],
  gameId: string,
  startedAt: number,
  endedAt: number
): typeof gameSessions.$inferSelect | undefined {
  return db.client
    .select()
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.gameId, gameId),
        eq(gameSessions.startedAt, new Date(startedAt)),
        eq(gameSessions.endedAt, new Date(endedAt))
      )
    )
    .get()
}

function handleOwnedAttachmentFailure(
  error: unknown,
  nodeKey: string,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  noteEntry: LibraryGraphNodeEntry<LibraryGraphNoteNode>,
  currentAction: LibraryGraphResultAction,
  noteId: string
): LibraryGraphResultAction {
  const diagnostic = createAttachmentPersistDiagnostic(error, nodeKey)
  draft.diagnostics.push(diagnostic)
  const nextAction = graph.options.strictAttachments ? 'fail' : currentAction
  setOwnedNodeResult(draft, noteEntry, nextAction, noteId, [diagnostic])
  return nextAction
}
