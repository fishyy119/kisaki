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
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { StateView } from '@renderer/components/ui/state-view'
import { VirtualGrid } from '@renderer/components/ui/virtual'
import { CollectionInfoFormDialog, CollectionCard } from '@renderer/components/shared/collection'
import { getEntityIcon } from '@renderer/utils/format'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import { useCollectionsList } from '../composables'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

// =============================================================================
// Router
// =============================================================================

const router = useRouter()

// =============================================================================
// Data (committed by the route query before the page mounts)
// =============================================================================

const { collections: collectionList, error } = useCollectionsList()

// =============================================================================
// State
// =============================================================================

const showCreateDialog = ref(false)

// =============================================================================
// Actions
// =============================================================================

function handleCollectionClick(collectionId: string) {
  router.push(getEntityDetailPath('collection', collectionId))
}
</script>

<template>
  <StateView
    v-if="error"
    state="error"
    :error="error"
    class="h-full bg-background"
  />

  <div
    v-else
    class="h-full flex flex-col"
  >
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
    <ScrollRegion class="bg-background p-4">
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
        scroll="region"
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
    </ScrollRegion>

    <!-- Create dialog -->
    <CollectionInfoFormDialog
      v-if="showCreateDialog"
      v-model:open="showCreateDialog"
    />
  </div>
</template>
