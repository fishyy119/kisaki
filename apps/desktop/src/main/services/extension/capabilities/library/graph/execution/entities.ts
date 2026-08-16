import type {
  LibraryAnime,
  LibraryCharacter,
  LibraryCollection,
  LibraryCompany,
  LibraryGame,
  LibraryGraphDiagnostic,
  LibraryGraphMediaNode,
  LibraryGraphResultAction,
  LibraryMovie,
  LibraryPerson,
  LibraryTag,
  LibraryTv
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
  buildAnimePatch,
  buildCharacterPatch,
  buildCollectionPatch,
  buildCompanyPatch,
  buildGamePatch,
  buildMoviePatch,
  buildPersonPatch,
  buildTagPatch,
  buildTvPatch,
  planAnimeAction,
  planCollectionAction,
  planGameAction,
  planMovieAction,
  planRankedEntityAction,
  planTagAction,
  planTvAction
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

    const action = planMediaAction(entry.node, match?.existing, graph.options.conflictMode)
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
  for (const entry of graph.nodes.characters) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    const action = planRankedEntityAction(
      match?.existing as LibraryCharacter | undefined,
      entry.node.input,
      graph.options.conflictMode
    )
    setEntityNodeResult(draft, state, entry, action, match)
  }
}

function planMediaAction(
  node: LibraryGraphMediaNode,
  existing: unknown,
  conflictMode: NormalizedLibraryGraph['options']['conflictMode']
): LibraryGraphResultAction {
  switch (node.mediaType) {
    case 'anime':
      return planAnimeAction(existing as LibraryAnime | undefined, node.input, conflictMode)
    case 'tv':
      return planTvAction(existing as LibraryTv | undefined, node.input, conflictMode)
    case 'movie':
      return planMovieAction(existing as LibraryMovie | undefined, node.input, conflictMode)
    case 'game':
      return planGameAction(existing as LibraryGame | undefined, node.input, conflictMode)
  }
}

export function applyEntityNodes(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): void {
  applyMediaNodes(graph, matches, draft, state, options)
  applyCollectionNodes(graph, matches, draft, state, options)
  applyTagNodes(graph, matches, draft, state, options)
  applyCompanyNodes(graph, matches, draft, state, options)
  applyPersonNodes(graph, matches, draft, state, options)
  applyCharacterNodes(graph, matches, draft, state, options)
}

function applyMediaNodes(
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
      const written = writeMediaNode(
        entry.node,
        match?.existing,
        graph.options.conflictMode,
        options
      )
      setEntityNodeResult(draft, state, entry, written.action, {
        entityId: written.entityId,
        diagnostics: match?.diagnostics
      })
    } catch (error) {
      setEntityWriteFailureResult(draft, state, entry, error, match?.diagnostics)
    }
  }
}

function writeMediaNode(
  node: LibraryGraphMediaNode,
  existingEntity: unknown,
  conflictMode: NormalizedLibraryGraph['options']['conflictMode'],
  options: ExecuteLibraryGraphOptions
): { entityId: string; action: 'create' | 'update' | 'skip' } {
  switch (node.mediaType) {
    case 'anime': {
      const existing = existingEntity as LibraryAnime | undefined
      if (!existing) {
        return { entityId: options.entities.createAnime(node.input).id, action: 'create' }
      }

      const patch = buildAnimePatch(existing, node.input, conflictMode)
      if (Object.keys(patch).length === 0) {
        return { entityId: existing.id, action: 'skip' }
      }
      return { entityId: options.entities.updateAnime(existing.id, patch).id, action: 'update' }
    }
    case 'tv': {
      const existing = existingEntity as LibraryTv | undefined
      if (!existing) {
        return { entityId: options.entities.createTv(node.input).id, action: 'create' }
      }

      const patch = buildTvPatch(existing, node.input, conflictMode)
      if (Object.keys(patch).length === 0) {
        return { entityId: existing.id, action: 'skip' }
      }
      return { entityId: options.entities.updateTv(existing.id, patch).id, action: 'update' }
    }
    case 'movie': {
      const existing = existingEntity as LibraryMovie | undefined
      if (!existing) {
        return { entityId: options.entities.createMovie(node.input).id, action: 'create' }
      }

      const patch = buildMoviePatch(existing, node.input, conflictMode)
      if (Object.keys(patch).length === 0) {
        return { entityId: existing.id, action: 'skip' }
      }
      return { entityId: options.entities.updateMovie(existing.id, patch).id, action: 'update' }
    }
    case 'game': {
      const existing = existingEntity as LibraryGame | undefined
      if (!existing) {
        return { entityId: options.entities.createGame(node.input).id, action: 'create' }
      }

      const patch = buildGamePatch(existing, node.input, conflictMode)
      if (Object.keys(patch).length === 0) {
        return { entityId: existing.id, action: 'skip' }
      }
      return { entityId: options.entities.updateGame(existing.id, patch).id, action: 'update' }
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

function applyCharacterNodes(
  graph: NormalizedLibraryGraph,
  matches: LibraryGraphMatchSet,
  draft: LibraryGraphResultDraft,
  state: ApplyState,
  options: ExecuteLibraryGraphOptions
): void {
  for (const entry of graph.nodes.characters) {
    const match = matches.byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    if (match?.blocked) {
      setEntityNodeResult(draft, state, entry, 'fail', match)
      continue
    }

    try {
      const existing = match?.existing as LibraryCharacter | undefined
      if (!existing) {
        const entity = options.entities.createCharacter(entry.node.input)
        setEntityNodeResult(draft, state, entry, 'create', {
          entityId: entity.id,
          diagnostics: match?.diagnostics
        })
        continue
      }

      const patch = buildCharacterPatch(existing, entry.node.input, graph.options.conflictMode)
      const entity =
        Object.keys(patch).length > 0
          ? options.entities.updateCharacter(existing.id, patch)
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
