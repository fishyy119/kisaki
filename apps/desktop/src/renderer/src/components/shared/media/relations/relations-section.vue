<!--
  MediaRelationsSection
  Overview row of related media entries as one horizontal scroll; incoming
  edges arrive pre-labelled with the inverse vocabulary. The relation type
  renders as the card's bottom badge and clicking opens the target's detail
  dialog.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { SectionScroll } from '@renderer/components/ui/section'
import { AnimeDetailDialog } from '@renderer/components/shared/anime'
import { EntityCard } from '@renderer/components/shared/entity'
import { GameDetailDialog } from '@renderer/components/shared/game'
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

const RELATION_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.mediaRelation)

/** The entry whose detail dialog is open, keyed by media type as well as id. */
const openTarget = ref<{ mediaType: MediaRelationTarget['mediaType']; id: string } | null>(null)

const dialogOpen = computed({
  get: () => openTarget.value !== null,
  set: (value) => {
    if (!value) openTarget.value = null
  }
})

function getTypeLabel(entry: MediaRelationEntry): string {
  return RELATION_TYPE_LABELS.value[entry.type] || entry.type
}

function openDetail(target: MediaRelationTarget): void {
  openTarget.value = { mediaType: target.mediaType, id: target.entity.id }
}
</script>

<template>
  <SectionScroll
    :title="m.library.fields.relatedEntries"
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
        :badge-label="getTypeLabel(entry)"
        @click="openDetail(entry.target)"
      />
    </template>
  </SectionScroll>

  <template v-if="openTarget">
    <GameDetailDialog
      v-if="openTarget.mediaType === 'game'"
      v-model:open="dialogOpen"
      :game-id="openTarget.id"
    />
    <AnimeDetailDialog
      v-else
      v-model:open="dialogOpen"
      :anime-id="openTarget.id"
    />
  </template>
</template>
