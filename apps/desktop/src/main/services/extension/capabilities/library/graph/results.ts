import type {
  LibraryGraphEdge,
  LibraryGraphEdgeKind,
  LibraryGraphDiagnostic,
  LibraryGraphNodeKind,
  LibraryGraphNodeResult,
  LibraryGraphResult,
  LibraryGraphResultAction,
  LibraryGraphResultMode,
  LibraryMediaType
} from '@kisaki3/extension-api'
import { graphNodeIdentity } from './identity'

export function createNodeResult(input: {
  key: string
  kind: LibraryGraphNodeKind
  mediaType?: LibraryMediaType
  entityId?: string
  action: LibraryGraphResultAction
  diagnostics?: readonly LibraryGraphDiagnostic[]
}): LibraryGraphNodeResult {
  return {
    key: input.key,
    kind: input.kind,
    mediaType: input.mediaType,
    entityId: input.entityId,
    action: input.action,
    diagnostics: input.diagnostics?.length ? input.diagnostics : undefined
  }
}

export function setNodeResult(
  results: Map<string, LibraryGraphNodeResult>,
  result: LibraryGraphNodeResult
): void {
  results.set(graphNodeIdentity(result.kind, result.key), result)
}

export function getNodeResult(
  results: ReadonlyMap<string, LibraryGraphNodeResult>,
  kind: LibraryGraphNodeKind,
  key: string
): LibraryGraphNodeResult | undefined {
  return results.get(graphNodeIdentity(kind, key))
}

export function mergeNodeAction(
  current: LibraryGraphResultAction | undefined,
  next: LibraryGraphResultAction
): LibraryGraphResultAction {
  if (!current) {
    return next
  }
  if (current === 'fail' || next === 'fail') {
    return 'fail'
  }
  if (current === 'update' || next === 'update') {
    return 'update'
  }
  if (current === 'create' || next === 'create') {
    return 'create'
  }
  return 'skip'
}

export function createResult(input: {
  requestId?: string
  mode: LibraryGraphResultMode
  startedAt: number
  finishedAt: number
  nodes: readonly LibraryGraphNodeResult[]
  edges: LibraryGraphResult['edges']
  diagnostics: readonly LibraryGraphDiagnostic[]
}): LibraryGraphResult {
  const base = {
    requestId: input.requestId,
    mode: input.mode,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    nodes: input.nodes,
    edges: input.edges,
    diagnostics: input.diagnostics
  }

  return {
    ...base,
    counters: createCounters(base)
  }
}

export function toEdgeResult(
  edge: LibraryGraphEdge,
  action: LibraryGraphResultAction
): LibraryGraphResult['edges'][number] {
  return {
    kind: edge.kind as LibraryGraphEdgeKind,
    fromKey: edge.from.key,
    toKey: edge.to.key,
    action
  }
}

function createCounters(
  result: Pick<LibraryGraphResult, 'nodes' | 'edges' | 'diagnostics'>
): Record<string, number> {
  const counters: Record<string, number> = {
    nodesTotal: result.nodes.length,
    edgesTotal: result.edges.length,
    diagnosticsTotal: result.diagnostics.length
  }

  for (const node of result.nodes) {
    increment(counters, `nodes.${toResultActionName(node.action)}`)
    increment(counters, `${node.kind}.${toResultActionName(node.action)}`)
    if (node.mediaType) {
      increment(counters, `${node.mediaType}s.${toResultActionName(node.action)}`)
    }
  }

  for (const edge of result.edges) {
    increment(counters, `edges.${toResultActionName(edge.action)}`)
    increment(counters, `${edge.kind}.${toResultActionName(edge.action)}`)
  }

  for (const diagnostic of result.diagnostics) {
    increment(counters, `diagnostics.${diagnostic.level}`)
  }

  return counters
}

function toResultActionName(action: LibraryGraphResultAction): string {
  switch (action) {
    case 'create':
      return 'created'
    case 'update':
      return 'updated'
    case 'skip':
      return 'skipped'
    case 'fail':
      return 'failed'
  }
}

function increment(counters: Record<string, number>, key: string): void {
  counters[key] = (counters[key] ?? 0) + 1
}
