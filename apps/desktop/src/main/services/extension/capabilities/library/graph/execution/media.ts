import { eq } from 'drizzle-orm'
import type {
  LibraryGraphAttachmentNode,
  LibraryGraphEdge,
  LibraryGraphMediaAttachmentEdge,
  LibraryGraphResultAction,
  LibraryMediaType
} from '@kisaki3/extension-api'
import { animeEpisodes, animes, comics, games, novels } from '@shared/db'
import type { DbService } from '@main/services/db'
import { persistEpisodeStill, persistSaveBackup, validateGraphFile } from '../attachments'
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

type EpisodeAttachmentEdge = Extract<LibraryGraphEdge, { kind: 'episode-attachment' }>

/** Slots that live on a media row column rather than in a list or backup set. */
type MediaFileSlot = Exclude<
  LibraryGraphMediaAttachmentEdge['slot'],
  'description-inline' | 'save-backup'
>

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
    const mediaId = requireEntityId(state, edge.from.kind, edge.from.key)
    if (edge.slot === 'save-backup') {
      await applySaveBackupAttachment(options.db, mediaId, attachment, edge, context.signal)
    } else {
      await options.attachments.put(
        context.runtimeHandle,
        {
          entity: { entityType: state.mediaTypes.get(edge.from.key) ?? 'game', id: mediaId },
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

export async function previewEpisodeAttachmentEdge(
  edge: EpisodeAttachmentEdge,
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

  const action = previewEpisodeStillAction(edge, graph, state, options)
  recordAttachmentAction(state, edge.to.key, action)
  return action
}

export async function applyEpisodeAttachmentEdge(
  edge: EpisodeAttachmentEdge,
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
    const actionOnMissing = graph.options.strictAttachments ? 'fail' : 'skip'
    recordAttachmentAction(state, edge.to.key, actionOnMissing)
    return actionOnMissing
  }

  const action = previewEpisodeStillAction(edge, graph, state, options)
  if (action === 'skip') {
    recordAttachmentAction(state, edge.to.key, 'skip')
    return 'skip'
  }

  try {
    const episodeId = requireEntityId(state, edge.from.kind, edge.from.key)
    await persistEpisodeStill(options.db, episodeId, attachment.path, context.signal)
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

  const mediaId = getEntityId(state, edge.from.kind, edge.from.key)
  if (!mediaId) {
    return 'create'
  }

  const mediaType = state.mediaTypes.get(edge.from.key) ?? 'game'
  const media = readMediaRow(mediaType, mediaId, options)
  if (!media) {
    return 'fail'
  }

  if (edge.slot === 'save-backup') {
    const backupAt = edge.saveBackup?.backupAt
    return backupAt !== undefined &&
      (media.saveBackups ?? []).some((backup) => backup.backupAt === backupAt)
      ? 'skip'
      : 'create'
  }

  if (edge.slot === 'description-inline') {
    return shouldReplaceAttachment(edge.replace, conflictMode) ||
      media.descriptionInlineFiles.length === 0
      ? 'create'
      : 'skip'
  }

  const currentFile = media.files[edge.slot as MediaFileSlot]
  if (!currentFile) {
    return 'create'
  }
  return shouldReplaceAttachment(edge.replace, conflictMode) ? 'update' : 'skip'
}

function previewEpisodeStillAction(
  edge: EpisodeAttachmentEdge,
  graph: NormalizedLibraryGraph,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): LibraryGraphResultAction {
  const episodeId = getEntityId(state, edge.from.kind, edge.from.key)
  if (!episodeId) {
    return 'create'
  }

  const episode = options.db.client
    .select({ stillFile: animeEpisodes.stillFile })
    .from(animeEpisodes)
    .where(eq(animeEpisodes.id, episodeId))
    .get()
  if (!episode) {
    return 'fail'
  }
  if (!episode.stillFile) {
    return 'create'
  }
  return shouldReplaceAttachment(edge.replace, graph.options.conflictMode) ? 'update' : 'skip'
}

interface MediaAttachmentRow {
  files: Partial<Record<MediaFileSlot, string | null>>
  descriptionInlineFiles: readonly string[]
  saveBackups?: readonly { backupAt: number }[]
}

function readMediaRow(
  mediaType: LibraryMediaType,
  mediaId: string,
  options: ExecuteLibraryGraphOptions
): MediaAttachmentRow | undefined {
  switch (mediaType) {
    case 'anime': {
      const row = options.db.client.select().from(animes).where(eq(animes.id, mediaId)).get()
      return row
        ? {
            files: { cover: row.coverFile, backdrop: row.backdropFile, logo: row.logoFile },
            descriptionInlineFiles: row.descriptionInlineFiles ?? []
          }
        : undefined
    }
    case 'game': {
      const row = options.db.client.select().from(games).where(eq(games.id, mediaId)).get()
      return row
        ? {
            files: {
              cover: row.coverFile,
              backdrop: row.backdropFile,
              logo: row.logoFile,
              icon: row.iconFile
            },
            descriptionInlineFiles: row.descriptionInlineFiles ?? [],
            saveBackups: row.saveBackups ?? []
          }
        : undefined
    }
    case 'comic': {
      const row = options.db.client.select().from(comics).where(eq(comics.id, mediaId)).get()
      return row
        ? {
            files: { cover: row.coverFile, backdrop: row.backdropFile, logo: row.logoFile },
            descriptionInlineFiles: row.descriptionInlineFiles ?? []
          }
        : undefined
    }
    case 'novel': {
      const row = options.db.client.select().from(novels).where(eq(novels.id, mediaId)).get()
      return row
        ? {
            files: { cover: row.coverFile, backdrop: row.backdropFile, logo: row.logoFile },
            descriptionInlineFiles: row.descriptionInlineFiles ?? []
          }
        : undefined
    }
  }
}
