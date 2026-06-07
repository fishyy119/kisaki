import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import PouchDB from 'pouchdb'
import type {
  LibraryGraphCapability,
  LibraryGraphInput,
  LibraryGraphNodeKind,
  LibraryGraphResult,
  LibraryGraphResultAction
} from '@kisaki3/extension-api'
import { VniteImportExecutor } from '../src/import'
import type { VniteBackupGame, VniteBackupSnapshot } from '../src/backup/types'
import { omitUndefined } from '../src/shared/object'
import { classifyVniteAttachment } from '../src/vnite/attachments'
import { createDefaultVniteGameDoc } from '../src/vnite/defaults'

async function main(): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'kisaki-vnite-import-executor-'))

  try {
    const backupRoot = path.join(tempRoot, 'backup')
    const workspace = {
      attachmentsPath: path.join(tempRoot, 'work', 'attachments')
    }
    await createGameDb(path.join(backupRoot, 'game'))
    const snapshot = createSnapshot(backupRoot)
    const calls: LibraryGraphInput[] = []
    const graph: LibraryGraphCapability = {
      preview: async (input) => {
        calls.push(input)
        await assertExportedAttachmentFiles(input)
        return createGraphResult(input, 'preview', 'create')
      },
      apply: async (input) => {
        calls.push(input)
        await assertExportedAttachmentFiles(input)
        return createGraphResult(input, 'apply', 'update')
      }
    }
    const executor = new VniteImportExecutor({ graph })
    let checkpoints = 0

    const preview = await executor.preview({
      snapshot,
      workspace,
      requestId: 'preview-test',
      checkpoint: async () => {
        checkpoints += 1
      }
    })
    assert.equal(preview.graph.mode, 'preview')
    assert.equal(preview.summary.counters.gamesCreated, 1)
    assert.equal(preview.summary.counters.attachmentsImported, 2)
    assert.equal(preview.exportedAttachments.length, 2)

    const apply = await executor.apply({
      snapshot,
      workspace,
      requestId: 'apply-test'
    })
    assert.equal(apply.graph.mode, 'apply')
    assert.equal(apply.summary.counters.gamesUpdated, 1)
    assert.equal(apply.summary.counters.attachmentsImported, 2)

    assert.equal(calls.length, 2)
    assert.ok(checkpoints > 0)
    assert.equal(calls[0]?.nodes.media?.length, 1)
    assert.equal(calls[0]?.nodes.attachments?.length, 2)
    assert.equal(calls[0]?.edges?.filter((edge) => edge.kind === 'media-attachment').length, 2)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function createGameDb(dbPath: string): Promise<void> {
  const db = new PouchDB(dbPath)

  try {
    const doc = createDefaultVniteGameDoc('game-alpha')
    doc.metadata.name = 'Alpha'
    await db.put(doc)
    await putAttachment(db, 'game-alpha', 'images/cover.webp', 'cover-alpha')
    await putAttachment(db, 'game-alpha', 'images/icon.webp', 'icon-alpha')
  } finally {
    await db.close()
  }
}

async function putAttachment(
  db: PouchDB.Database,
  docId: string,
  attachmentId: string,
  content: string
): Promise<void> {
  const doc = await db.get(docId)
  await db.putAttachment(docId, attachmentId, doc._rev, Buffer.from(content), 'image/webp')
}

function createSnapshot(rootPath: string): VniteBackupSnapshot {
  const doc = createDefaultVniteGameDoc('game-alpha')
  doc.metadata.name = 'Alpha'
  const game: VniteBackupGame = {
    id: 'game-alpha',
    doc,
    attachmentIds: ['images/cover.webp', 'images/icon.webp'],
    attachments: [
      classifyVniteAttachment('images/cover.webp', {
        content_type: 'image/webp',
        length: 'cover-alpha'.length
      }),
      classifyVniteAttachment('images/icon.webp', {
        content_type: 'image/webp',
        length: 'icon-alpha'.length
      })
    ],
    diagnostics: []
  }

  return {
    rootPath,
    games: [game],
    gameLocals: [],
    collections: [],
    diagnostics: [],
    readAt: Date.now()
  }
}

async function assertExportedAttachmentFiles(input: LibraryGraphInput): Promise<void> {
  const attachments = input.nodes.attachments ?? []
  assert.equal(attachments.length, 2)

  const contents = await Promise.all(
    attachments.map(async (attachment) => (await readFile(attachment.path)).toString('utf8'))
  )
  assert.deepEqual(contents.sort(), ['cover-alpha', 'icon-alpha'])
}

function createGraphResult(
  input: LibraryGraphInput,
  mode: LibraryGraphResult['mode'],
  action: LibraryGraphResultAction
): LibraryGraphResult {
  const startedAt = Date.now()
  const nodes = collectGraphNodes(input).map((node) =>
    omitUndefined({
      key: node.key,
      kind: node.kind,
      mediaType: node.kind === 'media' ? node.mediaType : undefined,
      entityId: node.kind === 'media' ? 'game-alpha-local' : undefined,
      action
    })
  )
  const edges = (input.edges ?? []).map((edge) => ({
    kind: edge.kind,
    fromKey: edge.from.key,
    toKey: edge.to.key,
    action
  }))

  return omitUndefined({
    requestId: input.requestId,
    mode,
    startedAt,
    finishedAt: Date.now(),
    nodes,
    edges,
    counters: {},
    diagnostics: input.diagnostics ?? []
  })
}

function collectGraphNodes(input: LibraryGraphInput): readonly {
  key: string
  kind: LibraryGraphNodeKind
  mediaType?: 'game'
}[] {
  return [
    ...(input.nodes.media ?? []),
    ...(input.nodes.collections ?? []),
    ...(input.nodes.tags ?? []),
    ...(input.nodes.companies ?? []),
    ...(input.nodes.people ?? []),
    ...(input.nodes.notes ?? []),
    ...(input.nodes.sessions ?? []),
    ...(input.nodes.attachments ?? [])
  ]
}

void main()
