<script setup lang="ts">
/**
 * Showcase Page
 *
 * Displays the global unique showcase with customizable sections.
 * Shows a curated view of the library with different layouts and filters.
 * Section management is done via SectionsFormDialog.
 */

import { ref, computed, provide } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { StateView } from '@renderer/components/ui/state-view'
import { useRenderState } from '@renderer/composables'
import { useShowcaseSections } from '../composables'
import {
  LibraryShowcaseSection,
  LibraryShowcaseEmpty,
  LibraryShowcaseSectionsFormDialog
} from '../components/showcase'

// Data
const { sections, isLoading } = useShowcaseSections()
const state = useRenderState(isLoading, null, sections)

// Scroll container for virtualized grids
const scrollContainerRef = ref<HTMLElement>()
provide('showcaseScrollContainer', scrollContainerRef)

// Dialog state
const isManagerOpen = ref(false)

// Computed
const visibleSections = computed(() => sections.value.filter((s) => s.isVisible))
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <PageHeader>
      <PageHeaderTitle
        title="陈列柜"
        icon="icon-[mdi--view-dashboard-outline]"
      />

      <template #actions>
        <Button
          variant="ghost"
          size="sm"
          @click="isManagerOpen = true"
        >
          <Icon
            icon="icon-[mdi--cog-outline]"
            class="size-4"
          />
          管理区块
        </Button>
      </template>
    </PageHeader>

    <!-- Loading state -->
    <StateView
      v-if="state === 'loading'"
      state="loading"
      class="h-full bg-background"
    />

    <!-- Content -->
    <div
      v-else
      ref="scrollContainerRef"
      class="flex-1 overflow-auto bg-background"
    >
      <LibraryShowcaseEmpty
        v-if="visibleSections.length === 0"
        @add-section="isManagerOpen = true"
      />
      <div
        v-else
        class="p-4 space-y-4"
      >
        <LibraryShowcaseSection
          v-for="section in visibleSections"
          :key="section.id"
          :section="section"
        />
      </div>
    </div>

    <!-- Sections manager dialog -->
    <LibraryShowcaseSectionsFormDialog
      v-if="isManagerOpen"
      v-model:open="isManagerOpen"
    />
  </div>
</template>
