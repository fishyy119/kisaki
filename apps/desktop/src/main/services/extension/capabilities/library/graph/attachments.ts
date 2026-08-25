import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { mkdir, rm, stat } from 'node:fs/promises'
import {
  createValidationError,
  type ExtensionRuntimeMetadata,
  type LibraryGraphAttachmentNode,
  type LibraryGraphDiagnostic,
  type LibraryGraphMediaAttachmentEdge,
  type SaveBackup
} from '@kisaki3/extension-api'
import { animeEpisodes, gameNotes } from '@shared/db'
import type { DbService } from '@main/services/db'
import { assertInsideAnyRoot } from '@shared/extension/path-confinement'
import { createDiagnostic } from './diagnostics'
import type { NormalizedLibraryGraph } from './types'

export function validateScopedGraphPaths(
  graph: NormalizedLibraryGraph,
  metadata: ExtensionRuntimeMetadata
): void {
  for (const entry of graph.nodes.attachments) {
    requireScopedGraphPath(metadata, entry.node.path, 'library.graph attachment path')
  }

  for (const entry of graph.nodes.notes) {
    const coverPath = entry.node.input.coverPath
    if (coverPath) {
      requireScopedGraphPath(metadata, coverPath, 'library.graph note coverPath')
    }
  }
}

export function requireScopedGraphPath(
  metadata: ExtensionRuntimeMetadata,
  sourcePath: string,
  label: string
): string {
  if (!path.isAbsolute(sourcePath)) {
    throw createValidationError(`${label} must be an absolute file path.`)
  }

  const candidate = path.resolve(sourcePath)
  assertInsideAnyRoot(
    candidate,
    [metadata.extensionPath, metadata.dataPath, metadata.tempPath],
    label
  )
  return candidate
}

export async function validateGraphFile(
  sourcePath: string,
  nodeKey: string
): Promise<LibraryGraphDiagnostic | null> {
  try {
    const stats = await stat(sourcePath)
    if (stats.isFile()) {
      return null
    }
  } catch {
    return createDiagnostic({
      level: 'warning',
      code: 'kisaki.graph.attachmentMissing',
      message: 'Attachment file was not found.',
      nodeKey
    })
  }

  return createDiagnostic({
    level: 'warning',
    code: 'kisaki.graph.attachmentInvalid',
    message: 'Attachment path does not point to a file.',
    nodeKey
  })
}

export async function persistNoteCover(
  db: DbService,
  noteId: string,
  coverPath: string,
  signal?: AbortSignal
): Promise<string> {
  return await db.attachment.setFile(
    gameNotes,
    noteId,
    'coverFile',
    { kind: 'path', path: coverPath },
    signal
  )
}

export async function persistEpisodeStill(
  db: DbService,
  episodeId: string,
  stillPath: string,
  signal?: AbortSignal
): Promise<string> {
  return await db.attachment.setFile(
    animeEpisodes,
    episodeId,
    'stillFile',
    { kind: 'path', path: stillPath },
    signal
  )
}

export async function persistSaveBackup(
  db: DbService,
  gameId: string,
  attachment: LibraryGraphAttachmentNode,
  edge: LibraryGraphMediaAttachmentEdge,
  signal?: AbortSignal
): Promise<SaveBackup> {
  if (!edge.saveBackup) {
    throw createValidationError('media-attachment save-backup edges require saveBackup metadata.')
  }

  throwIfAborted(signal)
  const sourcePath = path.resolve(attachment.path)
  const stats = await stat(sourcePath)
  if (!stats.isFile()) {
    throw createValidationError('Save backup attachment path must point to a file.')
  }

  const fileName = `${randomUUID()}${inferSafeExtension(attachment)}`
  const targetPath = db.attachment.getPath('games', gameId, fileName)
  await mkdir(path.dirname(targetPath), { recursive: true })

  try {
    throwIfAborted(signal)
    await pipeline(createReadStream(sourcePath), createWriteStream(targetPath), { signal })
    throwIfAborted(signal)
  } catch (error) {
    await rm(targetPath, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }

  return {
    backupAt: edge.saveBackup.backupAt,
    note: edge.saveBackup.note,
    locked: edge.saveBackup.locked,
    saveFile: fileName,
    sizeBytes: stats.size
  }
}

function inferSafeExtension(attachment: LibraryGraphAttachmentNode): string {
  const candidate = path.extname(attachment.fileName ?? attachment.path).toLowerCase()
  return /^\.[a-z0-9]{1,10}$/i.test(candidate) ? candidate : ''
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return
  }

  const error = new Error('Graph attachment operation aborted')
  error.name = 'AbortError'
  throw error
}
