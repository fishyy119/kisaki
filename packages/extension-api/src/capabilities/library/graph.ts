import type {
  LibraryAnimeCreateInput,
  LibraryAnimeEpisodeCreateInput,
  LibraryCharacterCreateInput,
  LibraryCollectionCreateInput,
  LibraryComicChapterCreateInput,
  LibraryComicCreateInput,
  LibraryCompanyCreateInput,
  LibraryGameCreateInput,
  LibraryGameNoteCreateInput,
  LibraryGameSessionCreateInput,
  LibraryNovelCreateInput,
  LibraryNovelVolumeCreateInput,
  LibraryPersonCreateInput,
  LibraryTagCreateInput
} from './entities'
import type {
  LibraryAnimeCharacterRole,
  LibraryAnimeCompanyRole,
  LibraryAnimePersonRole,
  LibraryCharacterPersonRole,
  LibraryComicCharacterRole,
  LibraryComicCompanyRole,
  LibraryComicPersonRole,
  LibraryCompanyRelationType,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryMediaRelationType,
  LibraryNovelCharacterRole,
  LibraryNovelCompanyRole,
  LibraryNovelPersonRole
} from '../../shared/library'

export const LIBRARY_MEDIA_TYPES = ['game', 'anime', 'comic', 'novel'] as const

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
  'character',
  'note',
  'session',
  'unit',
  'attachment'
] as const

export type LibraryGraphNodeKind = (typeof LIBRARY_GRAPH_NODE_KINDS)[number]

export const LIBRARY_GRAPH_EDGE_KINDS = [
  'collection-media',
  'media-tag',
  'media-company',
  'media-person',
  'media-character',
  'media-cast',
  'character-person',
  'media-media',
  'company-company',
  'media-note',
  'media-session',
  'media-unit',
  'media-attachment',
  'unit-attachment'
] as const

export type LibraryGraphEdgeKind = (typeof LIBRARY_GRAPH_EDGE_KINDS)[number]

export const LIBRARY_GRAPH_MEDIA_ATTACHMENT_SLOTS = [
  'cover',
  'backdrop',
  'logo',
  'icon',
  'description-inline',
  'save-backup'
] as const

export type LibraryGraphMediaAttachmentSlot = (typeof LIBRARY_GRAPH_MEDIA_ATTACHMENT_SLOTS)[number]

/**
 * Units own exactly one attachment slot: the still frame.
 *
 * Only anime episodes accept it. Comic and novel unit covers come from file
 * sync and scraped metadata, so a `unit-attachment` edge from a comic or novel
 * unit is rejected.
 */
export const LIBRARY_GRAPH_UNIT_ATTACHMENT_SLOTS = ['still'] as const

export type LibraryGraphUnitAttachmentSlot = (typeof LIBRARY_GRAPH_UNIT_ATTACHMENT_SLOTS)[number]

export const LIBRARY_GRAPH_ATTACHMENT_SLOTS = [
  ...LIBRARY_GRAPH_MEDIA_ATTACHMENT_SLOTS,
  ...LIBRARY_GRAPH_UNIT_ATTACHMENT_SLOTS
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
  characters?: readonly LibraryGraphCharacterNode[]
  notes?: readonly LibraryGraphNoteNode[]
  sessions?: readonly LibraryGraphSessionNode[]
  units?: readonly LibraryGraphUnitNode[]
  attachments?: readonly LibraryGraphAttachmentNode[]
}

export interface LibraryGraphNodeBase {
  key: string
}

export type LibraryGraphMediaNode =
  LibraryGraphGameNode | LibraryGraphAnimeNode | LibraryGraphComicNode | LibraryGraphNovelNode

export interface LibraryGraphGameNode extends LibraryGraphNodeBase {
  kind: 'media'
  mediaType: 'game'
  input: LibraryGameCreateInput
}

export interface LibraryGraphAnimeNode extends LibraryGraphNodeBase {
  kind: 'media'
  mediaType: 'anime'
  input: LibraryAnimeCreateInput
}

export interface LibraryGraphComicNode extends LibraryGraphNodeBase {
  kind: 'media'
  mediaType: 'comic'
  input: LibraryComicCreateInput
}

export interface LibraryGraphNovelNode extends LibraryGraphNodeBase {
  kind: 'media'
  mediaType: 'novel'
  input: LibraryNovelCreateInput
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

export interface LibraryGraphCharacterNode extends LibraryGraphNodeBase {
  kind: 'character'
  input: LibraryCharacterCreateInput
}

export interface LibraryGraphNoteNode extends LibraryGraphNodeBase {
  kind: 'note'
  input: LibraryGameNoteCreateInput
}

export interface LibraryGraphSessionNode extends LibraryGraphNodeBase {
  kind: 'session'
  input: LibraryGameSessionCreateInput
}

export type LibraryGraphUnitNode =
  LibraryGraphAnimeEpisodeNode | LibraryGraphComicChapterNode | LibraryGraphNovelVolumeNode

export interface LibraryGraphAnimeEpisodeNode extends LibraryGraphNodeBase {
  kind: 'unit'
  mediaType: 'anime'
  input: LibraryAnimeEpisodeCreateInput
}

/** A comic's readable unit: a collected volume or a serialized chapter. */
export interface LibraryGraphComicChapterNode extends LibraryGraphNodeBase {
  kind: 'unit'
  mediaType: 'comic'
  input: LibraryComicChapterCreateInput
}

export interface LibraryGraphNovelVolumeNode extends LibraryGraphNodeBase {
  kind: 'unit'
  mediaType: 'novel'
  input: LibraryNovelVolumeCreateInput
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
  | LibraryGraphMediaCharacterEdge
  | LibraryGraphMediaCastEdge
  | LibraryGraphCharacterPersonEdge
  | LibraryGraphMediaMediaEdge
  | LibraryGraphCompanyCompanyEdge
  | LibraryGraphMediaNoteEdge
  | LibraryGraphMediaSessionEdge
  | LibraryGraphMediaUnitEdge
  | LibraryGraphMediaAttachmentEdge
  | LibraryGraphUnitAttachmentEdge

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

/** Role vocabulary is per media type; the host checks it against the `from` node. */
export interface LibraryGraphMediaCompanyEdge {
  kind: 'media-company'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  role:
    | LibraryGameCompanyRole
    | LibraryAnimeCompanyRole
    | LibraryComicCompanyRole
    | LibraryNovelCompanyRole
  order?: number
}

export interface LibraryGraphMediaPersonEdge {
  kind: 'media-person'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  role:
    LibraryGamePersonRole | LibraryAnimePersonRole | LibraryComicPersonRole | LibraryNovelPersonRole
  order?: number
  note?: string
}

/** Role vocabulary is per media type; the host checks it against the `from` node. */
export interface LibraryGraphMediaCharacterEdge {
  kind: 'media-character'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  role:
    | LibraryGameCharacterRole
    | LibraryAnimeCharacterRole
    | LibraryComicCharacterRole
    | LibraryNovelCharacterRole
  order?: number
  note?: string
}

/**
 * One voice credit of an entry: who voices which character there.
 *
 * The edge is three-way, so it names the person on the edge itself rather than
 * through a second edge no join could pair back up. It carries no role: being
 * here is the fact.
 */
export interface LibraryGraphMediaCastEdge {
  kind: 'media-cast'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  person: LibraryGraphNodeRef
  note?: string
}

export interface LibraryGraphCharacterPersonEdge {
  kind: 'character-person'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  role: LibraryCharacterPersonRole
  order?: number
  note?: string
}

/**
 * Directed entry-to-entry relation between two media nodes. The endpoint pair
 * constrains the vocabulary; the host validates it against the resolved media
 * types. Both endpoints must be graph media nodes — matching an existing
 * library entry through its node identity is how existing entries join edges,
 * so the graph never fabricates a media entry just to relate to it.
 */
export interface LibraryGraphMediaMediaEdge {
  kind: 'media-media'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  type: LibraryMediaRelationType
  note?: string
  order?: number
}

/**
 * Directed relation between two companies: houses, labels, renames, spin-offs.
 *
 * Unlike `media-media` both endpoints are one type, so the vocabulary needs no
 * pair-dependent validation.
 */
export interface LibraryGraphCompanyCompanyEdge {
  kind: 'company-company'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  type: LibraryCompanyRelationType
  note?: string
  order?: number
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

/** Attaches a consumption unit to its owning entry. */
export interface LibraryGraphMediaUnitEdge {
  kind: 'media-unit'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
}

export interface LibraryGraphMediaAttachmentEdge {
  kind: 'media-attachment'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  slot: LibraryGraphMediaAttachmentSlot
  replace?: boolean
  saveBackup?: LibraryGraphSaveBackupInput
}

/** Anime episodes only; see {@link LIBRARY_GRAPH_UNIT_ATTACHMENT_SLOTS}. */
export interface LibraryGraphUnitAttachmentEdge {
  kind: 'unit-attachment'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  slot: LibraryGraphUnitAttachmentSlot
  replace?: boolean
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
