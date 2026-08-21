import type { LibraryGraphEdge, LibraryGraphNodeKind } from '@kisaki3/extension-api'

export function graphNodeIdentity(kind: LibraryGraphNodeKind, key: string): string {
  return `${kind}:${key}`
}

export function edgeIdentity(edge: LibraryGraphEdge): string {
  switch (edge.kind) {
    case 'media-company':
    case 'media-person':
    case 'media-character':
    case 'character-person':
      return `${edge.kind}:${edge.from.kind}:${edge.from.key}:${edge.to.kind}:${edge.to.key}:${edge.role}`
    case 'media-media':
    case 'company-company':
      return `${edge.kind}:${edge.from.kind}:${edge.from.key}:${edge.to.kind}:${edge.to.key}:${edge.type}`
    case 'media-cast':
      return `${edge.kind}:${edge.from.kind}:${edge.from.key}:${edge.to.kind}:${edge.to.key}:${edge.person.kind}:${edge.person.key}`
    case 'media-attachment':
      return `${edge.kind}:${edge.from.kind}:${edge.from.key}:${edge.to.kind}:${edge.to.key}:${edge.slot}`
    default:
      return `${edge.kind}:${edge.from.kind}:${edge.from.key}:${edge.to.kind}:${edge.to.key}`
  }
}
