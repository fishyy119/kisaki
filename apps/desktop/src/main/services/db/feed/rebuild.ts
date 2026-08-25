import type { RawDbChange } from '@shared/db/changes'
import type { LibraryMediaLinkSnapshot, LibraryMediaRelationEdge } from '@shared/library'
import type { ExternalId } from '@shared/identity'
import type { MediaLinkTables } from './types'
import { stringValue } from './shared/normalization'

export function rebuildExternalIdsBefore(
  after: ExternalId[],
  changes: RawDbChange[]
): ExternalId[] {
  const byKey = new Map(after.map((externalId) => [externalIdKey(externalId), externalId]))

  for (const change of [...changes].reverse()) {
    const oldValue = rowToExternalId(change.old)
    const nextValue = rowToExternalId(change.next)

    if (change.operation === 'inserted' && nextValue) {
      byKey.delete(externalIdKey(nextValue))
    } else if (change.operation === 'deleted' && oldValue) {
      byKey.set(externalIdKey(oldValue), oldValue)
    } else if (change.operation === 'updated') {
      if (nextValue) {
        byKey.delete(externalIdKey(nextValue))
      }
      if (oldValue) {
        byKey.set(externalIdKey(oldValue), oldValue)
      }
    }
  }

  return [...byKey.values()].sort(compareExternalIds)
}

export function rebuildIdSetBefore(
  after: string[],
  changes: RawDbChange[],
  field: string
): string[] {
  const ids = new Set(after)

  for (const change of [...changes].reverse()) {
    const oldValue = stringValue(change.old?.[field])
    const nextValue = stringValue(change.next?.[field])

    if (change.operation === 'inserted' && nextValue) {
      ids.delete(nextValue)
    } else if (change.operation === 'deleted' && oldValue) {
      ids.add(oldValue)
    } else if (change.operation === 'updated') {
      if (nextValue) {
        ids.delete(nextValue)
      }
      if (oldValue) {
        ids.add(oldValue)
      }
    }
  }

  return [...ids].sort()
}

/** Either link facet: cast is present only for media types that credit actors. */
type MediaLinkSnapshot = LibraryMediaLinkSnapshot & { castLinkIds?: string[] }

export function rebuildLinkSnapshotBefore(
  after: MediaLinkSnapshot,
  tables: MediaLinkTables,
  changes: RawDbChange[]
): MediaLinkSnapshot {
  return {
    personLinkIds: rebuildIdSetBefore(
      after.personLinkIds,
      changes.filter((change) => change.table === tables.person),
      'id'
    ),
    companyLinkIds: rebuildIdSetBefore(
      after.companyLinkIds,
      changes.filter((change) => change.table === tables.company),
      'id'
    ),
    characterLinkIds: rebuildIdSetBefore(
      after.characterLinkIds,
      changes.filter((change) => change.table === tables.character),
      'id'
    ),
    // Absent on print media, where the facet has no cast field at all.
    ...(after.castLinkIds
      ? {
          castLinkIds: rebuildIdSetBefore(
            after.castLinkIds,
            changes.filter((change) => change.table === tables.cast),
            'id'
          )
        }
      : {})
  }
}

/**
 * Rebuilds an entity's outgoing relation edges before the given raw changes,
 * by reverse-applying them onto the current edge set.
 */
export function rebuildMediaRelationEdgesBefore(
  after: LibraryMediaRelationEdge[],
  changes: RawDbChange[],
  mediaType: string,
  mediaId: string
): LibraryMediaRelationEdge[] {
  const edges = new Map(after.map((edge) => [mediaRelationEdgeKey(edge), edge]))

  for (const change of [...changes].reverse()) {
    const nextEdge = toOutgoingEdge(change.next, mediaType, mediaId)
    if (nextEdge) {
      edges.delete(mediaRelationEdgeKey(nextEdge))
    }

    const oldEdge = toOutgoingEdge(change.old, mediaType, mediaId)
    if (oldEdge) {
      edges.set(mediaRelationEdgeKey(oldEdge), oldEdge)
    }
  }

  return [...edges.values()]
}

function mediaRelationEdgeKey(edge: LibraryMediaRelationEdge): string {
  return `${edge.toType}\0${edge.toId}\0${edge.type}`
}

function toOutgoingEdge(
  row: Record<string, unknown> | undefined,
  mediaType: string,
  mediaId: string
): LibraryMediaRelationEdge | null {
  if (!row || row.from_type !== mediaType || stringValue(row.from_id) !== mediaId) {
    return null
  }

  const toType = stringValue(row.to_type)
  const toId = stringValue(row.to_id)
  const type = stringValue(row.type)
  if (!toType || !toId || !type) {
    return null
  }

  return { toType, toId, type } as LibraryMediaRelationEdge
}

/**
 * Rebuilds the id set of rows whose boolean flag column was set, from the
 * current set and the raw row changes that produced it. Flags arrive as the
 * driver's stored `0` / `1`, so truthiness is the test.
 */
export function rebuildFlaggedIdSetBefore(
  after: string[],
  changes: RawDbChange[],
  flagColumn: string
): string[] {
  const ids = new Set(after)

  for (const change of [...changes].reverse()) {
    const id = stringValue(change.old?.id) ?? stringValue(change.next?.id)
    if (!id) {
      continue
    }

    if (change.old?.[flagColumn]) {
      ids.add(id)
    } else if (change.operation !== 'deleted') {
      ids.delete(id)
    }
  }

  return [...ids].sort()
}

function rowToExternalId(row: Record<string, unknown> | undefined): ExternalId | null {
  const source = stringValue(row?.source)
  const id = stringValue(row?.external_id)
  return source && id ? { source, id } : null
}

function externalIdKey(externalId: ExternalId): string {
  return `${externalId.source}:${externalId.id}`
}

function compareExternalIds(left: ExternalId, right: ExternalId): number {
  return externalIdKey(left).localeCompare(externalIdKey(right))
}
