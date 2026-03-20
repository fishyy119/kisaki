import type { ExternalId } from '@shared/identity'

function hasLeadingProviderExternalId(
  externalIds: ExternalId[],
  providerId: string,
  entityId: string
): boolean {
  const first = externalIds[0]
  return first?.source === providerId && first.id === entityId
}

export function ensureProviderExternalId<T extends { externalIds: ExternalId[] }>(
  entity: T,
  providerId: string,
  entityId: string
): T {
  if (hasLeadingProviderExternalId(entity.externalIds, providerId, entityId)) {
    return entity
  }

  return {
    ...entity,
    externalIds: [{ source: providerId, id: entityId }, ...entity.externalIds]
  }
}
