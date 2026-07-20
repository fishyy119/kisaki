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
import type { Game, Character, Person, Company } from '@shared/db'
import type { ContentEntityType } from '@shared/common'
import { useUncategorized } from '../composables'

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

type EntityData = Game | Character | Person | Company

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

function handleEntityClick(entity: EntityData) {
  router.push({
    path: getDetailPath(entityType.value, entity.id),
    query: { from: 'uncategorized' }
  })
}
</script>

<template>
  <div class="h-full flex flex-col w-full">
    <!-- Header -->
    <PageHeader back-to="/library">
      <PageHeaderTitle
        :title="`未分类${ENTITY_CONFIG[entityType].label}`"
        icon="icon-[mdi--folder-question-outline]"
      >
        {{ entities.length }} {{ ENTITY_CONFIG[entityType].unitLabel }}
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
        :description="`所有${ENTITY_CONFIG[entityType].label}都已分类`"
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
