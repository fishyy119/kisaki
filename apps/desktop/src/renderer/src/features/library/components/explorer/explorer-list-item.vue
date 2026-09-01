<script setup lang="ts">
/**
 * ExplorerListItem - Single entity item
 *
 * Renders a single entity in the explorer list with lazy-loaded images.
 * Each entity is wrapped with its corresponding context menu. The row whose
 * key matches the locator's current instance carries the active highlight
 * and reports its element for viewport tracking.
 */

import {
  computed,
  inject,
  useTemplateRef,
  watch,
  type Component,
  type ComponentPublicInstance,
  type ComputedRef
} from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Icon } from '@renderer/components/ui/icon'
import { EntityContextMenu, EntityBatchContextMenu } from '@renderer/components/shared/entity'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import { getEntityIcon } from '@renderer/utils/format'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import { useLibraryExplorerStore } from '../../stores'
import { useExplorerLocator } from '../../composables'
import { parseExplorerSelectionKey, toExplorerSelectionKey } from '../../utils/explorer-selection'
import type { EntityData } from '../../composables'
import type { ContentEntityType } from '@shared/common'

interface Props {
  entity: EntityData
  entityType: ContentEntityType
  from: string
}

const props = defineProps<Props>()

const store = useLibraryExplorerStore()
const { selectedKeys } = storeToRefs(store)
const locator = useExplorerLocator()

const visibleSelectionKeys = inject<ComputedRef<string[]>>(
  'explorerVisibleSelectionKeys',
  computed(() => [])
)

const rowKey = computed(() => toExplorerSelectionKey(props.from, props.entity.id))

const isSelected = computed(() => selectedKeys.value.includes(rowKey.value))
const useBatchMenu = computed(() => isSelected.value && selectedEntityIds.value.length > 1)

const selectedEntityIds = computed(() => {
  const ids = selectedKeys.value.map((key) => parseExplorerSelectionKey(key).id)
  return [...new Set(ids)]
})

const detailPath = computed(() => getEntityDetailPath(props.entityType, props.entity.id))

const linkQuery = computed(() => ({ from: props.from }))

/** This row stands for the entity of the active detail route. */
const isCurrent = computed(() => locator.currentInstanceKey.value === rowKey.value)

// While current, report the rendered element so the locator can track
// whether the active row is inside the scroll viewport. RouterLink's own
// instance type omits $el, so the ref types against the generic instance.
const linkRef = useTemplateRef<ComponentPublicInstance>('link')

const rowElement = computed<HTMLElement | null>(() => {
  const el = linkRef.value?.$el as unknown
  return el instanceof HTMLElement ? el : null
})

watch(
  [isCurrent, rowElement],
  ([current, el], _previous, onCleanup) => {
    if (!current || !el) return
    onCleanup(locator.registerCurrentRow(el))
  },
  { immediate: true }
)

const imageUrl = computed(() =>
  getEntityImageUrl(props.entityType, props.entity, 'icon', { width: 100, height: 100 })
)

const entityIcon = computed(() => getEntityIcon(props.entityType))

/**
 * The row markup is identical for every entity type; only the context menu that
 * wraps it differs, so the wrapper is resolved here instead of in the template.
 */
const contextMenu = computed<{ component: Component; props: Record<string, unknown> }>(() =>
  useBatchMenu.value
    ? {
        component: EntityBatchContextMenu,
        props: { entityType: props.entityType, entityIds: selectedEntityIds.value }
      }
    : {
        component: EntityContextMenu,
        props: { entityType: props.entityType, entityId: props.entity.id }
      }
)

function handleClick(e: MouseEvent) {
  if (e.shiftKey) {
    e.preventDefault()
    e.stopPropagation()
    store.selectRange(rowKey.value, visibleSelectionKeys.value, e.ctrlKey || e.metaKey)
    return
  }

  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    e.stopPropagation()
    store.toggleSelection(rowKey.value)
    return
  }

  store.setSelection([rowKey.value], rowKey.value)
}
</script>

<template>
  <component
    :is="contextMenu.component"
    v-bind="contextMenu.props"
    @deleted="store.clearSelection()"
  >
    <RouterLink
      ref="link"
      :to="{ path: detailPath, query: linkQuery }"
      class="group relative flex items-center h-6 pl-4 pr-2 text-xs rounded-r-md text-muted-foreground hover:text-foreground hover:bg-accent/70 [&.is-current]:text-accent-foreground [&.is-current]:bg-accent [&.is-current]:shadow-raised [&.is-selected]:text-foreground [&.is-selected]:bg-accent/50"
      :class="{ 'is-current': isCurrent, 'is-selected': isSelected && !isCurrent }"
      @click="handleClick"
    >
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="props.entity.name"
        class="size-4 rounded-sm mr-1.5 border shadow-raised object-cover"
      />
      <Icon
        v-else
        :icon="entityIcon"
        class="size-4 text-muted-foreground/50 mr-1.5"
      />
      <span class="truncate">{{ props.entity.name }}</span>
    </RouterLink>
  </component>
</template>
