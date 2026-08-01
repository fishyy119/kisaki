import type { RawDbChange } from '@shared/db/changes'
import type { LibraryGameRelationSnapshot } from '@shared/library'
import type { ExternalId } from '@shared/identity'
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
  after: LibraryGameRelationSnapshot,
  changes: RawDbChange[]
): LibraryGameRelationSnapshot {
  return {
    personLinkIds: rebuildIdSetBefore(
      after.personLinkIds,
      changes.filter((change) => change.table === 'game_person_links'),
      'id'
    ),
    companyLinkIds: rebuildIdSetBefore(
      after.companyLinkIds,
      changes.filter((change) => change.table === 'game_company_links'),
      'id'
    ),
    characterLinkIds: rebuildIdSetBefore(
      after.characterLinkIds,
      changes.filter((change) => change.table === 'game_character_links'),
      'id'
    )
  }
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
