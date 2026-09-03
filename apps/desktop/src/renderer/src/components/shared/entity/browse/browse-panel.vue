<!--
  EntityBrowsePanel
  Body of a content entity browse surface: the query band, then the scrolling
  card grid with its empty and no-match placeholders. Owns the scroll region;
  the host sizes the panel and paints its plane (pages pass `bg-background`,
  dialogs sit on the dialog slab) - the band carries fill only, never a pane.

  The region's memory identity is the host's identity (a page passes its route
  path; a dialog passes none) plus the list query: the same list restores its
  offset, and a query change (type, search, filter, sort) is a new list that
  enters at the top.
-->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { StateView } from '@renderer/components/ui/state-view'
import type { ContentEntityCounts, ContentEntityData } from '@renderer/composables/content-entities'
import {
  clearEntityListQuery,
  hasActiveEntityListQuery,
  type EntityListQuery
} from '@renderer/composables/entity-list-query'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import { getEntityIcon } from '@renderer/utils/format'
import type { ContentEntityType } from '@shared/entity-types'
import EntityBrowseGrid from './browse-grid.vue'
import EntityBrowseToolbar from './browse-toolbar.vue'

interface Props {
  /** Type being shown; the query only carries the request. */
  entityType: ContentEntityType
  entities: ContentEntityData[]
  counts: ContentEntityCounts
  disabledTypes?: readonly ContentEntityType[]
  /** Label of the scope's own order, the first sort option. */
  membershipLabel: string
  /** Placeholder when the scope holds nothing of this type (no query active). */
  emptyIcon?: string
  emptyTitle?: string
  emptyDescription?: string
  /** Host identity the scroll memory is scoped to (a page's route path); omit for no memory. */
  memory?: string
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  disabledTypes: () => []
})

const query = defineModel<EntityListQuery>('query', { required: true })

const emit = defineEmits<{
  open: [entityType: ContentEntityType, id: string]
}>()

const { m } = useI18n()

const memory = computed(() =>
  props.memory !== undefined ? `${props.memory}?${JSON.stringify(query.value)}` : undefined
)

const isQueryActive = computed(() => hasActiveEntityListQuery(query.value))

function handleClearQuery() {
  query.value = clearEntityListQuery(query.value)
}
</script>

<template>
  <div :class="cn('flex min-h-0 flex-col', props.class)">
    <EntityBrowseToolbar
      v-model:query="query"
      :entity-type="props.entityType"
      :counts="props.counts"
      :disabled-types="props.disabledTypes"
      :membership-label="props.membershipLabel"
      :filtered-count="props.entities.length"
    />

    <ScrollRegion
      :memory="memory"
      class="p-4"
    >
      <StateView
        v-if="props.entities.length === 0 && isQueryActive"
        state="empty"
        icon="icon-[mdi--filter-off-outline]"
        :title="m.library.browse.noMatchTitle"
        :description="m.library.browse.noMatchDescription"
        class="h-full"
      >
        <template #actions>
          <Button
            variant="outline"
            size="sm"
            @click="handleClearQuery"
          >
            {{ m.library.browse.clearQuery }}
          </Button>
        </template>
      </StateView>

      <StateView
        v-else-if="props.entities.length === 0"
        state="empty"
        :icon="props.emptyIcon ?? getEntityIcon(props.entityType)"
        :title="props.emptyTitle"
        :description="props.emptyDescription"
        class="h-full"
      />

      <EntityBrowseGrid
        v-else
        :entity-type="props.entityType"
        :entities="props.entities"
        @open="(entityType, id) => emit('open', entityType, id)"
      />
    </ScrollRegion>
  </div>
</template>
