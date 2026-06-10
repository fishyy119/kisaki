import type {
  LibraryGraphDiagnostic,
  LibraryGraphResult,
  LibraryGraphResultAction
} from '@kisaki3/extension-api'
import type { VniteBackupGame, VniteBackupSnapshot, VniteImportDiagnostic } from '../backup/types'
import { omitUndefined } from '../shared/object'
import { createVniteExtraNoteNodeKey, createVniteGameNodeKey } from '../mapping'

// Type alias keeps the implicit index signature so counters stay assignable
// to both Record<string, number> and the JsonValue task-run output contract.
export type VniteImportExecutionCounters = {
  gamesTotal: number
  gamesCreated: number
  gamesUpdated: number
  gamesSkipped: number
  gamesFailed: number
  collectionsCreated: number
  collectionsUpdated: number
  attachmentsImported: number
  attachmentsFailed: number
  completionCompleted: number
  completionFailed: number
  errors: number
  warnings: number
}

export interface VniteImportExecutionSummary {
  mode: LibraryGraphResult['mode']
  requestId?: string
  startedAt: number
  finishedAt: number
  counters: VniteImportExecutionCounters
  diagnostics: readonly VniteImportDiagnostic[]
}

// Type alias keeps the implicit index signature so the summary satisfies the
// JsonValue task-run output contract without widening property reads.
export type VniteImportJobSummary = {
  fileName: string
  startedAt: number
  finishedAt: number
  counters: VniteImportExecutionCounters
  diagnostics: readonly VniteImportDiagnostic[]
}

export function createVniteImportExecutionSummary(input: {
  graph: LibraryGraphResult
  snapshot: VniteBackupSnapshot
}): VniteImportExecutionSummary {
  const diagnostics = toVniteImportDiagnostics(input.graph, input.snapshot)

  return omitUndefined({
    mode: input.graph.mode,
    requestId: input.graph.requestId,
    startedAt: input.graph.startedAt,
    finishedAt: input.graph.finishedAt,
    counters: createVniteImportExecutionCounters(input.graph, diagnostics),
    diagnostics
  })
}

export function createVniteImportJobSummary(input: {
  fileName: string
  startedAt: number
  executionSummary: VniteImportExecutionSummary
  diagnostics?: readonly VniteImportDiagnostic[]
}): VniteImportJobSummary {
  const diagnostics = [...input.executionSummary.diagnostics, ...(input.diagnostics ?? [])]

  return {
    fileName: input.fileName,
    startedAt: input.startedAt,
    finishedAt: Date.now(),
    counters: {
      ...input.executionSummary.counters,
      errors: diagnostics.filter((diagnostic) => diagnostic.level === 'error').length,
      warnings: diagnostics.filter((diagnostic) => diagnostic.level === 'warning').length
    },
    diagnostics
  }
}

export function createVniteImportExecutionCounters(
  graph: LibraryGraphResult,
  diagnostics: readonly VniteImportDiagnostic[]
): VniteImportExecutionCounters {
  const gameNodes = graph.nodes.filter((node) => node.kind === 'media' && node.mediaType === 'game')
  const collectionNodes = graph.nodes.filter((node) => node.kind === 'collection')
  const attachmentNodes = graph.nodes.filter((node) => node.kind === 'attachment')

  return {
    gamesTotal: gameNodes.length,
    gamesCreated: countActions(gameNodes, 'create'),
    gamesUpdated: countActions(gameNodes, 'update'),
    gamesSkipped: countActions(gameNodes, 'skip'),
    gamesFailed: countActions(gameNodes, 'fail'),
    collectionsCreated: countActions(collectionNodes, 'create'),
    collectionsUpdated: countActions(collectionNodes, 'update'),
    attachmentsImported:
      countActions(attachmentNodes, 'create') + countActions(attachmentNodes, 'update'),
    attachmentsFailed: countActions(attachmentNodes, 'fail'),
    completionCompleted: 0,
    completionFailed: 0,
    errors: diagnostics.filter((diagnostic) => diagnostic.level === 'error').length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.level === 'warning').length
  }
}

export function toVniteImportDiagnostics(
  graph: LibraryGraphResult,
  snapshot: VniteBackupSnapshot
): readonly VniteImportDiagnostic[] {
  const games = [...snapshot.games].sort((left, right) => right.id.length - left.id.length)
  return collectLibraryGraphDiagnostics(graph).map((diagnostic) =>
    toVniteImportDiagnostic(diagnostic, games)
  )
}

export function collectLibraryGraphDiagnostics(
  graph: LibraryGraphResult
): readonly LibraryGraphDiagnostic[] {
  return dedupeLibraryGraphDiagnostics([
    ...graph.diagnostics,
    ...graph.nodes.flatMap((node) => node.diagnostics ?? []),
    ...graph.edges.flatMap((edge) => edge.diagnostics ?? [])
  ])
}

function dedupeLibraryGraphDiagnostics(
  diagnostics: readonly LibraryGraphDiagnostic[]
): readonly LibraryGraphDiagnostic[] {
  const seen = new Set<string>()
  const result: LibraryGraphDiagnostic[] = []

  for (const diagnostic of diagnostics) {
    const key = [
      diagnostic.level,
      diagnostic.code,
      diagnostic.message,
      diagnostic.nodeKey ?? '',
      diagnostic.edgeKind ?? ''
    ].join('\u0000')
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(diagnostic)
  }

  return result
}

function countActions(
  items: readonly { action: LibraryGraphResultAction }[],
  action: LibraryGraphResultAction
): number {
  return items.filter((item) => item.action === action).length
}

function toVniteImportDiagnostic(
  diagnostic: LibraryGraphDiagnostic,
  games: readonly VniteBackupGame[]
): VniteImportDiagnostic {
  const game = diagnostic.nodeKey ? resolveGameFromNodeKey(diagnostic.nodeKey, games) : undefined

  return omitUndefined({
    level: diagnostic.level,
    code: diagnostic.code,
    message: diagnostic.message,
    itemKey: diagnostic.nodeKey,
    vniteGameId: game?.id,
    vniteGameName: game ? readGameName(game) : undefined
  })
}

function resolveGameFromNodeKey(
  nodeKey: string,
  games: readonly VniteBackupGame[]
): VniteBackupGame | undefined {
  for (const game of games) {
    const gameScopedPrefixes = [
      `vnite:attachment:${game.id}:`,
      `vnite:company:${game.id}:`,
      `vnite:person:${game.id}:`,
      `vnite:note:memory:${game.id}:`,
      `vnite:session:${game.id}:`
    ]

    if (
      nodeKey === createVniteGameNodeKey(game.id) ||
      nodeKey === createVniteExtraNoteNodeKey(game.id) ||
      gameScopedPrefixes.some((prefix) => nodeKey.startsWith(prefix))
    ) {
      return game
    }
  }

  return undefined
}

function readGameName(game: VniteBackupGame): string {
  return game.doc.metadata.name || game.doc.metadata.originalName || game.id
}
