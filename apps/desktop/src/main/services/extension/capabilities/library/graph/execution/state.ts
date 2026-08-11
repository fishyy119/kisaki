import type {
  LibraryGraphAttachmentNode,
  LibraryGraphDiagnostic,
  LibraryGraphEdge,
  LibraryGraphEpisodeNode,
  LibraryGraphNodeKind,
  LibraryGraphNoteNode,
  LibraryGraphResult,
  LibraryGraphResultAction,
  LibraryGraphSessionNode
} from '@kisaki3/extension-api'
import { createDiagnostic } from '../diagnostics'
import { graphNodeIdentity } from '../identity'
import {
  createNodeResult,
  createResult,
  getNodeResult,
  mergeNodeAction,
  setNodeResult,
  toEdgeResult
} from '../results'
import {
  type LibraryGraphExecutionContext,
  type LibraryGraphNodeEntry,
  type LibraryGraphResultDraft,
  type NormalizedLibraryGraph
} from '../types'
import type { ApplyState } from './types'

export function createDraft(graph: NormalizedLibraryGraph): LibraryGraphResultDraft {
  return {
    nodeResults: new Map(),
    edgeResults: [],
    diagnostics: [...graph.inputDiagnostics]
  }
}

export function createApplyState(graph: NormalizedLibraryGraph): ApplyState {
  return {
    entityIds: new Map(),
    mediaTypes: new Map(graph.nodes.media.map((entry) => [entry.key, entry.node.mediaType])),
    failedNodes: new Set(),
    skippedMedia: new Set(),
    noteOwners: new Map(),
    sessionOwners: new Map(),
    episodeOwners: new Map(),
    attachmentActions: new Map(),
    attachmentDiagnostics: new Map()
  }
}

export function setEntityNodeResult(
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  entry: LibraryGraphNodeEntry,
  action: LibraryGraphResultAction,
  match: { entityId?: string; diagnostics?: readonly LibraryGraphDiagnostic[] } | undefined
): void {
  const entityId = match?.entityId
  if (entityId) {
    state.entityIds.set(graphNodeIdentity(entry.kind, entry.key), entityId)
  }
  if (action === 'fail') {
    state.failedNodes.add(graphNodeIdentity(entry.kind, entry.key))
  }
  if (entry.kind === 'media' && (action === 'skip' || action === 'fail')) {
    state.skippedMedia.add(entry.key)
  }
  if (match?.diagnostics?.length) {
    draft.diagnostics.push(...match.diagnostics)
  }

  setNodeResult(
    draft.nodeResults,
    createNodeResult({
      key: entry.key,
      kind: entry.kind,
      mediaType: entry.mediaType,
      entityId,
      action,
      diagnostics: match?.diagnostics
    })
  )
}

export function setOwnedNodeResult(
  draft: LibraryGraphResultDraft,
  entry: LibraryGraphNodeEntry,
  action: LibraryGraphResultAction,
  entityId?: string,
  diagnostics?: readonly LibraryGraphDiagnostic[]
): void {
  setNodeResult(
    draft.nodeResults,
    createNodeResult({
      key: entry.key,
      kind: entry.kind,
      mediaType: entry.mediaType,
      entityId,
      action,
      diagnostics
    })
  )
}

export function getEntityId(
  state: ApplyState,
  kind: LibraryGraphNodeKind,
  key: string
): string | undefined {
  return state.entityIds.get(graphNodeIdentity(kind, key))
}

export function requireEntityId(
  state: ApplyState,
  kind: LibraryGraphNodeKind,
  key: string
): string {
  const entityId = getEntityId(state, kind, key)
  if (!entityId) {
    throw new Error(`Graph node "${key}" did not resolve to an entity id.`)
  }
  return entityId
}

export function isEntityNodeFailed(
  state: ApplyState,
  kind: LibraryGraphNodeKind,
  key: string
): boolean {
  return state.failedNodes.has(graphNodeIdentity(kind, key))
}

export function pushEdgeResult(
  draft: LibraryGraphResultDraft,
  edge: LibraryGraphEdge,
  action: LibraryGraphResultAction
): void {
  draft.edgeResults.push(toEdgeResult(edge, action))
}

export function recordAttachmentAction(
  state: ApplyState,
  key: string,
  action: LibraryGraphResultAction
): void {
  state.attachmentActions.set(key, mergeNodeAction(state.attachmentActions.get(key), action))
}

export function recordAttachmentDiagnostic(
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  key: string,
  diagnostic: LibraryGraphDiagnostic
): void {
  draft.diagnostics.push(diagnostic)
  const diagnostics = state.attachmentDiagnostics.get(key) ?? []
  diagnostics.push(diagnostic)
  state.attachmentDiagnostics.set(key, diagnostics)
}

export function finalizeAttachmentNodeResults(
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState
): void {
  for (const entry of graph.nodes.attachments) {
    const action = state.attachmentActions.get(entry.key) ?? 'skip'
    const diagnostics = state.attachmentDiagnostics.get(entry.key)
    setNodeResult(
      draft.nodeResults,
      createNodeResult({
        key: entry.key,
        kind: 'attachment',
        action,
        diagnostics
      })
    )
  }
}

export function markUnownedNodes(
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState
): void {
  for (const entry of graph.nodes.notes) {
    if (!state.noteOwners.has(entry.key)) {
      const diagnostic = createDiagnostic({
        level: 'error',
        code: 'kisaki.graph.noteUnowned',
        message: 'Note nodes require a media-note edge.',
        nodeKey: entry.key
      })
      draft.diagnostics.push(diagnostic)
      setOwnedNodeResult(draft, entry, 'fail', undefined, [diagnostic])
    }
  }

  for (const entry of graph.nodes.sessions) {
    if (!state.sessionOwners.has(entry.key)) {
      const diagnostic = createDiagnostic({
        level: 'error',
        code: 'kisaki.graph.sessionUnowned',
        message: 'Session nodes require a media-session edge.',
        nodeKey: entry.key
      })
      draft.diagnostics.push(diagnostic)
      setOwnedNodeResult(draft, entry, 'fail', undefined, [diagnostic])
    }
  }

  for (const entry of graph.nodes.episodes) {
    if (!state.episodeOwners.has(entry.key)) {
      const diagnostic = createDiagnostic({
        level: 'error',
        code: 'kisaki.graph.episodeUnowned',
        message: 'Episode nodes require a media-episode edge.',
        nodeKey: entry.key
      })
      draft.diagnostics.push(diagnostic)
      setOwnedNodeResult(draft, entry, 'fail', undefined, [diagnostic])
    }
  }
}

export function toGraphResult(
  graph: NormalizedLibraryGraph,
  context: LibraryGraphExecutionContext,
  draft: LibraryGraphResultDraft
): LibraryGraphResult {
  const nodes = graph.nodes.all.map((entry) => {
    return (
      getNodeResult(draft.nodeResults, entry.kind, entry.key) ??
      createNodeResult({
        key: entry.key,
        kind: entry.kind,
        mediaType: entry.mediaType,
        action: 'skip'
      })
    )
  })

  return createResult({
    requestId: graph.input.requestId,
    mode: context.mode,
    startedAt: context.startedAt,
    finishedAt: Date.now(),
    nodes,
    edges: draft.edgeResults,
    diagnostics: draft.diagnostics
  })
}

export function requireNodeEntry(
  graph: NormalizedLibraryGraph,
  kind: 'note',
  key: string
): LibraryGraphNodeEntry<LibraryGraphNoteNode>
export function requireNodeEntry(
  graph: NormalizedLibraryGraph,
  kind: 'session',
  key: string
): LibraryGraphNodeEntry<LibraryGraphSessionNode>
export function requireNodeEntry(
  graph: NormalizedLibraryGraph,
  kind: 'episode',
  key: string
): LibraryGraphNodeEntry<LibraryGraphEpisodeNode>
export function requireNodeEntry(
  graph: NormalizedLibraryGraph,
  kind: 'attachment',
  key: string
): LibraryGraphNodeEntry<LibraryGraphAttachmentNode>
export function requireNodeEntry(
  graph: NormalizedLibraryGraph,
  kind: 'note' | 'session' | 'episode' | 'attachment',
  key: string
):
  | LibraryGraphNodeEntry<LibraryGraphNoteNode>
  | LibraryGraphNodeEntry<LibraryGraphSessionNode>
  | LibraryGraphNodeEntry<LibraryGraphEpisodeNode>
  | LibraryGraphNodeEntry<LibraryGraphAttachmentNode> {
  return graph.nodes.byIdentity.get(graphNodeIdentity(kind, key)) as
    | LibraryGraphNodeEntry<LibraryGraphNoteNode>
    | LibraryGraphNodeEntry<LibraryGraphSessionNode>
    | LibraryGraphNodeEntry<LibraryGraphEpisodeNode>
    | LibraryGraphNodeEntry<LibraryGraphAttachmentNode>
}
