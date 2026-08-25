import {
  type LibraryGraphAttachmentNode,
  type LibraryGraphCharacterNode,
  type LibraryGraphCollectionNode,
  type LibraryGraphCompanyNode,
  type LibraryGraphUnitNode,
  type LibraryGraphInput,
  type LibraryGraphMediaNode,
  type LibraryGraphNoteNode,
  type LibraryGraphPersonNode,
  type LibraryGraphSessionNode,
  type LibraryGraphTagNode
} from '@kisaki3/extension-api'
import { graphNodeIdentity } from './identity'
import {
  type LibraryGraphNode,
  type LibraryGraphNodeEntry,
  type NormalizedLibraryGraph,
  type NormalizedLibraryGraphNodes
} from './types'

export function normalizeLibraryGraph(input: LibraryGraphInput): NormalizedLibraryGraph {
  const media = toEntries(input.nodes.media ?? [], 'media')
  const collections = toEntries(input.nodes.collections ?? [], 'collection')
  const tags = toEntries(input.nodes.tags ?? [], 'tag')
  const companies = toEntries(input.nodes.companies ?? [], 'company')
  const people = toEntries(input.nodes.people ?? [], 'person')
  const characters = toEntries(input.nodes.characters ?? [], 'character')
  const notes = toEntries(input.nodes.notes ?? [], 'note')
  const sessions = toEntries(input.nodes.sessions ?? [], 'session')
  const units = toEntries(input.nodes.units ?? [], 'unit')
  const attachments = toEntries(input.nodes.attachments ?? [], 'attachment')
  const all = [
    ...media,
    ...collections,
    ...tags,
    ...companies,
    ...people,
    ...characters,
    ...notes,
    ...sessions,
    ...units,
    ...attachments
  ]

  const nodes: NormalizedLibraryGraphNodes = {
    all,
    byIdentity: new Map(all.map((entry) => [graphNodeIdentity(entry.kind, entry.key), entry])),
    byKey: new Map(all.map((entry) => [entry.key, entry])),
    media,
    collections,
    tags,
    companies,
    people,
    characters,
    notes,
    sessions,
    units,
    attachments
  }

  return {
    input,
    options: {
      conflictMode: input.options?.conflictMode ?? 'mergeSelected',
      strictAttachments: input.options?.strictAttachments ?? false
    },
    nodes,
    edges: input.edges ?? [],
    inputDiagnostics: input.diagnostics ?? []
  }
}

function toEntries(
  nodes: readonly LibraryGraphMediaNode[],
  kind: 'media'
): LibraryGraphNodeEntry<LibraryGraphMediaNode>[]
function toEntries(
  nodes: readonly LibraryGraphCollectionNode[],
  kind: 'collection'
): LibraryGraphNodeEntry<LibraryGraphCollectionNode>[]
function toEntries(
  nodes: readonly LibraryGraphTagNode[],
  kind: 'tag'
): LibraryGraphNodeEntry<LibraryGraphTagNode>[]
function toEntries(
  nodes: readonly LibraryGraphCompanyNode[],
  kind: 'company'
): LibraryGraphNodeEntry<LibraryGraphCompanyNode>[]
function toEntries(
  nodes: readonly LibraryGraphPersonNode[],
  kind: 'person'
): LibraryGraphNodeEntry<LibraryGraphPersonNode>[]
function toEntries(
  nodes: readonly LibraryGraphCharacterNode[],
  kind: 'character'
): LibraryGraphNodeEntry<LibraryGraphCharacterNode>[]
function toEntries(
  nodes: readonly LibraryGraphNoteNode[],
  kind: 'note'
): LibraryGraphNodeEntry<LibraryGraphNoteNode>[]
function toEntries(
  nodes: readonly LibraryGraphSessionNode[],
  kind: 'session'
): LibraryGraphNodeEntry<LibraryGraphSessionNode>[]
function toEntries(
  nodes: readonly LibraryGraphUnitNode[],
  kind: 'unit'
): LibraryGraphNodeEntry<LibraryGraphUnitNode>[]
function toEntries(
  nodes: readonly LibraryGraphAttachmentNode[],
  kind: 'attachment'
): LibraryGraphNodeEntry<LibraryGraphAttachmentNode>[]
function toEntries(
  nodes: readonly LibraryGraphNode[],
  kind: LibraryGraphNode['kind']
): LibraryGraphNodeEntry[] {
  return nodes.map((node) => ({
    key: node.key,
    kind,
    mediaType: node.kind === 'media' ? node.mediaType : undefined,
    node
  }))
}
