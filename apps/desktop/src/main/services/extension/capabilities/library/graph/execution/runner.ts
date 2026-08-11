import type {
  LibraryGraphEdge,
  LibraryGraphResult,
  LibraryGraphResultAction
} from '@kisaki3/extension-api'
import type {
  LibraryGraphExecutionContext,
  LibraryGraphMatchSet,
  LibraryGraphResultDraft,
  NormalizedLibraryGraph
} from '../types'
import { applyEntityNodes, previewEntityNodes } from './entities'
import {
  applyAttachmentEdge,
  applyEpisodeAttachmentEdge,
  previewAttachmentEdge,
  previewEpisodeAttachmentEdge
} from './media'
import {
  applyEpisodeEdge,
  applyNoteEdge,
  applySessionEdge,
  previewEpisodeEdge,
  previewNoteEdge,
  previewSessionEdge
} from './owned-items'
import {
  applyCollectionMediaEdge,
  applyMediaCompanyEdge,
  applyMediaPersonEdge,
  applyMediaTagEdge,
  previewCollectionMediaEdge,
  previewRelationEdge
} from './relationships'
import {
  createApplyState,
  createDraft,
  finalizeAttachmentNodeResults,
  markUnownedNodes,
  pushEdgeResult,
  toGraphResult
} from './state'
import type { ApplyState, ExecuteLibraryGraphOptions } from './types'

export async function previewLibraryGraph(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  context: LibraryGraphExecutionContext,
  options: ExecuteLibraryGraphOptions
): Promise<LibraryGraphResult> {
  const draft = createDraft(graph)
  const state = createApplyState(graph)

  previewEntityNodes(graph, matches, draft, state)
  await previewEdges(graph, draft, state, options)
  finalizeAttachmentNodeResults(graph, draft, state)
  markUnownedNodes(graph, draft, state)

  return toGraphResult(graph, context, draft)
}

export async function applyLibraryGraph(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  context: LibraryGraphExecutionContext,
  options: ExecuteLibraryGraphOptions
): Promise<LibraryGraphResult> {
  const draft = createDraft(graph)
  const state = createApplyState(graph)

  applyEntityNodes(graph, matches, draft, state, options)
  await applyEdges(graph, draft, state, context, options)
  finalizeAttachmentNodeResults(graph, draft, state)
  markUnownedNodes(graph, draft, state)

  return toGraphResult(graph, context, draft)
}

async function previewEdges(
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): Promise<void> {
  for (const edge of graph.edges) {
    pushEdgeResult(draft, edge, await previewEdge(edge, graph, draft, state, options))
  }
}

async function applyEdges(
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  context: LibraryGraphExecutionContext,
  options: ExecuteLibraryGraphOptions
): Promise<void> {
  for (const edge of graph.edges) {
    if (context.signal?.aborted) {
      throw context.signal.reason ?? new Error('Library graph apply was aborted.')
    }

    pushEdgeResult(draft, edge, await applyEdge(edge, graph, draft, state, context, options))
  }
}

async function previewEdge(
  edge: LibraryGraphEdge,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): Promise<LibraryGraphResultAction> {
  switch (edge.kind) {
    case 'collection-media':
      return previewCollectionMediaEdge(edge, state, options)
    case 'media-tag':
    case 'media-company':
    case 'media-person':
      return previewRelationEdge(edge, state, options)
    case 'media-note':
      return previewNoteEdge(edge, graph, draft, state, options)
    case 'media-session':
      return previewSessionEdge(edge, graph, draft, state, options)
    case 'media-episode':
      return previewEpisodeEdge(edge, graph, draft, state, options)
    case 'media-attachment':
      return await previewAttachmentEdge(edge, graph, draft, state, options)
    case 'episode-attachment':
      return await previewEpisodeAttachmentEdge(edge, graph, draft, state, options)
  }
}

async function applyEdge(
  edge: LibraryGraphEdge,
  graph: NormalizedLibraryGraph,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  context: LibraryGraphExecutionContext,
  options: ExecuteLibraryGraphOptions
): Promise<LibraryGraphResultAction> {
  switch (edge.kind) {
    case 'collection-media':
      return applyCollectionMediaEdge(edge, state, options)
    case 'media-tag':
      return applyMediaTagEdge(edge, state, options)
    case 'media-company':
      return applyMediaCompanyEdge(edge, state, options)
    case 'media-person':
      return applyMediaPersonEdge(edge, state, options)
    case 'media-note':
      return await applyNoteEdge(edge, graph, draft, state, context, options)
    case 'media-session':
      return applySessionEdge(edge, graph, draft, state, options)
    case 'media-episode':
      return applyEpisodeEdge(edge, graph, draft, state, options)
    case 'media-attachment':
      return await applyAttachmentEdge(edge, graph, draft, state, context, options)
    case 'episode-attachment':
      return await applyEpisodeAttachmentEdge(edge, graph, draft, state, context, options)
  }
}
