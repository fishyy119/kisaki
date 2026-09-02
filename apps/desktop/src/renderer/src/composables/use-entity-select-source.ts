/**
 * Entity picker data source.
 *
 * Content-entity selects differ only in which entity they list, so the query,
 * NSFW visibility, change-feed refresh and combobox projection live here. Rows
 * arrive in the entity's default library order, so a picker lists entries the
 * same way the library does. Only display columns are loaded: a picker never
 * needs whole rows.
 */

import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { storeToRefs } from 'pinia'
import { ENTITY_TABLES, queryEntityPickerRows } from '@renderer/core/db'
import { usePreferencesStore } from '@renderer/stores'
import { getEntityAttachmentUrl } from '@renderer/utils/entity-image'
import type { VirtualizedComboboxEntity } from '@renderer/components/ui/virtualized-combobox'
import type { ContentEntityType } from '@shared/entity-types'
import { useAsyncData } from './use-async-data'
import { useDbChanges } from './use-db-changes'

export function useEntitySelectSource(
  entityType: ContentEntityType,
  excludeIds: MaybeRefOrGetter<readonly string[]>
): ComputedRef<VirtualizedComboboxEntity[]> {
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, refetch } = useAsyncData(
    () => queryEntityPickerRows(entityType, { includeNsfw: showNsfw.value }),
    { watch: [showNsfw] }
  )

  useDbChanges(({ tables }) => {
    if (tables.has(ENTITY_TABLES[entityType].tableName)) refetch()
  })

  return computed(() => {
    const excluded = new Set(toValue(excludeIds))
    return (data.value ?? [])
      .filter((row) => !excluded.has(row.id))
      .map((row) => ({
        id: row.id,
        name: row.name,
        subText: row.originalName || undefined,
        imageUrl: row.imageFile
          ? getEntityAttachmentUrl(entityType, row.id, row.imageFile, { width: 100, height: 100 })
          : null
      }))
  })
}
