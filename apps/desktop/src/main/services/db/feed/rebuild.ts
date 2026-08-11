import type { RawDbChange } from '@shared/db/changes'
import type { LibraryMediaRelationSnapshot } from '@shared/library'
import type { ExternalId } from '@shared/identity'
import type { MediaRelationTables } from './types'
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

export function rebuildRelationSnapshotBefore(
  after: LibraryMediaRelationSnapshot,
  tables: MediaRelationTables,
  changes: RawDbChange[]
): LibraryMediaRelationSnapshot {
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
    )
  }
}

/**
 * Rebuilds the id set of rows whose flag column was set, from the current set
 * and the raw row changes that produced it.
 */
export function rebuildWatchedIdSetBefore(
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

    if (change.old && change.old[flagColumn] !== null && change.old[flagColumn] !== undefined) {
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
