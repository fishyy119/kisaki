<script setup lang="ts">
/**
 * Collections Page
 *
 * Lists all collections for browsing.
 * Entity-agnostic view showing all available collections.
 */

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { StateView } from '@renderer/components/ui/state-view'
import { VirtualGrid } from '@renderer/components/ui/virtual'
import { CollectionInfoFormDialog, CollectionCard } from '@renderer/components/shared/collection'
import { getEntityIcon } from '@renderer/utils/format'
import { useCollectionsList } from '../composables'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

// =============================================================================
// Router
// =============================================================================

const router = useRouter()

// =============================================================================
// Refs
// =============================================================================

const scrollContainerRef = ref<HTMLElement>()

// =============================================================================
// Data (settled during navigation by the route loader)
// =============================================================================

const { collections: collectionList } = useCollectionsList()

// =============================================================================
// State
// =============================================================================

const showCreateDialog = ref(false)

// =============================================================================
// Actions
// =============================================================================

function handleCollectionClick(collectionId: string) {
  router.push({
    name: 'collection-detail',
    params: { collectionId }
  })
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <PageHeader>
      <PageHeaderTitle
        :title="m.library.pages.collectionsTitle"
        :icon="getEntityIcon('collection')"
      >
        {{ m.library.counts.collection({ count: collectionList.length }) }}
      </PageHeaderTitle>

      <template #actions>
        <Button
          size="sm"
          @click="showCreateDialog = true"
        >
          <Icon
            icon="icon-[mdi--plus]"
            class="size-4"
          />
          {{ m.library.pages.newCollection }}
        </Button>
      </template>
    </PageHeader>

    <!-- Collection grid -->
    <div
      ref="scrollContainerRef"
      class="flex-1 overflow-auto bg-background p-4"
    >
      <!-- Empty state -->
      <StateView
        v-if="collectionList.length === 0"
        state="empty"
        icon="icon-[mdi--folder-plus-outline]"
        :title="m.library.pages.collectionsEmptyTitle"
        :description="m.library.pages.collectionsEmptyDescription"
        class="h-full"
      />

      <!-- Grid -->
      <VirtualGrid
        v-else
        :items="collectionList"
        :get-key="(item) => item.id"
        :scroll-parent="scrollContainerRef"
        class="grid grid-cols-[repeat(auto-fill,8rem)] gap-3 justify-between"
      >
        <template #item="{ item }">
          <CollectionCard
            :collection="item"
            size="md"
            @click="handleCollectionClick(item.id)"
          />
        </template>
      </VirtualGrid>
    </div>

    <!-- Create dialog -->
    <CollectionInfoFormDialog
      v-if="showCreateDialog"
      v-model:open="showCreateDialog"
    />
  </div>
</template>
