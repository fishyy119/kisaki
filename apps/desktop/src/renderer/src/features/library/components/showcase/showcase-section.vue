<!--
  LibraryShowcaseSection - Single section renderer
  Renders a section with the entities the showcase route query loaded for it,
  based on layout type: a SectionScroll row, or a Section holding a grid.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Section, SectionScroll } from '@renderer/components/ui/section'
import { VirtualGrid } from '@renderer/components/ui/virtual'
import { EntityCard } from '@renderer/components/shared'
import { EntityDetailDialog, type EntityDetailTarget } from '@renderer/components/shared/entity'
import type { SectionEntityData } from '../../composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import type { ShowcaseSection } from '@shared/db'

interface Props {
  section: ShowcaseSection
  entities: SectionEntityData[]
}

const props = defineProps<Props>()
const router = useRouter()
const { m } = useI18n()

const entityType = computed(() => props.section.entityType)
const isHorizontal = computed(() => props.section.layout === 'horizontal')
const isDialogMode = computed(() => props.section.openMode === 'dialog')
const emptyText = computed(() =>
  m.value.library.showcase.sectionEmpty({ label: m.value.library.entities[entityType.value] ?? '' })
)

const openEntity = ref<EntityDetailTarget | null>(null)

function handleItemClick(item: SectionEntityData) {
  if (isDialogMode.value) {
    openEntity.value = { entityType: entityType.value, entityId: item.id }
    return
  }

  router.push(getEntityDetailPath(entityType.value, item.id))
}
</script>

<template>
  <SectionScroll
    v-if="isHorizontal"
    :items="props.entities"
    :get-key="(item) => item.id"
    :empty-text="emptyText"
    class="relative group"
  >
    <!-- Page-level section title overrides the default muted style -->
    <template #title>
      <h3 class="text-base font-semibold">{{ props.section.name }}</h3>
    </template>

    <template #item="{ item }">
      <EntityCard
        :entity-type="entityType"
        :entity="item"
        :size="props.section.itemSize"
        class="shrink-0"
        @click="handleItemClick(item)"
      />
    </template>
  </SectionScroll>

  <Section
    v-else
    :empty="props.entities.length === 0"
    :empty-text="emptyText"
    class="relative group"
  >
    <template #title>
      <h3 class="text-base font-semibold">{{ props.section.name }}</h3>
    </template>

    <VirtualGrid
      :items="props.entities"
      :get-key="(item) => item.id"
      scroll="region"
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
  </Section>

  <!-- Entity detail dialog -->
  <EntityDetailDialog v-model:target="openEntity" />
</template>
