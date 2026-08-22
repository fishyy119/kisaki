/**
 * Entity picker data source.
 *
 * Content-entity selects differ only in which entity they list, so the query,
 * NSFW visibility, change-feed refresh and combobox projection live here. Rows
 * arrive in the entity's default library order, so a picker lists entries the
 * same way the library does.
 */

import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { storeToRefs } from 'pinia'
import { ENTITY_TABLES, queryEntities } from '@renderer/core/db'
import { usePreferencesStore } from '@renderer/stores'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import type { VirtualizedComboboxEntity } from '@renderer/components/ui/virtualized-combobox'
import type { ContentEntityType } from '@shared/common'
import { useAsyncData } from './use-async-data'
import { useDbChanges } from './use-db-changes'

export function useEntitySelectSource(
  entityType: ContentEntityType,
  excludeIds: MaybeRefOrGetter<readonly string[]>
): ComputedRef<VirtualizedComboboxEntity[]> {
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, refetch } = useAsyncData(
    () => queryEntities(entityType, { includeNsfw: showNsfw.value }),
    { watch: [showNsfw] }
  )

  useDbChanges(({ table }) => {
    if (table === ENTITY_TABLES[entityType].tableName) refetch()
  })

  return computed(() => {
    const excluded = new Set(toValue(excludeIds))
    return (data.value ?? [])
      .filter((row) => !excluded.has(row.id))
      .map((row) => ({
        id: row.id,
        name: row.name,
        subText: row.originalName || undefined,
        imageUrl: getEntityImageUrl(entityType, row, 'cover', { width: 100, height: 100 })
      }))
  })
}
