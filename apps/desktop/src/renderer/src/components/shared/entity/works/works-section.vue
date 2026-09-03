<!--
  EntityWorksSection
  Overview row of every media credit of a satellite entity as one mixed
  horizontal scroll, each card badged with its role. Editing lives in the
  works tab, so this surface is read-only.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { SectionScroll } from '@renderer/components/ui/section'
import { useI18n } from '@renderer/composables/use-i18n'
import type { MediaType } from '@shared/entity-types'
import EntityCard from '../card'
import { flattenWorks, type WorksBlock } from './blocks'

interface Props {
  blocks: WorksBlock[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  open: [mediaType: MediaType, entityId: string]
}>()

const { m } = useI18n()

const entries = computed(() => flattenWorks(props.blocks))
</script>

<template>
  <SectionScroll
    :title="m.library.fields.relatedWorks"
    memory-key="works"
    :items="entries"
    :get-key="(entry) => entry.key"
    :empty-text="m.library.detail.empty.relatedWorks"
  >
    <template #item="{ item: entry }">
      <EntityCard
        :entity-type="entry.mediaType"
        :entity="entry.entity"
        align="left"
        size="sm"
        :badge-label="entry.roleLabel"
        @click="emit('open', entry.mediaType, entry.entity.id)"
      />
    </template>
  </SectionScroll>
</template>
