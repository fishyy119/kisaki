<script setup lang="ts">
/**
 * Uncategorized Page
 *
 * Displays entities that are not assigned to any collection.
 */

import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { StateView } from '@renderer/components/ui/state-view'
import { VirtualGrid } from '@renderer/components/ui/virtual'
import { EntityCard } from '@renderer/components/shared'
import type { ContentEntityData } from '@renderer/composables'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import type { ContentEntityType } from '@shared/common'
import { useUncategorized } from '../composables'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

// =============================================================================
// Route
// =============================================================================

const route = useRoute()
const router = useRouter()
const scrollContainerRef = ref<HTMLElement>()

const entityType = computed(() => (route.params.entityType as ContentEntityType) || 'game')

// =============================================================================
// Data (settled during navigation by the route loader)
// =============================================================================

const { entities } = useUncategorized()

// =============================================================================
// Actions
// =============================================================================

function handleEntityClick(entity: ContentEntityData) {
  router.push({
    path: getEntityDetailPath(entityType.value, entity.id),
    query: { from: 'uncategorized' }
  })
}
</script>

<template>
  <div class="h-full flex flex-col w-full">
    <!-- Header -->
    <PageHeader>
      <PageHeaderTitle
        :title="m.library.pages.uncategorizedTitle({ label: m.library.entities[entityType] })"
        icon="icon-[mdi--folder-question-outline]"
      >
        {{ m.library.counts[entityType]({ count: entities.length }) }}
      </PageHeaderTitle>
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
        icon="icon-[mdi--check-circle-outline]"
        :description="m.library.pages.uncategorizedEmpty({ label: m.library.entities[entityType] })"
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
