<script setup lang="ts">
/**
 * Tag Detail Page
 *
 * Full page view for tag detail, used by routing.
 * Uses TagProvider for data management and shared TagDetailContent.
 */

import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { StateView } from '@renderer/components/ui/state-view'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import {
  TagDetailContent,
  TagDropdownMenu,
  TagInfoFormDialog
} from '@renderer/components/shared/tag'
import { useDbChanges, useTagRouteProvider } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'

const { m } = useI18n()

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()
const router = useRouter()

const tagId = computed(() => route.params.tagId as string)
const backTo = computed(() => (route.query.from as string) || '/library')

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const { tag, entityType, entityCounts, setEntityType, error } = useTagRouteProvider()

useDbChanges(({ operation, table, id }) => {
  if (operation === 'deleted' && table === 'tags' && id === tagId.value) {
    router.push(backTo.value)
  }
})

// =============================================================================
// State
// =============================================================================

const editDialogOpen = ref(false)
const scrollContainerRef = ref<HTMLElement>()

// =============================================================================
// Computed
// =============================================================================

const entityTypeModel = computed({
  get: () => entityType.value,
  set: (value: ContentEntityType) => setEntityType(value)
})

// =============================================================================
// Actions
// =============================================================================

function getDetailPath(type: ContentEntityType, id: string): string {
  switch (type) {
    case 'game':
      return `/library/game/${id}`
    case 'character':
      return `/library/character/${id}`
    case 'person':
      return `/library/person/${id}`
    case 'company':
      return `/library/company/${id}`
  }
}

function handleEntityClick(payload: { type: ContentEntityType; id: string }) {
  if (!tag.value) return
  router.push({
    path: getDetailPath(payload.type, payload.id),
    query: { from: `tag:${tag.value.id}` }
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
    v-else-if="!tag"
    state="not-found"
    :icon="getEntityIcon('tag')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.tag })"
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
        :title="tag.name"
        :icon="getEntityIcon('tag')"
      />
      <Badge
        v-if="tag.isNsfw"
        variant="destructive"
        class="text-[10px] px-1.5 py-0"
      >
        NSFW
      </Badge>

      <template #actions>
        <!-- Entity type segmented control -->
        <SegmentedControl v-model="entityTypeModel">
          <SegmentedControlItem
            v-for="type in CONTENT_ENTITY_TYPES"
            :key="type"
            :value="type"
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

        <Button
          variant="secondary"
          size="sm"
          @click="editDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--pencil-outline]"
            class="size-4 mr-1.5"
          />
          {{ m.common.edit }}
        </Button>
        <TagDropdownMenu :tag-id="tag.id" />
      </template>
    </PageHeader>

    <!-- Main content -->
    <div
      ref="scrollContainerRef"
      class="flex-1 overflow-auto bg-background p-4"
    >
      <TagDetailContent
        :scroll-parent="scrollContainerRef"
        @entity-click="handleEntityClick"
      />
    </div>
  </div>

  <TagInfoFormDialog
    v-if="editDialogOpen && tagId"
    v-model:open="editDialogOpen"
    :tag-id="tagId"
  />
</template>
