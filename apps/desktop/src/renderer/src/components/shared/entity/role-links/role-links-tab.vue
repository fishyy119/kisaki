<!--
  EntityRoleLinksTab
  Detail tab body rendering the full role-grouped link list as a card grid,
  with empty state, manage entry, and the per-entity detail dialog.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'
import EntityCard from '../card'
import { EntityDetailDialog, type EntityDetailTarget } from '../detail'
import { EntityLinksFormDialog, type LinkViewKey } from '../links'
import { groupRoleLinks, type RoleLinkEntityType, type RoleLinkItem } from './grouping'

interface Props {
  entityType: RoleLinkEntityType
  /** Owning media entry id the links form dialog edits */
  entityId: string
  items: RoleLinkItem[]
  roleOrder: readonly string[]
  roleLabels: Record<string, string>
  linkView: LinkViewKey
}

const props = defineProps<Props>()

const { m } = useI18n()

/** Maps the singular entity kind to its plural empty-text message key. */
const EMPTY_TEXT_KEYS = {
  character: 'characters',
  person: 'persons',
  company: 'companies'
} as const satisfies Record<RoleLinkEntityType, string>

const editDialogOpen = ref(false)
const openEntity = ref<EntityDetailTarget | null>(null)

const grouped = computed(() => groupRoleLinks(props.items))
</script>

<template>
  <!-- Empty state -->
  <StateView
    v-if="props.items.length === 0"
    state="empty"
    :icon="getEntityIcon(props.entityType)"
    :description="m.library.detail.empty[EMPTY_TEXT_KEYS[props.entityType]]"
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
        {{ m.library.detail.addEntity({ label: m.library.entities[props.entityType] }) }}
      </Button>
      <slot name="actions" />
    </template>
  </StateView>

  <!-- Grouped card grid -->
  <template v-else>
    <div class="flex items-center justify-start gap-2 mb-4">
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
      <slot name="actions" />
    </div>

    <div class="space-y-4">
      <template
        v-for="role in props.roleOrder"
        :key="role"
      >
        <div v-if="grouped[role]?.length">
          <h4 class="text-xs font-medium text-muted-foreground mb-2">
            {{ props.roleLabels[role] || role }}
          </h4>
          <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3 justify-between">
            <EntityCard
              v-for="item in grouped[role]"
              :key="item.id"
              :entity-type="props.entityType"
              :entity="item.entity!"
              :subtitle="item.subtitle"
              align="left"
              size="sm"
              @click="openEntity = { entityType: props.entityType, entityId: item.entity!.id }"
            />
          </div>
        </div>
      </template>
    </div>
  </template>

  <!-- Edit Dialog -->
  <EntityLinksFormDialog
    v-if="editDialogOpen"
    v-model:open="editDialogOpen"
    :view="props.linkView"
    :entity-id="props.entityId"
  />

  <!-- Detail Dialog -->
  <EntityDetailDialog v-model:target="openEntity" />
</template>
