import { normalizeExternalIds, normalizeKeyText, type ExternalId } from '@shared/identity'
import type { ScrapedEntityIdentity } from '@shared/scraper'

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

export function mergeScrapedIdentities(
  ...identities: Array<ScrapedEntityIdentity | null | undefined>
): ScrapedEntityIdentity {
  return {
    externalIds: normalizeExternalIds(identities.flatMap((identity) => identity?.externalIds ?? []))
  }
}

export function createProviderIdentity(
  externalIdSource: string,
  entityId: string
): ScrapedEntityIdentity {
  return mergeScrapedIdentities({
    externalIds: [{ source: externalIdSource, id: entityId }]
  })
}

export function ensureProviderIdentity(
  identity: ScrapedEntityIdentity | null | undefined,
  externalIdSource: string,
  entityId: string
): ScrapedEntityIdentity {
  return mergeScrapedIdentities(createProviderIdentity(externalIdSource, entityId), identity)
}
