import type { IngestHooks } from '@main/services/ingest/hooks'
import { CONTENT_ENTITY_TYPES } from '@shared/entity-types'
import type { ExtensionHookContributionPoint } from '../point'

/**
 * Binds ingest module hooks to their public hook points. The binding walks the
 * entity union, so every entity type exposes the same four edges and a new type
 * needs no binding work.
 */
export function bindIngestHookPoints(
  ingest: IngestHooks,
  point: ExtensionHookContributionPoint
): void {
  for (const entity of CONTENT_ENTITY_TYPES) {
    const hooks = ingest[entity]
    hooks.committing.tap(
      async (p) => (await point.veto(`ingest.${entity}.committing`, p)) ?? undefined
    )
    hooks.committed.tap((p) => point.notify(`ingest.${entity}.committed`, p))
    hooks.updating.tap(async (p) => (await point.veto(`ingest.${entity}.updating`, p)) ?? undefined)
    hooks.updated.tap((p) => point.notify(`ingest.${entity}.updated`, p))
  }
}
