<!--
  EntityWorksTab
  Detail tab body listing every media credit of a satellite entity, blocked by
  media kind, with the role as the card's bottom badge. Each media kind keeps
  its own links form view, reached through the manage menu (the only place the
  media icons appear).
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { StateView } from '@renderer/components/ui/state-view'
import { VirtualGrid } from '@renderer/components/ui/virtual'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'
import EntityCard from '../card'
import { EntityDetailDialog, type EntityDetailTarget } from '../detail'
import { EntityLinksFormDialog, type LinkViewKey } from '../links'
import { resolveWorksBlocks, type WorksBlock } from './blocks'

interface Props {
  /** Satellite entity id the links form dialogs anchor on */
  entityId: string
  blocks: WorksBlock[]
}

const props = defineProps<Props>()

const { m } = useI18n()

const editView = ref<LinkViewKey | null>(null)
const openEntity = ref<EntityDetailTarget | null>(null)

const resolvedBlocks = computed(() => resolveWorksBlocks(props.blocks))

const editDialogOpen = computed({
  get: () => editView.value !== null,
  set: (value) => {
    if (!value) editView.value = null
  }
})
</script>

<template>
  <!-- Manage menu: one entry per media kind, including the empty ones -->
  <div class="flex items-center justify-start mb-4">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="outline"
          size="sm"
        >
          <Icon
            :icon="resolvedBlocks.length === 0 ? 'icon-[mdi--plus]' : 'icon-[mdi--pencil-outline]'"
            class="size-4 mr-1.5"
          />
          {{
            resolvedBlocks.length === 0
              ? m.library.detail.addEntity({ label: m.library.fields.relatedWorks })
              : m.library.detail.manage
          }}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          v-for="block in props.blocks"
          :key="block.linkView"
          @click="editView = block.linkView"
        >
          <Icon
            :icon="getEntityIcon(block.mediaType)"
            class="size-4"
          />
          {{ m.library.entities[block.mediaType] }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <!-- Empty state -->
  <StateView
    v-if="resolvedBlocks.length === 0"
    state="empty"
    icon="icon-[mdi--filmstrip-box-multiple]"
    :description="m.library.detail.empty.relatedWorks"
    class="py-12"
  />

  <!-- One card grid per media kind -->
  <div
    v-else
    class="space-y-4"
  >
    <div
      v-for="block in resolvedBlocks"
      :key="block.mediaType"
    >
      <h4 class="text-xs font-medium text-muted-foreground mb-2">
        {{ m.library.entities[block.mediaType] }}
      </h4>

      <!-- A prolific credit can carry hundreds of works, so the grid virtualizes -->
      <VirtualGrid
        :items="block.entries"
        :get-key="(entry) => entry.key"
        scroll-parent="auto"
        class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3 justify-between"
      >
        <template #item="{ item: entry }">
          <EntityCard
            :entity-type="entry.mediaType"
            :entity="entry.entity"
            align="left"
            size="sm"
            :badge-label="entry.roleLabel"
            @click="openEntity = { entityType: entry.mediaType, entityId: entry.entity.id }"
          />
        </template>
      </VirtualGrid>
    </div>
  </div>

  <!-- Edit Dialog -->
  <EntityLinksFormDialog
    v-if="editView"
    v-model:open="editDialogOpen"
    :view="editView"
    :entity-id="props.entityId"
  />

  <!-- Detail Dialog -->
  <EntityDetailDialog v-model:target="openEntity" />
</template>
