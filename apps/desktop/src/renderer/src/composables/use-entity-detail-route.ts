/**
 * Entity detail route navigation.
 *
 * Keeps a detail route pointed at a live entity: a deleted entity leaves for the
 * library home, and a merged entity follows the surviving target. `exit` is also
 * what the not-found placeholder offers, so a stale URL and a just-deleted entity
 * land on the same surface.
 */

import { toValue, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ENTITY_TABLES } from '@renderer/core/db'
import { getEntityDetailPath, LIBRARY_HOME_PATH } from '@renderer/utils/entity-routes'
import type { AllEntityType } from '@shared/common'
import { useDbChanges } from './use-db-changes'
import { useIpc } from './use-ipc'

export interface EntityDetailRoute {
  /** Leaves the detail route for the library home. */
  exit: () => void
}

export function useEntityDetailRoute(
  entityType: AllEntityType,
  entityId: MaybeRefOrGetter<string>
): EntityDetailRoute {
  const route = useRoute()
  const router = useRouter()
  const { tableName } = ENTITY_TABLES[entityType]

  function exit(): void {
    // The browse surface the entity came from may be gone or now empty, so every
    // detail route exits to the same predictable place. Replaces, so history never
    // keeps an entry for an entity that is gone.
    void router.replace(LIBRARY_HOME_PATH)
  }

  useDbChanges(({ changes }) => {
    const deleted = changes.some(
      (change) =>
        change.operation === 'deleted' &&
        change.table === tableName &&
        change.id === toValue(entityId)
    )
    if (deleted) exit()
  })

  useIpc('library:entity-merged', (_e, event) => {
    if (event.entityType === entityType && event.sourceId === toValue(entityId)) {
      void router.replace({
        path: getEntityDetailPath(entityType, event.targetId),
        query: route.query
      })
    }
  })

  return { exit }
}
