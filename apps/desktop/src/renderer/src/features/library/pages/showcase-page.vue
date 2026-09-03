<script setup lang="ts">
/**
 * Showcase Page
 *
 * Displays the global unique showcase with customizable sections.
 * Shows a curated view of the library with different layouts and filters.
 * Section management is done via SectionsFormDialog.
 */

import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { StateView } from '@renderer/components/ui/state-view'
import { useShowcaseSections } from '../composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { LibraryShowcaseSection, LibraryShowcaseSectionsFormDialog } from '../components/showcase'

const { m } = useI18n()

// Data (committed by the route query before the page mounts)
const { sections, error } = useShowcaseSections()

// Dialog state
const isManagerOpen = ref(false)

// Computed
const visibleSections = computed(() => sections.value.filter((s) => s.section.isVisible))
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
        :title="m.library.pages.showcaseTitle"
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
          {{ m.library.pages.manageSections }}
        </Button>
      </template>
    </PageHeader>

    <!-- Content -->
    <ScrollRegion class="bg-background">
      <StateView
        v-if="visibleSections.length === 0"
        state="empty"
        icon="icon-[mdi--view-dashboard-outline]"
        :title="m.library.showcase.emptyTitle"
        :description="m.library.showcase.emptyDescription"
        class="h-full p-8"
      >
        <template #actions>
          <Button @click="isManagerOpen = true">
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4"
            />
            {{ m.library.showcase.addFirstSection }}
          </Button>
        </template>
      </StateView>
      <div
        v-else
        class="p-4 space-y-4"
      >
        <LibraryShowcaseSection
          v-for="{ section, entities } in visibleSections"
          :key="section.id"
          :section="section"
          :entities="entities"
        />
      </div>
    </ScrollRegion>

    <!-- Sections manager dialog -->
    <LibraryShowcaseSectionsFormDialog
      v-if="isManagerOpen"
      v-model:open="isManagerOpen"
    />
  </div>
</template>
