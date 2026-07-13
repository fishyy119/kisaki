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
import { db } from '@renderer/core/db'
import { useAsyncData, useEvent, useRenderState } from '@renderer/composables'
import { collections } from '@shared/db'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '@renderer/stores'
import { eq } from 'drizzle-orm'

// =============================================================================
// Router
// =============================================================================

const router = useRouter()

// =============================================================================
// Refs
// =============================================================================

const scrollContainerRef = ref<HTMLElement>()

const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

// =============================================================================
// Data
// =============================================================================

const {
  data: collectionList,
  isLoading,
  error,
  refetch
} = useAsyncData(
  async () =>
    await db
      .select()
      .from(collections)
      .where(showNsfw.value ? undefined : eq(collections.isNsfw, false)),
  { watch: [showNsfw] }
)
const state = useRenderState(isLoading, error, collectionList)

// =============================================================================
// State
// =============================================================================

const showCreateDialog = ref(false)

// =============================================================================
// Event Listeners
// =============================================================================

useEvent('db.inserted', ({ table }) => {
  if (table === 'collections') refetch()
})
useEvent('db.updated', ({ table }) => {
  if (table === 'collections') refetch()
})
useEvent('db.deleted', ({ table }) => {
  if (table === 'collections') refetch()
})

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
  <!-- Loading state -->
  <StateView
    v-if="state === 'loading'"
    state="loading"
    class="h-full bg-background"
  />

  <!-- Content -->
  <div
    v-else
    class="h-full flex flex-col"
  >
    <!-- Header -->
    <PageHeader back-to="/library">
      <PageHeaderTitle
        title="合集"
        :icon="getEntityIcon('collection')"
      >
        {{ collectionList?.length ?? 0 }} 个
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
          新建合集
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
        v-if="!collectionList || collectionList.length === 0"
        state="empty"
        icon="icon-[mdi--folder-plus-outline]"
        title="暂无合集"
        description="创建合集来整理你的媒体库"
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
