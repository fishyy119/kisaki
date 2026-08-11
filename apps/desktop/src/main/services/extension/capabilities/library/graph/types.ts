import type {
  ExtensionRuntimeMetadata,
  LibraryAnime,
  LibraryCollection,
  LibraryCompany,
  LibraryGame,
  LibraryGraphAttachmentNode,
  LibraryGraphCollectionNode,
  LibraryGraphCompanyNode,
  LibraryGraphConflictMode,
  LibraryGraphDiagnostic,
  LibraryGraphEdge,
  LibraryGraphEdgeResult,
  LibraryGraphEpisodeNode,
  LibraryGraphInput,
  LibraryGraphMediaNode,
  LibraryGraphNodeKind,
  LibraryGraphNodeResult,
  LibraryGraphNoteNode,
  LibraryGraphPersonNode,
  LibraryGraphResultMode,
  LibraryGraphSessionNode,
  LibraryGraphTagNode,
  LibraryMediaType,
  LibraryPerson,
  LibraryTag
} from '@kisaki3/extension-api'

export type LibraryGraphNode =
  | LibraryGraphMediaNode
  | LibraryGraphCollectionNode
  | LibraryGraphTagNode
  | LibraryGraphCompanyNode
  | LibraryGraphPersonNode
  | LibraryGraphNoteNode
  | LibraryGraphSessionNode
  | LibraryGraphEpisodeNode
  | LibraryGraphAttachmentNode

export interface LibraryGraphNodeEntry<TNode extends LibraryGraphNode = LibraryGraphNode> {
  key: string
  kind: LibraryGraphNodeKind
  mediaType?: LibraryMediaType
  node: TNode
}

export interface NormalizedLibraryGraphOptions {
  conflictMode: LibraryGraphConflictMode
  strictAttachments: boolean
}

export interface NormalizedLibraryGraphNodes {
  all: readonly LibraryGraphNodeEntry[]
  byIdentity: ReadonlyMap<string, LibraryGraphNodeEntry>
  byKey: ReadonlyMap<string, LibraryGraphNodeEntry>
  media: readonly LibraryGraphNodeEntry<LibraryGraphMediaNode>[]
  collections: readonly LibraryGraphNodeEntry<LibraryGraphCollectionNode>[]
  tags: readonly LibraryGraphNodeEntry<LibraryGraphTagNode>[]
  companies: readonly LibraryGraphNodeEntry<LibraryGraphCompanyNode>[]
  people: readonly LibraryGraphNodeEntry<LibraryGraphPersonNode>[]
  notes: readonly LibraryGraphNodeEntry<LibraryGraphNoteNode>[]
  sessions: readonly LibraryGraphNodeEntry<LibraryGraphSessionNode>[]
  episodes: readonly LibraryGraphNodeEntry<LibraryGraphEpisodeNode>[]
  attachments: readonly LibraryGraphNodeEntry<LibraryGraphAttachmentNode>[]
}

export interface NormalizedLibraryGraph {
  input: LibraryGraphInput
  options: NormalizedLibraryGraphOptions
  nodes: NormalizedLibraryGraphNodes
  edges: readonly LibraryGraphEdge[]
  inputDiagnostics: readonly LibraryGraphDiagnostic[]
}

export type LibraryGraphEntity =
  | LibraryGame
  | LibraryAnime
  | LibraryCollection
  | LibraryTag
  | LibraryCompany
  | LibraryPerson

export type LibraryGraphMatchReason = 'externalId' | 'path' | 'name'

export interface LibraryGraphNodeMatch {
  key: string
  kind: LibraryGraphNodeKind
  mediaType?: LibraryMediaType
  entityId?: string
  existing?: LibraryGraphEntity
  reason?: LibraryGraphMatchReason
  blocked?: boolean
  diagnostics: LibraryGraphDiagnostic[]
}

export interface LibraryGraphMatchSet {
  byIdentity: Map<string, LibraryGraphNodeMatch>
}

export interface LibraryGraphExecutionContext {
  mode: LibraryGraphResultMode
  runtimeHandle: string
  metadata: ExtensionRuntimeMetadata
  startedAt: number
  signal?: AbortSignal
}

export interface LibraryGraphResultDraft {
  nodeResults: Map<string, LibraryGraphNodeResult>
  edgeResults: LibraryGraphEdgeResult[]
  diagnostics: LibraryGraphDiagnostic[]
}
