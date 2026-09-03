<!--
  MediaRelationsSection
  Overview row of related media entries as one horizontal scroll; incoming
  edges arrive pre-labelled with the inverse vocabulary. The target's media
  type renders as the card's bottom badge (the relations tab owns the
  relation-type grouping) and clicking opens the target's detail dialog.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { SectionScroll } from '@renderer/components/ui/section'
import {
  EntityCard,
  EntityDetailDialog,
  type EntityDetailTarget
} from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables/use-i18n'
import type { MediaRelationEntry, MediaRelationTarget } from '@renderer/core/db/media-relations'

interface Props {
  relations: MediaRelationEntry[]
  editable?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  edit: []
}>()

const { m } = useI18n()

const openEntity = ref<EntityDetailTarget | null>(null)

function openDetail(target: MediaRelationTarget): void {
  openEntity.value = { entityType: target.mediaType, entityId: target.entity.id }
}
</script>

<template>
  <SectionScroll
    :title="m.library.fields.relatedEntries"
    memory-key="relations"
    :editable="editable"
    :items="relations"
    :get-key="(entry) => `${entry.id}:${entry.direction}`"
    :empty-text="m.library.detail.empty.relatedEntries"
    @edit="emit('edit')"
  >
    <template #item="{ item: entry }">
      <EntityCard
        :entity-type="entry.target.mediaType"
        :entity="entry.target.entity"
        size="sm"
        align="left"
        :badge-label="m.library.entities[entry.target.mediaType]"
        @click="openDetail(entry.target)"
      />
    </template>
  </SectionScroll>

  <EntityDetailDialog v-model:target="openEntity" />
</template>
