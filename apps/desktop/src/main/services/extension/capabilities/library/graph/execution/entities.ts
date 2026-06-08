import type {
  LibraryCollection,
  LibraryCompany,
  LibraryGame,
  LibraryGraphDiagnostic,
  LibraryPerson,
  LibraryTag
} from '@kisaki3/extension-api'
import { createDiagnostic } from '../diagnostics'
import { graphNodeIdentity } from '../identity'
import {
  type LibraryGraphMatchSet,
  type LibraryGraphNodeEntry,
  type LibraryGraphResultDraft,
  type NormalizedLibraryGraph
} from '../types'
import type { ApplyState, ExecuteLibraryGraphOptions } from './types'
import {
  buildCollectionPatch,
  buildCompanyPatch,
  buildGamePatch,
  buildPersonPatch,
  buildTagPatch,
  planCollectionAction,
  planGameAction,
  planRankedEntityAction,
  planTagAction
} from './patches'
import { setEntityNodeResult } from './state'

export function previewEntityNodes(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  draft: LibraryGraphResultDraft,
  state: ApplyState
): void {
  for (const entry of graph.nodes.media) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    const action = planGameAction(
      match?.existing as LibraryGame | undefined,
      entry.node.input,
      graph.options.conflictMode
    )
    setEntityNodeResult(draft, state, entry, action, match)
  }
  for (const entry of graph.nodes.collections) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    const action = planCollectionAction(
      match?.existing as LibraryCollection | undefined,
      entry.node.input,
      graph.options.conflictMode
    )
    setEntityNodeResult(draft, state, entry, action, match)
  }
  for (const entry of graph.nodes.tags) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    const action = planTagAction(
      match?.existing as LibraryTag | undefined,
      entry.node.input,
      graph.options.conflictMode
    )
    setEntityNodeResult(draft, state, entry, action, match)
  }
  for (const entry of graph.nodes.companies) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    const action = planRankedEntityAction(
      match?.existing as LibraryCompany | undefined,
      entry.node.input,
      graph.options.conflictMode
    )
    setEntityNodeResult(draft, state, entry, action, match)
  }
  for (const entry of graph.nodes.people) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    const action = planRankedEntityAction(
      match?.existing as LibraryPerson | undefined,
      entry.node.input,
      graph.options.conflictMode
    )
    setEntityNodeResult(draft, state, entry, action, match)
  }
}

export function applyEntityNodes(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): void {
  applyGameNodes(graph, matches, draft, state, options)
  applyCollectionNodes(graph, matches, draft, state, options)
  applyTagNodes(graph, matches, draft, state, options)
  applyCompanyNodes(graph, matches, draft, state, options)
  applyPersonNodes(graph, matches, draft, state, options)
}

function applyGameNodes(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): void {
  for (const entry of graph.nodes.media) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    try {
      const existing = match?.existing as LibraryGame | undefined
      if (!existing) {
        const entity = options.entities.createGame(entry.node.input)
        setEntityNodeResult(draft, state, entry, 'create', {
          entityId: entity.id,
          diagnostics: match?.diagnostics
        })
        continue
      }

      const patch = buildGamePatch(existing, entry.node.input, graph.options.conflictMode)
      const entity =
        Object.keys(patch).length > 0 ? options.entities.updateGame(existing.id, patch) : existing
      const action = Object.keys(patch).length > 0 ? 'update' : 'skip'
      setEntityNodeResult(draft, state, entry, action, {
        entityId: entity.id,
        diagnostics: match?.diagnostics
      })
    } catch (error) {
      setEntityWriteFailureResult(draft, state, entry, error, match?.diagnostics)
    }
  }
}

function applyCollectionNodes(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): void {
  for (const entry of graph.nodes.collections) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    try {
      const existing = match?.existing as LibraryCollection | undefined
      if (!existing) {
        const entity = options.entities.createCollection(entry.node.input)
        setEntityNodeResult(draft, state, entry, 'create', {
          entityId: entity.id,
          diagnostics: match?.diagnostics
        })
        continue
      }

      const patch = buildCollectionPatch(existing, entry.node.input, graph.options.conflictMode)
      const entity =
        Object.keys(patch).length > 0
          ? options.entities.updateCollection(existing.id, patch)
          : existing
      const action = Object.keys(patch).length > 0 ? 'update' : 'skip'
      setEntityNodeResult(draft, state, entry, action, {
        entityId: entity.id,
        diagnostics: match?.diagnostics
      })
    } catch (error) {
      setEntityWriteFailureResult(draft, state, entry, error, match?.diagnostics)
    }
  }
}

function applyTagNodes(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): void {
  for (const entry of graph.nodes.tags) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    try {
      const existing = match?.existing as LibraryTag | undefined
      if (!existing) {
        const entity = options.entities.createTag(entry.node.input)
        setEntityNodeResult(draft, state, entry, 'create', {
          entityId: entity.id,
          diagnostics: match?.diagnostics
        })
        continue
      }

      const patch = buildTagPatch(existing, entry.node.input, graph.options.conflictMode)
      const entity =
        Object.keys(patch).length > 0 ? options.entities.updateTag(existing.id, patch) : existing
      const action = Object.keys(patch).length > 0 ? 'update' : 'skip'
      setEntityNodeResult(draft, state, entry, action, {
        entityId: entity.id,
        diagnostics: match?.diagnostics
      })
    } catch (error) {
      setEntityWriteFailureResult(draft, state, entry, error, match?.diagnostics)
    }
  }
}

function applyCompanyNodes(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): void {
  for (const entry of graph.nodes.companies) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    try {
      const existing = match?.existing as LibraryCompany | undefined
      if (!existing) {
        const entity = options.entities.createCompany(entry.node.input)
        setEntityNodeResult(draft, state, entry, 'create', {
          entityId: entity.id,
          diagnostics: match?.diagnostics
        })
        continue
      }

      const patch = buildCompanyPatch(existing, entry.node.input, graph.options.conflictMode)
      const entity =
        Object.keys(patch).length > 0
          ? options.entities.updateCompany(existing.id, patch)
          : existing
      const action = Object.keys(patch).length > 0 ? 'update' : 'skip'
      setEntityNodeResult(draft, state, entry, action, {
        entityId: entity.id,
        diagnostics: match?.diagnostics
      })
    } catch (error) {
      setEntityWriteFailureResult(draft, state, entry, error, match?.diagnostics)
    }
  }
}

function applyPersonNodes(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): void {
  for (const entry of graph.nodes.people) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    try {
      const existing = match?.existing as LibraryPerson | undefined
      if (!existing) {
        const entity = options.entities.createPerson(entry.node.input)
        setEntityNodeResult(draft, state, entry, 'create', {
          entityId: entity.id,
          diagnostics: match?.diagnostics
        })
        continue
      }

      const patch = buildPersonPatch(existing, entry.node.input, graph.options.conflictMode)
      const entity =
        Object.keys(patch).length > 0 ? options.entities.updatePerson(existing.id, patch) : existing
      const action = Object.keys(patch).length > 0 ? 'update' : 'skip'
      setEntityNodeResult(draft, state, entry, action, {
        entityId: entity.id,
        diagnostics: match?.diagnostics
      })
    } catch (error) {
      setEntityWriteFailureResult(draft, state, entry, error, match?.diagnostics)
    }
  }
}

function setEntityWriteFailureResult(
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  entry: LibraryGraphNodeEntry,
  error: unknown,
  diagnostics: readonly LibraryGraphDiagnostic[] | undefined
): void {
  setEntityNodeResult(draft, state, entry, 'fail', {
    diagnostics: [...(diagnostics ?? []), createEntityWriteFailureDiagnostic(error, entry.key)]
  })
}

function createEntityWriteFailureDiagnostic(
  error: unknown,
  nodeKey: string
): LibraryGraphDiagnostic {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'Failed to write the library graph entity.'

  return createDiagnostic({
    level: 'error',
    code: 'kisaki.graph.entityWriteFailed',
    message,
    nodeKey
  })
}
