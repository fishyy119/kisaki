import type {
  LibraryCollectionCreateInput,
  LibraryCompanyCreateInput,
  LibraryGameCreateInput,
  LibraryGameNoteCreateInput,
  LibraryGameSessionCreateInput,
  LibraryPersonCreateInput,
  LibraryTagCreateInput
} from './entities'
import type { LibraryGameCompanyRole, LibraryGamePersonRole } from '../../shared/library'

export const LIBRARY_MEDIA_TYPES = ['game'] as const

export type LibraryMediaType = (typeof LIBRARY_MEDIA_TYPES)[number]

export const LIBRARY_GRAPH_CONFLICT_MODES = [
  'skipExisting',
  'mergeSelected',
  'overwriteSelected'
] as const

export type LibraryGraphConflictMode = (typeof LIBRARY_GRAPH_CONFLICT_MODES)[number]

export const LIBRARY_GRAPH_NODE_KINDS = [
  'media',
  'collection',
  'tag',
  'company',
  'person',
  'note',
  'session',
  'attachment'
] as const

export type LibraryGraphNodeKind = (typeof LIBRARY_GRAPH_NODE_KINDS)[number]

export const LIBRARY_GRAPH_EDGE_KINDS = [
  'collection-media',
  'media-tag',
  'media-company',
  'media-person',
  'media-note',
  'media-session',
  'media-attachment'
] as const

export type LibraryGraphEdgeKind = (typeof LIBRARY_GRAPH_EDGE_KINDS)[number]

export const LIBRARY_GRAPH_ATTACHMENT_SLOTS = [
  'cover',
  'backdrop',
  'logo',
  'icon',
  'description-inline',
  'save-backup'
] as const

export type LibraryGraphAttachmentSlot = (typeof LIBRARY_GRAPH_ATTACHMENT_SLOTS)[number]

export const LIBRARY_GRAPH_RESULT_MODES = ['preview', 'apply'] as const

export type LibraryGraphResultMode = (typeof LIBRARY_GRAPH_RESULT_MODES)[number]

export const LIBRARY_GRAPH_RESULT_ACTIONS = ['create', 'update', 'skip', 'fail'] as const

export type LibraryGraphResultAction = (typeof LIBRARY_GRAPH_RESULT_ACTIONS)[number]

export const LIBRARY_GRAPH_DIAGNOSTIC_LEVELS = ['info', 'warning', 'error'] as const

export type LibraryGraphDiagnosticLevel = (typeof LIBRARY_GRAPH_DIAGNOSTIC_LEVELS)[number]

export interface LibraryGraphCapability {
  preview(input: LibraryGraphInput): Promise<LibraryGraphResult>
  apply(input: LibraryGraphInput): Promise<LibraryGraphResult>
}

export interface LibraryGraphInput {
  requestId?: string
  options?: LibraryGraphOptions
  nodes: LibraryGraphNodes
  edges?: readonly LibraryGraphEdge[]
  diagnostics?: readonly LibraryGraphDiagnostic[]
}

export interface LibraryGraphOptions {
  conflictMode?: LibraryGraphConflictMode
  strictAttachments?: boolean
}

export interface LibraryGraphNodes {
  media?: readonly LibraryGraphMediaNode[]
  collections?: readonly LibraryGraphCollectionNode[]
  tags?: readonly LibraryGraphTagNode[]
  companies?: readonly LibraryGraphCompanyNode[]
  people?: readonly LibraryGraphPersonNode[]
  notes?: readonly LibraryGraphNoteNode[]
  sessions?: readonly LibraryGraphSessionNode[]
  attachments?: readonly LibraryGraphAttachmentNode[]
}

export interface LibraryGraphNodeBase {
  key: string
}

export type LibraryGraphMediaNode = LibraryGraphGameNode

export interface LibraryGraphGameNode extends LibraryGraphNodeBase {
  kind: 'media'
  mediaType: 'game'
  input: LibraryGameCreateInput
}

export interface LibraryGraphCollectionNode extends LibraryGraphNodeBase {
  kind: 'collection'
  input: LibraryCollectionCreateInput
}

export interface LibraryGraphTagNode extends LibraryGraphNodeBase {
  kind: 'tag'
  input: LibraryTagCreateInput
}

export interface LibraryGraphCompanyNode extends LibraryGraphNodeBase {
  kind: 'company'
  input: LibraryCompanyCreateInput
}

export interface LibraryGraphPersonNode extends LibraryGraphNodeBase {
  kind: 'person'
  input: LibraryPersonCreateInput
}

export interface LibraryGraphNoteNode extends LibraryGraphNodeBase {
  kind: 'note'
  input: LibraryGameNoteCreateInput
}

export interface LibraryGraphSessionNode extends LibraryGraphNodeBase {
  kind: 'session'
  input: LibraryGameSessionCreateInput
}

export interface LibraryGraphAttachmentNode extends LibraryGraphNodeBase {
  kind: 'attachment'
  path: string
  fileName?: string
  contentType?: string
}

export interface LibraryGraphNodeRef {
  kind: LibraryGraphNodeKind
  key: string
}

export type LibraryGraphEdge =
  | LibraryGraphCollectionMediaEdge
  | LibraryGraphMediaTagEdge
  | LibraryGraphMediaCompanyEdge
  | LibraryGraphMediaPersonEdge
  | LibraryGraphMediaNoteEdge
  | LibraryGraphMediaSessionEdge
  | LibraryGraphMediaAttachmentEdge

export interface LibraryGraphCollectionMediaEdge {
  kind: 'collection-media'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  order?: number
}

export interface LibraryGraphMediaTagEdge {
  kind: 'media-tag'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  order?: number
}

export interface LibraryGraphMediaCompanyEdge {
  kind: 'media-company'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  role: LibraryGameCompanyRole
  order?: number
}

export interface LibraryGraphMediaPersonEdge {
  kind: 'media-person'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  role: LibraryGamePersonRole
  order?: number
  note?: string
}

export interface LibraryGraphMediaNoteEdge {
  kind: 'media-note'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
}

export interface LibraryGraphMediaSessionEdge {
  kind: 'media-session'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
}

export interface LibraryGraphMediaAttachmentEdge {
  kind: 'media-attachment'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  slot: LibraryGraphAttachmentSlot
  replace?: boolean
  saveBackup?: LibraryGraphSaveBackupInput
}

export interface LibraryGraphSaveBackupInput {
  backupAt: number
  note: string
  locked: boolean
}

export interface LibraryGraphResult {
  requestId?: string
  mode: LibraryGraphResultMode
  startedAt: number
  finishedAt: number
  nodes: readonly LibraryGraphNodeResult[]
  edges: readonly LibraryGraphEdgeResult[]
  counters: Record<string, number>
  diagnostics: readonly LibraryGraphDiagnostic[]
}

export interface LibraryGraphNodeResult {
  key: string
  kind: LibraryGraphNodeKind
  mediaType?: LibraryMediaType
  entityId?: string
  action: LibraryGraphResultAction
  diagnostics?: readonly LibraryGraphDiagnostic[]
}

export interface LibraryGraphEdgeResult {
  kind: LibraryGraphEdgeKind
  fromKey: string
  toKey: string
  action: LibraryGraphResultAction
  diagnostics?: readonly LibraryGraphDiagnostic[]
}

export interface LibraryGraphDiagnostic {
  level: LibraryGraphDiagnosticLevel
  code: string
  message: string
  nodeKey?: string
  edgeKind?: LibraryGraphEdgeKind
}
