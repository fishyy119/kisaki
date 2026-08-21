import {
  LIBRARY_ANIME_CHARACTER_ROLES,
  LIBRARY_ANIME_COMPANY_ROLES,
  LIBRARY_ANIME_PERSON_ROLES,
  LIBRARY_CHARACTER_PERSON_ROLES,
  LIBRARY_GRAPH_CONFLICT_MODES,
  LIBRARY_GRAPH_EDGE_KINDS,
  LIBRARY_GRAPH_EPISODE_ATTACHMENT_SLOTS,
  LIBRARY_GRAPH_MEDIA_ATTACHMENT_SLOTS,
  LIBRARY_GRAPH_NODE_KINDS,
  LIBRARY_GAME_CHARACTER_ROLES,
  LIBRARY_GAME_COMPANY_ROLES,
  LIBRARY_GAME_PERSON_ROLES,
  LIBRARY_COMPANY_RELATION_TYPES,
  LIBRARY_MEDIA_RELATION_TYPE_RULES,
  LIBRARY_MEDIA_TYPES,
  assertValidLibraryAnimeCreateInput,
  assertValidLibraryAnimeEpisodeCreateInput,
  assertValidLibraryCharacterCreateInput,
  assertValidLibraryCollectionCreateInput,
  assertValidLibraryCompanyCreateInput,
  assertValidLibraryGameCreateInput,
  assertValidLibraryPersonCreateInput,
  assertValidLibraryTagCreateInput,
  createValidationError,
  type LibraryGraphEdge,
  type LibraryGraphInput,
  type LibraryGraphNodeKind,
  type LibraryMediaType
} from '@kisaki3/extension-api'
import { edgeIdentity, graphNodeIdentity } from './identity'

type JsonRecord = Record<string, unknown>

const INPUT_KEYS = new Set<string>(['requestId', 'options', 'nodes', 'edges', 'diagnostics'])
const OPTIONS_KEYS = new Set<string>(['conflictMode', 'strictAttachments'])
const NODES_KEYS = new Set<string>([
  'media',
  'collections',
  'tags',
  'companies',
  'people',
  'characters',
  'notes',
  'sessions',
  'episodes',
  'attachments'
])
const NODE_BASE_KEYS = new Set<string>([
  'key',
  'kind',
  'mediaType',
  'input',
  'path',
  'fileName',
  'contentType'
])
const NODE_REF_KEYS = new Set<string>(['kind', 'key'])
const COMPANY_ROLES: Record<LibraryMediaType, readonly string[]> = {
  game: LIBRARY_GAME_COMPANY_ROLES,
  anime: LIBRARY_ANIME_COMPANY_ROLES
}
const PERSON_ROLES: Record<LibraryMediaType, readonly string[]> = {
  game: LIBRARY_GAME_PERSON_ROLES,
  anime: LIBRARY_ANIME_PERSON_ROLES
}
const CHARACTER_ROLES: Record<LibraryMediaType, readonly string[]> = {
  game: LIBRARY_GAME_CHARACTER_ROLES,
  anime: LIBRARY_ANIME_CHARACTER_ROLES
}
const DIAGNOSTIC_KEYS = new Set<string>(['level', 'code', 'message', 'nodeKey', 'edgeKind'])
const DIAGNOSTIC_LEVELS = ['info', 'warning', 'error'] as const

export function assertValidLibraryGraphInput(value: unknown): asserts value is LibraryGraphInput {
  const input = requireRecord(value, 'library.graph input')
  validateUnknownKeys(input, INPUT_KEYS, 'library.graph input')
  if (input.requestId !== undefined && typeof input.requestId !== 'string') {
    throw createValidationError('library.graph.requestId must be a string.')
  }

  validateOptions(input.options)
  validateNodes(input.nodes)
  validateEdges(input.edges, input.nodes)
  validateDiagnostics(input.diagnostics)
}

function validateOptions(value: unknown): void {
  if (value === undefined) {
    return
  }

  const options = requireRecord(value, 'library.graph.options')
  validateUnknownKeys(options, OPTIONS_KEYS, 'library.graph.options')
  if (
    options.conflictMode !== undefined &&
    !LIBRARY_GRAPH_CONFLICT_MODES.includes(options.conflictMode as never)
  ) {
    throw createValidationError('library.graph.options.conflictMode is not supported.')
  }
  if (options.strictAttachments !== undefined && typeof options.strictAttachments !== 'boolean') {
    throw createValidationError('library.graph.options.strictAttachments must be a boolean.')
  }
}

function validateNodes(value: unknown): void {
  const nodes = requireRecord(value, 'library.graph.nodes')
  validateUnknownKeys(nodes, NODES_KEYS, 'library.graph.nodes')

  const keys = new Set<string>()
  validateNodeArray(nodes.media, 'media', 'library.graph.nodes.media', keys, validateMediaNode)
  validateNodeArray(
    nodes.collections,
    'collection',
    'library.graph.nodes.collections',
    keys,
    validateCollectionNode
  )
  validateNodeArray(nodes.tags, 'tag', 'library.graph.nodes.tags', keys, validateTagNode)
  validateNodeArray(
    nodes.companies,
    'company',
    'library.graph.nodes.companies',
    keys,
    validateCompanyNode
  )
  validateNodeArray(nodes.people, 'person', 'library.graph.nodes.people', keys, validatePersonNode)
  validateNodeArray(
    nodes.characters,
    'character',
    'library.graph.nodes.characters',
    keys,
    validateCharacterNode
  )
  validateNodeArray(nodes.notes, 'note', 'library.graph.nodes.notes', keys, validateNoteNode)
  validateNodeArray(
    nodes.sessions,
    'session',
    'library.graph.nodes.sessions',
    keys,
    validateSessionNode
  )
  validateNodeArray(
    nodes.episodes,
    'episode',
    'library.graph.nodes.episodes',
    keys,
    validateEpisodeNode
  )
  validateNodeArray(
    nodes.attachments,
    'attachment',
    'library.graph.nodes.attachments',
    keys,
    validateAttachmentNode
  )
}

function validateNodeArray(
  value: unknown,
  kind: LibraryGraphNodeKind,
  label: string,
  keys: Set<string>,
  validateNode: (node: JsonRecord, label: string) => void
): void {
  if (value === undefined) {
    return
  }
  if (!Array.isArray(value)) {
    throw createValidationError(`${label} must be an array.`)
  }

  for (const [index, item] of value.entries()) {
    const itemLabel = `${label}[${index}]`
    const node = requireRecord(item, itemLabel)
    validateUnknownKeys(node, NODE_BASE_KEYS, itemLabel)
    if (node.kind !== kind) {
      throw createValidationError(`${itemLabel}.kind must be "${kind}".`)
    }
    const key = requireNonEmptyString(node.key, `${itemLabel}.key`)
    if (keys.has(key)) {
      throw createValidationError(`library.graph node key "${key}" is duplicated.`)
    }
    keys.add(key)
    validateNode(node, itemLabel)
  }
}

function validateMediaNode(node: JsonRecord, label: string): void {
  if (!LIBRARY_MEDIA_TYPES.includes(node.mediaType as never)) {
    throw createValidationError(`${label}.mediaType is not supported.`)
  }

  switch (node.mediaType as LibraryMediaType) {
    case 'anime':
      assertValidLibraryAnimeCreateInput(node.input)
      return
    case 'game':
      assertValidLibraryGameCreateInput(node.input)
      return
  }
}

function validateCollectionNode(node: JsonRecord): void {
  assertValidLibraryCollectionCreateInput(node.input)
}

function validateTagNode(node: JsonRecord): void {
  assertValidLibraryTagCreateInput(node.input)
}

function validateCompanyNode(node: JsonRecord): void {
  assertValidLibraryCompanyCreateInput(node.input)
}

function validatePersonNode(node: JsonRecord): void {
  assertValidLibraryPersonCreateInput(node.input)
}

function validateCharacterNode(node: JsonRecord): void {
  assertValidLibraryCharacterCreateInput(node.input)
}

function validateNoteNode(node: JsonRecord, label: string): void {
  const input = requireRecord(node.input, `${label}.input`)
  validateUnknownKeys(
    input,
    new Set<string>(['name', 'content', 'coverPath', 'createdAt', 'updatedAt', 'order']),
    `${label}.input`
  )
  requireNonEmptyString(input.name, `${label}.input.name`)
  validateOptionalString(input.content, `${label}.input.content`)
  validateOptionalString(input.coverPath, `${label}.input.coverPath`)
  validateOptionalFiniteNonNegativeNumber(input.createdAt, `${label}.input.createdAt`)
  validateOptionalFiniteNonNegativeNumber(input.updatedAt, `${label}.input.updatedAt`)
  validateOptionalFiniteNumber(input.order, `${label}.input.order`)
}

function validateSessionNode(node: JsonRecord, label: string): void {
  const input = requireRecord(node.input, `${label}.input`)
  validateUnknownKeys(input, new Set<string>(['startedAt', 'endedAt']), `${label}.input`)
  validateRequiredFiniteNonNegativeNumber(input.startedAt, `${label}.input.startedAt`)
  validateRequiredFiniteNonNegativeNumber(input.endedAt, `${label}.input.endedAt`)
  if (
    typeof input.startedAt === 'number' &&
    typeof input.endedAt === 'number' &&
    input.endedAt <= input.startedAt
  ) {
    throw createValidationError(`${label}.input.endedAt must be greater than startedAt.`)
  }
}

function validateEpisodeNode(node: JsonRecord, label: string): void {
  if (node.mediaType !== 'anime') {
    throw createValidationError(`${label}.mediaType must be "anime".`)
  }

  assertValidLibraryAnimeEpisodeCreateInput(node.input)
}

function validateAttachmentNode(node: JsonRecord, label: string): void {
  requireNonEmptyString(node.path, `${label}.path`)
  validateOptionalString(node.fileName, `${label}.fileName`)
  validateOptionalString(node.contentType, `${label}.contentType`)
}

function validateEdges(value: unknown, nodesValue: unknown): void {
  if (value === undefined) {
    return
  }
  if (!Array.isArray(value)) {
    throw createValidationError('library.graph.edges must be an array.')
  }

  const nodeKinds = collectNodeKinds(nodesValue)
  const mediaTypes = collectMediaTypes(nodesValue)
  const edgeKeys = new Set<string>()
  const singleOwnerKeys = new Set<string>()

  for (const [index, item] of value.entries()) {
    const edge = requireRecord(item, `library.graph.edges[${index}]`) as unknown as LibraryGraphEdge
    validateEdge(edge, index, nodeKinds, mediaTypes)

    const identity = edgeIdentity(edge)
    if (edgeKeys.has(identity)) {
      throw createValidationError(`library.graph.edges[${index}] duplicates another edge.`)
    }
    edgeKeys.add(identity)

    if (
      edge.kind === 'media-note' ||
      edge.kind === 'media-session' ||
      edge.kind === 'media-episode'
    ) {
      const ownerKey = graphNodeIdentity(edge.to.kind, edge.to.key)
      if (singleOwnerKeys.has(ownerKey)) {
        throw createValidationError(`${edge.to.kind} node "${edge.to.key}" has multiple owners.`)
      }
      singleOwnerKeys.add(ownerKey)
    }
  }
}

function validateEdge(
  edge: LibraryGraphEdge,
  index: number,
  nodeKinds: ReadonlyMap<string, LibraryGraphNodeKind>,
  mediaTypes: ReadonlyMap<string, LibraryMediaType>
): void {
  const label = `library.graph.edges[${index}]`
  const raw = edge as unknown as JsonRecord
  if (!LIBRARY_GRAPH_EDGE_KINDS.includes(raw.kind as never)) {
    throw createValidationError(`${label}.kind is not supported.`)
  }
  validateNodeRef(raw.from, `${label}.from`, nodeKinds)
  validateNodeRef(raw.to, `${label}.to`, nodeKinds)

  switch (edge.kind) {
    case 'collection-media':
      validateEndpointKinds(edge, label, 'collection', 'media')
      validateOptionalFiniteNumber(edge.order, `${label}.order`)
      return
    case 'media-tag':
      validateEndpointKinds(edge, label, 'media', 'tag')
      validateOptionalFiniteNumber(edge.order, `${label}.order`)
      return
    case 'media-company':
      validateEndpointKinds(edge, label, 'media', 'company')
      validateRole(
        edge.role,
        COMPANY_ROLES[edgeMediaType(edge.from.key, mediaTypes)],
        `${label}.role`
      )
      validateOptionalFiniteNumber(edge.order, `${label}.order`)
      return
    case 'media-person':
      validateEndpointKinds(edge, label, 'media', 'person')
      validateRole(
        edge.role,
        PERSON_ROLES[edgeMediaType(edge.from.key, mediaTypes)],
        `${label}.role`
      )
      validateOptionalFiniteNumber(edge.order, `${label}.order`)
      validateOptionalString(edge.note, `${label}.note`)
      return
    case 'media-character':
      validateEndpointKinds(edge, label, 'media', 'character')
      validateRole(
        edge.role,
        CHARACTER_ROLES[edgeMediaType(edge.from.key, mediaTypes)],
        `${label}.role`
      )
      validateOptionalFiniteNumber(edge.order, `${label}.order`)
      validateOptionalString(edge.note, `${label}.note`)
      return
    case 'media-cast':
      validateEndpointKinds(edge, label, 'media', 'character')
      validateNodeRef((edge as unknown as JsonRecord).person, `${label}.person`, nodeKinds)
      if (edge.person.kind !== 'person') {
        throw createValidationError(`${label}.person.kind must be "person".`)
      }
      validateOptionalString(edge.note, `${label}.note`)
      return
    case 'character-person':
      validateEndpointKinds(edge, label, 'character', 'person')
      validateRole(edge.role, LIBRARY_CHARACTER_PERSON_ROLES, `${label}.role`)
      validateOptionalFiniteNumber(edge.order, `${label}.order`)
      validateOptionalString(edge.note, `${label}.note`)
      return
    case 'media-media': {
      validateEndpointKinds(edge, label, 'media', 'media')
      const fromType = mediaTypes.get(edge.from.key) ?? 'game'
      const toType = mediaTypes.get(edge.to.key) ?? 'game'
      validateRole(
        edge.type,
        LIBRARY_MEDIA_RELATION_TYPE_RULES[`${fromType}-${toType}`],
        `${label}.type`
      )
      validateOptionalString(edge.note, `${label}.note`)
      validateOptionalFiniteNumber(edge.order, `${label}.order`)
      return
    }
    case 'company-company':
      validateEndpointKinds(edge, label, 'company', 'company')
      validateRole(edge.type, LIBRARY_COMPANY_RELATION_TYPES, `${label}.type`)
      validateOptionalString(edge.note, `${label}.note`)
      validateOptionalFiniteNumber(edge.order, `${label}.order`)
      return
    case 'media-note':
      validateEndpointKinds(edge, label, 'media', 'note')
      requireMediaType(edge.from.key, 'game', mediaTypes, label)
      return
    case 'media-session':
      validateEndpointKinds(edge, label, 'media', 'session')
      requireMediaType(edge.from.key, 'game', mediaTypes, label)
      return
    case 'media-episode':
      validateEndpointKinds(edge, label, 'media', 'episode')
      requireMediaType(edge.from.key, 'anime', mediaTypes, label)
      return
    case 'media-attachment':
      validateEndpointKinds(edge, label, 'media', 'attachment')
      if (!LIBRARY_GRAPH_MEDIA_ATTACHMENT_SLOTS.includes(edge.slot as never)) {
        throw createValidationError(`${label}.slot is not supported.`)
      }
      if (edge.replace !== undefined && typeof edge.replace !== 'boolean') {
        throw createValidationError(`${label}.replace must be a boolean.`)
      }
      validateSaveBackup(edge.saveBackup, `${label}.saveBackup`)
      return
    case 'episode-attachment':
      validateEndpointKinds(edge, label, 'episode', 'attachment')
      if (!LIBRARY_GRAPH_EPISODE_ATTACHMENT_SLOTS.includes(edge.slot as never)) {
        throw createValidationError(`${label}.slot is not supported.`)
      }
      if (edge.replace !== undefined && typeof edge.replace !== 'boolean') {
        throw createValidationError(`${label}.replace must be a boolean.`)
      }
      return
  }
}

function edgeMediaType(
  key: string,
  mediaTypes: ReadonlyMap<string, LibraryMediaType>
): LibraryMediaType {
  return mediaTypes.get(key) ?? 'game'
}

function requireMediaType(
  key: string,
  mediaType: LibraryMediaType,
  mediaTypes: ReadonlyMap<string, LibraryMediaType>,
  label: string
): void {
  if (mediaTypes.get(key) !== mediaType) {
    throw createValidationError(`${label} requires a ${mediaType} media node.`)
  }
}

function validateNodeRef(
  value: unknown,
  label: string,
  nodeKinds: ReadonlyMap<string, LibraryGraphNodeKind>
): void {
  const ref = requireRecord(value, label)
  validateUnknownKeys(ref, NODE_REF_KEYS, label)
  if (!LIBRARY_GRAPH_NODE_KINDS.includes(ref.kind as never)) {
    throw createValidationError(`${label}.kind is not supported.`)
  }
  const key = requireNonEmptyString(ref.key, `${label}.key`)
  const actualKind = nodeKinds.get(key)
  if (!actualKind) {
    throw createValidationError(`${label} references unknown node "${key}".`)
  }
  if (actualKind !== ref.kind) {
    throw createValidationError(`${label} references node "${key}" with the wrong kind.`)
  }
}

function validateEndpointKinds(
  edge: LibraryGraphEdge,
  label: string,
  fromKind: LibraryGraphNodeKind,
  toKind: LibraryGraphNodeKind
): void {
  if (edge.from.kind !== fromKind || edge.to.kind !== toKind) {
    throw createValidationError(`${label} must connect ${fromKind} -> ${toKind}.`)
  }
}

function validateSaveBackup(value: unknown, label: string): void {
  if (value === undefined) {
    return
  }
  const input = requireRecord(value, label)
  validateUnknownKeys(input, new Set<string>(['backupAt', 'note', 'locked']), label)
  validateRequiredFiniteNonNegativeNumber(input.backupAt, `${label}.backupAt`)
  requireString(input.note, `${label}.note`)
  if (typeof input.locked !== 'boolean') {
    throw createValidationError(`${label}.locked must be a boolean.`)
  }
}

function validateDiagnostics(value: unknown): void {
  if (value === undefined) {
    return
  }
  if (!Array.isArray(value)) {
    throw createValidationError('library.graph.diagnostics must be an array.')
  }

  for (const [index, item] of value.entries()) {
    const diagnostic = requireRecord(item, `library.graph.diagnostics[${index}]`)
    validateUnknownKeys(diagnostic, DIAGNOSTIC_KEYS, `library.graph.diagnostics[${index}]`)
    validateRole(diagnostic.level, DIAGNOSTIC_LEVELS, `library.graph.diagnostics[${index}].level`)
    requireNonEmptyString(diagnostic.code, `library.graph.diagnostics[${index}].code`)
    requireNonEmptyString(diagnostic.message, `library.graph.diagnostics[${index}].message`)
    validateOptionalString(diagnostic.nodeKey, `library.graph.diagnostics[${index}].nodeKey`)
    if (
      diagnostic.edgeKind !== undefined &&
      !LIBRARY_GRAPH_EDGE_KINDS.includes(diagnostic.edgeKind as never)
    ) {
      throw createValidationError(`library.graph.diagnostics[${index}].edgeKind is not supported.`)
    }
  }
}

function collectNodeKinds(nodesValue: unknown): Map<string, LibraryGraphNodeKind> {
  const nodes = requireRecord(nodesValue, 'library.graph.nodes')
  const entries: Array<[unknown, LibraryGraphNodeKind]> = [
    [nodes.media, 'media'],
    [nodes.collections, 'collection'],
    [nodes.tags, 'tag'],
    [nodes.companies, 'company'],
    [nodes.people, 'person'],
    [nodes.characters, 'character'],
    [nodes.notes, 'note'],
    [nodes.sessions, 'session'],
    [nodes.episodes, 'episode'],
    [nodes.attachments, 'attachment']
  ]
  const result = new Map<string, LibraryGraphNodeKind>()

  for (const [value, kind] of entries) {
    if (!Array.isArray(value)) {
      continue
    }
    for (const node of value) {
      if (node && typeof node === 'object' && 'key' in node && typeof node.key === 'string') {
        result.set(node.key, kind)
      }
    }
  }

  return result
}

function collectMediaTypes(nodesValue: unknown): Map<string, LibraryMediaType> {
  const nodes = requireRecord(nodesValue, 'library.graph.nodes')
  const result = new Map<string, LibraryMediaType>()
  if (!Array.isArray(nodes.media)) {
    return result
  }

  for (const node of nodes.media) {
    if (node && typeof node === 'object' && 'key' in node && typeof node.key === 'string') {
      result.set(node.key, (node as { mediaType: LibraryMediaType }).mediaType)
    }
  }

  return result
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createValidationError(`${label} must be an object.`)
  }

  return value as JsonRecord
}

function validateUnknownKeys(
  value: JsonRecord,
  allowedKeys: ReadonlySet<string>,
  label: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw createValidationError(`${label}.${key} is not supported.`)
    }
  }
}

function requireNonEmptyString(value: unknown, label: string): string {
  const text = requireString(value, label).trim()
  if (text.length === 0) {
    throw createValidationError(`${label} must be a non-empty string.`)
  }

  return text
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw createValidationError(`${label} must be a string.`)
  }

  return value
}

function validateOptionalString(value: unknown, label: string): void {
  if (value !== undefined && typeof value !== 'string') {
    throw createValidationError(`${label} must be a string.`)
  }
}

function validateOptionalFiniteNumber(value: unknown, label: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw createValidationError(`${label} must be a finite number.`)
  }
}

function validateOptionalFiniteNonNegativeNumber(value: unknown, label: string): void {
  if (value !== undefined) {
    validateRequiredFiniteNonNegativeNumber(value, label)
  }
}

function validateRequiredFiniteNonNegativeNumber(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw createValidationError(`${label} must be a non-negative finite number.`)
  }
}

function validateRole<TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[],
  label: string
): void {
  if (typeof value !== 'string' || !allowedValues.includes(value as TValue)) {
    throw createValidationError(`${label} is not supported.`)
  }
}
