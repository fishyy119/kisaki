<script setup lang="ts">
/**
 * Favorites Page
 *
 * Displays entities marked as favorite (isFavorite = true).
 */

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { StateView } from '@renderer/components/ui/state-view'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { VirtualGrid } from '@renderer/components/ui/virtual'
import { EntityCard } from '@renderer/components/shared'
import type { ContentEntityData } from '@renderer/composables'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import { formatLibraryContext } from '@renderer/utils/library-context'
import { CONTENT_ENTITY_TYPES } from '@shared/common'
import { useFavorites } from '../composables'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

// =============================================================================
// Router
// =============================================================================

const router = useRouter()

// =============================================================================
// Data (settled during navigation by the route loader)
// =============================================================================

const { entities, entityType } = useFavorites()

const scrollContainerRef = ref<HTMLElement>()

// =============================================================================
// Actions
// =============================================================================

function handleEntityClick(entity: ContentEntityData) {
  router.push({
    path: getEntityDetailPath(entityType.value, entity.id),
    query: { from: formatLibraryContext({ kind: 'favorites' }) }
  })
}
</script>

<template>
  <div class="h-full flex flex-col w-full">
    <!-- Header -->
    <PageHeader>
      <PageHeaderTitle
        :title="m.library.pages.favoritesTitle"
        icon="icon-[mdi--heart-outline]"
      >
        {{ m.library.counts[entityType]({ count: entities.length }) }}
      </PageHeaderTitle>

      <template #actions>
        <!-- Entity type segmented control -->
        <SegmentedControl v-model="entityType">
          <SegmentedControlItem
            v-for="type in CONTENT_ENTITY_TYPES"
            :key="type"
            :value="type"
          >
            {{ m.library.entities[type] }}
          </SegmentedControlItem>
        </SegmentedControl>
      </template>
    </PageHeader>

    <!-- Content -->
    <div
      ref="scrollContainerRef"
      class="flex-1 overflow-auto bg-background p-4"
    >
      <!-- Empty state -->
      <StateView
        v-if="entities.length === 0"
        state="empty"
        icon="icon-[mdi--heart-off-outline]"
        :description="m.library.pages.favoritesEmpty({ label: m.library.entities[entityType] })"
        class="h-full"
      />

      <!-- Grid -->
      <VirtualGrid
        v-else
        :items="entities"
        :get-key="(item) => item.id"
        :scroll-parent="scrollContainerRef"
        class="grid grid-cols-[repeat(auto-fill,8rem)] gap-3 justify-between"
      >
        <template #item="{ item }">
          <EntityCard
            :entity-type="entityType"
            :entity="item"
            size="md"
            @click="handleEntityClick(item)"
          />
        </template>
      </VirtualGrid>
    </div>
  </div>
</template>
