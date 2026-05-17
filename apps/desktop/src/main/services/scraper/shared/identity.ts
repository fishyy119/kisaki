import { normalizeKeyText, type ExternalId } from '@shared/identity'

function hasProviderExternalId(
  externalIds: ExternalId[],
  externalIdSource: string,
  entityId: string
): boolean {
  const normalizedSource = normalizeKeyText(externalIdSource)
  const normalizedId = normalizeKeyText(entityId)

  return externalIds.some(
    (externalId) =>
      normalizeKeyText(externalId.source) === normalizedSource &&
      normalizeKeyText(externalId.id) === normalizedId
  )
}

export function ensureProviderExternalId<T extends { externalIds: ExternalId[] }>(
  entity: T,
  externalIdSource: string,
  entityId: string
): T {
  if (hasProviderExternalId(entity.externalIds, externalIdSource, entityId)) {
    return entity
  }

  return {
    ...entity,
    externalIds: [{ source: externalIdSource, id: entityId }, ...entity.externalIds]
  }
}
