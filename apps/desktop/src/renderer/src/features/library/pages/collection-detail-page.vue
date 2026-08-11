<script setup lang="ts">
/**
 * Collection Detail Page
 *
 * Library page for viewing collection contents.
 * Uses CollectionProvider for data management and shared CollectionDetailContent.
 * Supports both static collections (link-based) and dynamic collections (filter-based).
 */

import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { StateView } from '@renderer/components/ui/state-view'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import {
  CollectionDetailContent,
  CollectionDropdownMenu,
  CollectionEntitiesFormDialog,
  CollectionDynamicConfigFormDialog,
  CollectionConvertToStaticFormDialog
} from '@renderer/components/shared/collection'
import {
  useAmbientLight,
  useCollectionRouteProvider,
  useDbChanges,
  useIpc
} from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon } from '@renderer/utils/format'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'

const { m } = useI18n()

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()
const router = useRouter()

const collectionId = computed(() => route.params.collectionId as string)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const {
  collection,
  entityType,
  entityCounts,
  configuredEntityTypes,
  setEntityType,
  refetch,
  error
} = useCollectionRouteProvider()

useAmbientLight(() =>
  collection.value?.coverFile
    ? getAttachmentUrl('collections', collection.value.id, collection.value.coverFile, {
        width: 100,
        height: 100
      })
    : null
)

useDbChanges(({ operation, table, id }) => {
  if (operation === 'deleted' && table === 'collections' && id === collectionId.value) {
    router.push('/library/collections')
  }
})

useIpc('library:entity-merged', (_e, event) => {
  if (event.entityType === 'collection' && event.sourceId === collectionId.value) {
    router.replace({ path: `/library/collection/${event.targetId}`, query: route.query })
  }
})

// =============================================================================
// State
// =============================================================================

const editEntitiesOpen = ref(false)
const editFilterOpen = ref(false)
const convertDialogOpen = ref(false)

// Scroll container ref for VirtualGrid
const scrollContainerRef = ref<HTMLElement>()

// =============================================================================
// Computed
// =============================================================================

const isDynamic = computed(() => collection.value?.isDynamic ?? false)
const totalCount = computed(() => Object.values(entityCounts.value).reduce((a, b) => a + b, 0))

// Wrapper for entityType to use with v-model
const entityTypeModel = computed({
  get: () => entityType.value,
  set: (type: ContentEntityType) => setEntityType(type)
})

// =============================================================================
// Actions
// =============================================================================

function handleEntityClick(payload: { type: ContentEntityType; id: string }) {
  if (!collection.value) return
  router.push({
    path: getEntityDetailPath(payload.type, payload.id),
    query: { from: `collection:${collection.value.id}` }
  })
}
</script>

<template>
  <!-- Error / Not Found (data settles before navigation confirms) -->
  <StateView
    v-if="error"
    state="error"
    :error="error"
    class="h-full bg-background"
  />
  <StateView
    v-else-if="!collection"
    state="not-found"
    :icon="getEntityIcon('collection')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.collection })"
    class="h-full bg-background"
  />

  <!-- Content -->
  <div
    v-else
    class="h-full flex flex-col w-full"
  >
    <!-- Header -->
    <PageHeader>
      <PageHeaderTitle
        :title="collection.name"
        :icon="getEntityIcon('collection')"
      />
      <Icon
        v-if="isDynamic"
        icon="icon-[mdi--lightning-bolt]"
        class="size-4 shrink-0"
        :title="m.library.pages.dynamicCollection"
      />

      <template #actions>
        <!-- Entity type segmented control -->
        <SegmentedControl v-model="entityTypeModel">
          <SegmentedControlItem
            v-for="type in CONTENT_ENTITY_TYPES"
            :key="type"
            :value="type"
            :disabled="isDynamic && !configuredEntityTypes.includes(type)"
            :class="isDynamic && !configuredEntityTypes.includes(type) ? 'opacity-50' : ''"
          >
            {{ m.library.entities[type] }}
            <span
              v-if="entityCounts[type] > 0"
              class="ml-1 text-xs text-muted-foreground"
            >
              ({{ entityCounts[type] }})
            </span>
          </SegmentedControlItem>
        </SegmentedControl>

        <!-- For static collections: edit content button -->
        <Button
          v-if="!isDynamic"
          variant="secondary"
          size="sm"
          @click="editEntitiesOpen = true"
        >
          <Icon
            icon="icon-[mdi--format-list-numbered]"
            class="size-4 mr-1.5"
          />
          {{ m.library.menu.editContent }}
        </Button>

        <!-- For dynamic collections: edit filter and convert buttons -->
        <template v-if="isDynamic">
          <Button
            variant="secondary"
            size="sm"
            @click="editFilterOpen = true"
          >
            <Icon
              icon="icon-[mdi--filter-outline]"
              class="size-4 mr-1.5"
            />
            {{ m.library.menu.editFilter }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            @click="convertDialogOpen = true"
          >
            <Icon
              icon="icon-[mdi--arrow-bottom-left]"
              class="size-4 mr-1.5"
            />
            {{ m.library.menu.convertToStatic }}
          </Button>
        </template>

        <!-- Dropdown menu -->
        <CollectionDropdownMenu
          v-if="collectionId"
          :collection-id="collectionId"
          navigate-on-delete
        />
      </template>
    </PageHeader>

    <!-- Main content -->
    <div
      ref="scrollContainerRef"
      class="flex-1 overflow-auto bg-background p-4"
    >
      <CollectionDetailContent
        :scroll-parent="scrollContainerRef"
        @entity-click="handleEntityClick"
      />
    </div>

    <!-- Edit entities dialog - static mode only -->
    <CollectionEntitiesFormDialog
      v-if="collectionId && !isDynamic && editEntitiesOpen"
      v-model:open="editEntitiesOpen"
      :collection-id="collectionId"
    />

    <!-- Edit filter dialog - dynamic mode only -->
    <CollectionDynamicConfigFormDialog
      v-if="isDynamic && editFilterOpen"
      v-model:open="editFilterOpen"
      :collection-id="collectionId!"
      @updated="refetch()"
    />

    <!-- Convert to static confirmation dialog -->
    <CollectionConvertToStaticFormDialog
      v-if="isDynamic && convertDialogOpen"
      v-model:open="convertDialogOpen"
      :collection-id="collectionId!"
      :total-count="totalCount"
      @converted="refetch()"
    />
  </div>
</template>
