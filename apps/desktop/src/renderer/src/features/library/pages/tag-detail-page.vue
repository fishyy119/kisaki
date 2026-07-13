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
import { PageHeader } from '@renderer/components/ui/page-header'
import { StateView } from '@renderer/components/ui/state-view'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import {
  TagDetailContent,
  TagDropdownMenu,
  TagInfoFormDialog
} from '@renderer/components/shared/tag'
import { useEvent, useRenderState, useTagProvider } from '@renderer/composables'
import { getEntityIcon } from '@renderer/utils/format'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'

// =============================================================================
// Types & Config
// =============================================================================

interface EntityConfig {
  label: string
  unitLabel: string
}

const ENTITY_CONFIG: Record<ContentEntityType, EntityConfig> = {
  game: { label: '游戏', unitLabel: '款' },
  character: { label: '角色', unitLabel: '个' },
  person: { label: '人物', unitLabel: '位' },
  company: { label: '公司', unitLabel: '家' }
}

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()
const router = useRouter()

const tagId = computed(() => route.params.tagId as string | undefined)
const backTo = computed(() => (route.query.from as string) || '/library')

// Redirect if no tagId
if (!tagId.value) {
  router.push(backTo.value)
}

// =============================================================================
// Provider
// =============================================================================

const { tag, entityType, entityCounts, setEntityType, isLoading, error } = useTagProvider(
  () => tagId.value ?? ''
)
const state = useRenderState(isLoading, error, tag)

useEvent('db.deleted', ({ table, id }) => {
  if (table === 'tags' && id === tagId.value) {
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
  <!-- Loading / Error / Not Found -->
  <StateView
    v-if="state !== 'success'"
    :state="state"
    :error="error"
    :icon="getEntityIcon('tag')"
    title="标签不存在"
    class="h-full"
  />

  <!-- Content -->
  <div
    v-else-if="tag"
    class="h-full flex flex-col w-full"
  >
    <!-- Header -->
    <PageHeader back-to="/library">
      <h1 class="text-base font-semibold truncate">{{ tag.name }}</h1>
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
            {{ ENTITY_CONFIG[type].label }}
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
          编辑
        </Button>
        <TagDropdownMenu :tag-id="tag.id" />
      </template>
    </PageHeader>

    <!-- Main content -->
    <div
      ref="scrollContainerRef"
      class="flex-1 overflow-auto p-4"
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
