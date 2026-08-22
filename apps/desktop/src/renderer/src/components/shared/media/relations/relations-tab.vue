<!--
  MediaRelationsTab
  Detail tab body listing every related media entry grouped by relation type.
  Incoming edges arrive pre-labelled with the inverse vocabulary, so grouping
  reads the entry type as seen from this entity.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import {
  EntityCard,
  EntityDetailDialog,
  type EntityDetailTarget
} from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables/use-i18n'
import type { MediaRelationEntry } from '@renderer/core/db/media-relations'
import type { MediaType } from '@shared/common'
import { MEDIA_RELATION_TYPES } from '@shared/db'
import MediaRelationsFormDialog from './relations-form-dialog/relations-form-dialog.vue'

interface Props {
  mediaType: MediaType
  /** Owning media entry id the relations form dialog edits */
  entityId: string
  relations: MediaRelationEntry[]
}

const props = defineProps<Props>()

const { m } = useI18n()

const editDialogOpen = ref(false)
const openEntity = ref<EntityDetailTarget | null>(null)

const groups = computed(() => {
  const byType = new Map<string, MediaRelationEntry[]>()
  for (const entry of props.relations) {
    const entries = byType.get(entry.type) ?? []
    entries.push(entry)
    byType.set(entry.type, entries)
  }
  return MEDIA_RELATION_TYPES.filter((type) => byType.get(type)?.length).map((type) => ({
    type,
    label: m.value.library.mediaRelation[type],
    entries: byType.get(type)!
  }))
})
</script>

<template>
  <!-- Empty state -->
  <StateView
    v-if="props.relations.length === 0"
    state="empty"
    icon="icon-[mdi--link-variant]"
    :description="m.library.detail.empty.relatedEntries"
    class="py-12"
  >
    <template #actions>
      <Button
        variant="outline"
        size="sm"
        @click="editDialogOpen = true"
      >
        <Icon
          icon="icon-[mdi--plus]"
          class="size-4 mr-1.5"
        />
        {{ m.library.detail.addEntity({ label: m.library.fields.relatedEntries }) }}
      </Button>
    </template>
  </StateView>

  <!-- Grouped card grid -->
  <template v-else>
    <div class="flex items-center justify-start mb-4">
      <Button
        variant="outline"
        size="sm"
        @click="editDialogOpen = true"
      >
        <Icon
          icon="icon-[mdi--pencil-outline]"
          class="size-4 mr-1.5"
        />
        {{ m.library.detail.manage }}
      </Button>
    </div>

    <div class="space-y-4">
      <div
        v-for="group in groups"
        :key="group.type"
      >
        <h4 class="text-xs font-medium text-muted-foreground mb-2">
          {{ group.label }}
        </h4>
        <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3 justify-between">
          <EntityCard
            v-for="entry in group.entries"
            :key="`${entry.id}:${entry.direction}`"
            :entity-type="entry.target.mediaType"
            :entity="entry.target.entity"
            align="left"
            size="sm"
            @click="
              openEntity = {
                entityType: entry.target.mediaType,
                entityId: entry.target.entity.id
              }
            "
          />
        </div>
      </div>
    </div>
  </template>

  <!-- Edit Dialog -->
  <MediaRelationsFormDialog
    v-if="editDialogOpen"
    v-model:open="editDialogOpen"
    :media-type="props.mediaType"
    :entity-id="props.entityId"
  />

  <!-- Detail Dialog -->
  <EntityDetailDialog v-model:target="openEntity" />
</template>
