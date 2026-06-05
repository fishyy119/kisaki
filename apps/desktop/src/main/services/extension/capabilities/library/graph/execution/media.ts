import { eq } from 'drizzle-orm'
import type {
  LibraryGraphAttachmentNode,
  LibraryGraphMediaAttachmentEdge,
  LibraryGraphResultAction
} from '@kisaki3/extension-api'
import { games } from '@shared/db'
import type { DbService } from '@main/services/db'
import { persistSaveBackup, validateGraphFile } from '../attachments'
import { createAttachmentPersistDiagnostic } from '../diagnostics'
import type {
  LibraryGraphExecutionContext,
  LibraryGraphResultDraft,
  NormalizedLibraryGraph
} from '../types'
import { shouldReplaceAttachment } from './patches'
import {
  getEntityId,
  recordAttachmentAction,
  recordAttachmentDiagnostic,
  requireEntityId,
  requireNodeEntry
} from './state'
import type { ApplyState, ExecuteLibraryGraphOptions } from './types'

export async function previewAttachmentEdge(
  edge: LibraryGraphMediaAttachmentEdge,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): Promise<LibraryGraphResultAction> {
  const attachment = requireNodeEntry(graph, 'attachment', edge.to.key).node
  const fileDiagnostic = await validateGraphFile(attachment.path, edge.to.key)
  if (fileDiagnostic) {
    recordAttachmentDiagnostic(draft, state, edge.to.key, fileDiagnostic)
    if (graph.options.strictAttachments) {
      recordAttachmentAction(state, edge.to.key, 'fail')
      return 'fail'
    }
  }

  const action = previewAttachmentAction(edge, graph.options.conflictMode, state, options)
  recordAttachmentAction(state, edge.to.key, action)
  return action
}

export async function applyAttachmentEdge(
  edge: LibraryGraphMediaAttachmentEdge,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  context: LibraryGraphExecutionContext,
  options: ExecuteLibraryGraphOptions
): Promise<LibraryGraphResultAction> {
  const attachment = requireNodeEntry(graph, 'attachment', edge.to.key).node
  const fileDiagnostic = await validateGraphFile(attachment.path, edge.to.key)
  if (fileDiagnostic) {
    recordAttachmentDiagnostic(draft, state, edge.to.key, fileDiagnostic)
    if (graph.options.strictAttachments) {
      recordAttachmentAction(state, edge.to.key, 'fail')
      return 'fail'
    }
    recordAttachmentAction(state, edge.to.key, 'skip')
    return 'skip'
  }

  const action = previewAttachmentAction(edge, graph.options.conflictMode, state, options)
  if (action === 'skip') {
    recordAttachmentAction(state, edge.to.key, 'skip')
    return 'skip'
  }

  try {
    const gameId = requireEntityId(state, edge.from.kind, edge.from.key)
    if (edge.slot === 'save-backup') {
      await applySaveBackupAttachment(options.db, gameId, attachment, edge, context.signal)
    } else {
      await options.attachments.put(
        context.runtimeHandle,
        {
          entity: { entityType: 'game', id: gameId },
          slot: edge.slot,
          source: { kind: 'path', path: attachment.path },
          replace: shouldReplaceAttachment(edge.replace, graph.options.conflictMode)
        },
        context.signal
      )
    }
    recordAttachmentAction(state, edge.to.key, action)
    return action
  } catch (error) {
    const diagnostic = createAttachmentPersistDiagnostic(error, edge.to.key)
    recordAttachmentDiagnostic(draft, state, edge.to.key, diagnostic)
    const actionOnError = graph.options.strictAttachments ? 'fail' : 'skip'
    recordAttachmentAction(state, edge.to.key, actionOnError)
    return actionOnError
  }
}

async function applySaveBackupAttachment(
  db: DbService,
  gameId: string,
  attachment: LibraryGraphAttachmentNode,
  edge: LibraryGraphMediaAttachmentEdge,
  signal?: AbortSignal
): Promise<void> {
  const current = db.client.select().from(games).where(eq(games.id, gameId)).get()
  if (!current) {
    throw new Error('Game was not found for save backup attachment.')
  }

  const backups = current.saveBackups ?? []
  if (edge.saveBackup && backups.some((backup) => backup.backupAt === edge.saveBackup?.backupAt)) {
    return
  }

  const backup = await persistSaveBackup(db, gameId, attachment, edge, signal)
  db.client
    .update(games)
    .set({ saveBackups: [...backups, backup].sort((a, b) => a.backupAt - b.backupAt) })
    .where(eq(games.id, gameId))
    .run()
}

function previewAttachmentAction(
  edge: LibraryGraphMediaAttachmentEdge,
  conflictMode: NormalizedLibraryGraph['options']['conflictMode'],
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  if (state.skippedMedia.has(edge.from.key)) {
    return 'skip'
  }

  const gameId = getEntityId(state, edge.from.kind, edge.from.key)
  if (!gameId) {
    return 'create'
  }

  const game = options.db.client.select().from(games).where(eq(games.id, gameId)).get()
  if (!game) {
    return 'fail'
  }

  if (edge.slot === 'save-backup') {
    const backupAt = edge.saveBackup?.backupAt
    return backupAt !== undefined &&
      (game.saveBackups ?? []).some((backup) => backup.backupAt === backupAt)
      ? 'skip'
      : 'create'
  }

  if (edge.slot === 'description-inline') {
    return shouldReplaceAttachment(edge.replace, conflictMode) ||
      (game.descriptionInlineFiles ?? []).length === 0
      ? 'create'
      : 'skip'
  }

  const currentFile = readGameAttachmentSlot(game, edge.slot)
  if (!currentFile) {
    return 'create'
  }
  return shouldReplaceAttachment(edge.replace, conflictMode) ? 'update' : 'skip'
}

function readGameAttachmentSlot(
  game: typeof games.$inferSelect,
  slot: Exclude<LibraryGraphMediaAttachmentEdge['slot'], 'description-inline' | 'save-backup'>
): string | undefined {
  switch (slot) {
    case 'cover':
      return game.coverFile ?? undefined
    case 'backdrop':
      return game.backdropFile ?? undefined
    case 'logo':
      return game.logoFile ?? undefined
    case 'icon':
      return game.iconFile ?? undefined
  }
}
