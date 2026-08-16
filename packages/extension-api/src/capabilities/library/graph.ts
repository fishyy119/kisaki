import type {
  LibraryAnimeCreateInput,
  LibraryAnimeEpisodeCreateInput,
  LibraryCharacterCreateInput,
  LibraryCollectionCreateInput,
  LibraryCompanyCreateInput,
  LibraryGameCreateInput,
  LibraryGameNoteCreateInput,
  LibraryGameSessionCreateInput,
  LibraryMovieCreateInput,
  LibraryPersonCreateInput,
  LibraryTagCreateInput,
  LibraryTvCreateInput,
  LibraryTvEpisodeCreateInput,
  LibraryTvSeasonCreateInput
} from './entities'
import type {
  LibraryAnimeCharacterRole,
  LibraryAnimeCompanyRole,
  LibraryAnimePersonRole,
  LibraryCharacterPersonRole,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryMediaRelationType,
  LibraryMovieCharacterRole,
  LibraryMovieCompanyRole,
  LibraryMoviePersonRole,
  LibraryTvCharacterRole,
  LibraryTvCompanyRole,
  LibraryTvPersonRole
} from '../../shared/library'

export const LIBRARY_MEDIA_TYPES = ['game', 'anime', 'tv', 'movie'] as const

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
  'season',
  'episode',
  'attachment'
] as const

export type LibraryGraphNodeKind = (typeof LIBRARY_GRAPH_NODE_KINDS)[number]

export const LIBRARY_GRAPH_EDGE_KINDS = [
  'collection-media',
  'media-tag',
  'media-company',
  'media-person',
  'media-character',
  'character-person',
  'media-media',
  'media-note',
  'media-session',
  'media-season',
  'media-episode',
  'season-episode',
  'media-attachment',
  'season-attachment',
  'episode-attachment'
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

/** Seasons own exactly one attachment slot: the season poster. */
export const LIBRARY_GRAPH_SEASON_ATTACHMENT_SLOTS = ['poster'] as const

export type LibraryGraphSeasonAttachmentSlot =
  (typeof LIBRARY_GRAPH_SEASON_ATTACHMENT_SLOTS)[number]

/** Episodes own exactly one attachment slot: the still frame. */
export const LIBRARY_GRAPH_EPISODE_ATTACHMENT_SLOTS = ['still'] as const

export type LibraryGraphEpisodeAttachmentSlot =
  (typeof LIBRARY_GRAPH_EPISODE_ATTACHMENT_SLOTS)[number]

export const LIBRARY_GRAPH_ATTACHMENT_SLOTS = [
  ...LIBRARY_GRAPH_MEDIA_ATTACHMENT_SLOTS,
  ...LIBRARY_GRAPH_SEASON_ATTACHMENT_SLOTS,
  ...LIBRARY_GRAPH_EPISODE_ATTACHMENT_SLOTS
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
  seasons?: readonly LibraryGraphSeasonNode[]
  episodes?: readonly LibraryGraphEpisodeNode[]
  attachments?: readonly LibraryGraphAttachmentNode[]
}

export interface LibraryGraphNodeBase {
  key: string
}

export type LibraryGraphMediaNode =
  LibraryGraphGameNode | LibraryGraphAnimeNode | LibraryGraphTvNode | LibraryGraphMovieNode

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

export interface LibraryGraphTvNode extends LibraryGraphNodeBase {
  kind: 'media'
  mediaType: 'tv'
  input: LibraryTvCreateInput
}

export interface LibraryGraphMovieNode extends LibraryGraphNodeBase {
  kind: 'media'
  mediaType: 'movie'
  input: LibraryMovieCreateInput
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

/** Seasons exist only under a show, so the node needs no media discriminator. */
export interface LibraryGraphSeasonNode extends LibraryGraphNodeBase {
  kind: 'season'
  input: LibraryTvSeasonCreateInput
}

export type LibraryGraphEpisodeNode = LibraryGraphAnimeEpisodeNode | LibraryGraphTvEpisodeNode

export interface LibraryGraphAnimeEpisodeNode extends LibraryGraphNodeBase {
  kind: 'episode'
  mediaType: 'anime'
  input: LibraryAnimeEpisodeCreateInput
}

export interface LibraryGraphTvEpisodeNode extends LibraryGraphNodeBase {
  kind: 'episode'
  mediaType: 'tv'
  input: LibraryTvEpisodeCreateInput
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
  | LibraryGraphCharacterPersonEdge
  | LibraryGraphMediaMediaEdge
  | LibraryGraphMediaNoteEdge
  | LibraryGraphMediaSessionEdge
  | LibraryGraphMediaSeasonEdge
  | LibraryGraphMediaEpisodeEdge
  | LibraryGraphSeasonEpisodeEdge
  | LibraryGraphMediaAttachmentEdge
  | LibraryGraphSeasonAttachmentEdge
  | LibraryGraphEpisodeAttachmentEdge

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
    | LibraryTvCompanyRole
    | LibraryMovieCompanyRole
  order?: number
}

export interface LibraryGraphMediaPersonEdge {
  kind: 'media-person'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  role:
    LibraryGamePersonRole | LibraryAnimePersonRole | LibraryTvPersonRole | LibraryMoviePersonRole
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
    | LibraryTvCharacterRole
    | LibraryMovieCharacterRole
  order?: number
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

export interface LibraryGraphMediaSeasonEdge {
  kind: 'media-season'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
}

/**
 * Attaches an episode to its owning entry. A tv episode also needs a
 * `season-episode` edge: the show owns it, the season places it.
 */
export interface LibraryGraphMediaEpisodeEdge {
  kind: 'media-episode'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
}

export interface LibraryGraphSeasonEpisodeEdge {
  kind: 'season-episode'
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

export interface LibraryGraphSeasonAttachmentEdge {
  kind: 'season-attachment'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  slot: LibraryGraphSeasonAttachmentSlot
  replace?: boolean
}

export interface LibraryGraphEpisodeAttachmentEdge {
  kind: 'episode-attachment'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  slot: LibraryGraphEpisodeAttachmentSlot
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
