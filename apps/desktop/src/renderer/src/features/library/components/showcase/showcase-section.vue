<!--
  LibraryShowcaseSection - Single section renderer
  Renders a section with its data based on layout type.
  Scroll controls are integrated into the header row.
-->
<script setup lang="ts">
import { ref, computed, inject, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { StateView } from '@renderer/components/ui/state-view'
import { VirtualGrid, VirtualHorizontalScroll } from '@renderer/components/ui/virtual'
import { EntityCard } from '@renderer/components/shared'
import { EntityDetailDialog, type EntityDetailTarget } from '@renderer/components/shared/entity'
import { useSectionData, type SectionEntityData } from '../../composables'
import { useRenderState } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import type { ShowcaseSection } from '@shared/db'
import type { AllEntityType } from '@shared/common'

interface Props {
  section: ShowcaseSection
}

const props = defineProps<Props>()
const router = useRouter()

// Inject scroll container from parent showcase
const scrollContainer = inject<Ref<HTMLElement | undefined>>('showcaseScrollContainer')

const { data, isLoading } = useSectionData(() => props.section)
const state = useRenderState(isLoading, null, data)

const scrollRef = ref<{ scrollLeft: () => void; scrollRight: () => void }>()
const scrollState = ref({ canScrollLeft: false, canScrollRight: false })

const isHorizontal = computed(() => props.section.layout === 'horizontal')
const showScrollButtons = computed(
  () => isHorizontal.value && data.value.length > 0 && !isLoading.value
)
const entityType = computed(() => props.section.entityType as AllEntityType)
const isDialogMode = computed(() => props.section.openMode === 'dialog')

const openEntity = ref<EntityDetailTarget | null>(null)

const { m } = useI18n()

const entityLabel = computed(() => m.value.library.entities[entityType.value] ?? '')

function handleScrollStateChange(state: { canScrollLeft: boolean; canScrollRight: boolean }) {
  scrollState.value = state
}

function handleItemClick(item: SectionEntityData) {
  const type = entityType.value

  if (isDialogMode.value) {
    openEntity.value = { entityType: type, entityId: item.id }
    return
  }

  router.push(getEntityDetailPath(type, item.id))
}
</script>

<template>
  <Section class="relative group">
    <!-- Page-level section title overrides the default muted style -->
    <template #title>
      <h3 class="text-base font-semibold">{{ props.section.name }}</h3>
    </template>

    <!-- Scroll controls - only for horizontal layout -->
    <template
      v-if="showScrollButtons"
      #actions
    >
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="!scrollState.canScrollLeft"
        class="size-6 opacity-60 hover:opacity-100 disabled:opacity-30"
        @click="scrollRef?.scrollLeft()"
      >
        <Icon
          icon="icon-[mdi--chevron-left]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="!scrollState.canScrollRight"
        class="size-6 opacity-60 hover:opacity-100 disabled:opacity-30"
        @click="scrollRef?.scrollRight()"
      >
        <Icon
          icon="icon-[mdi--chevron-right]"
          class="size-4"
        />
      </Button>
    </template>

    <!-- Loading state -->
    <StateView
      v-if="state === 'loading'"
      state="loading"
      class="py-8"
    />

    <!-- Success state -->
    <template v-else-if="state === 'success'">
      <!-- Empty state -->
      <StateView
        v-if="data.length === 0"
        state="empty"
        :description="m.library.showcase.sectionEmpty({ label: entityLabel })"
        class="py-8"
      />

      <!-- Horizontal layout -->
      <div
        v-else-if="isHorizontal"
        class="-mx-4 px-4"
      >
        <VirtualHorizontalScroll
          ref="scrollRef"
          :items="data"
          class="flex gap-3"
          @scroll-state-change="handleScrollStateChange"
        >
          <template #item="{ item }">
            <EntityCard
              :entity-type="entityType"
              :entity="item"
              :size="props.section.itemSize"
              class="shrink-0"
              @click="handleItemClick(item)"
            />
          </template>
        </VirtualHorizontalScroll>
      </div>

      <!-- Grid layout -->
      <VirtualGrid
        v-else
        :items="data"
        :scroll-parent="scrollContainer ?? undefined"
        class="grid grid-cols-[repeat(auto-fill,8rem)] gap-3 justify-between"
      >
        <template #item="{ item }">
          <EntityCard
            :entity-type="entityType"
            :entity="item"
            :size="props.section.itemSize"
            class="w-full"
            @click="handleItemClick(item)"
          />
        </template>
      </VirtualGrid>
    </template>

    <!-- Entity detail dialog -->
    <EntityDetailDialog v-model:target="openEntity" />
  </Section>
</template>
