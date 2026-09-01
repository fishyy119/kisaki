<!--
  CollectionDetailActions
  The collection's entity-level operations: its primary edit (contents of a
  static collection, filters of a dynamic one) and the collection menu, which
  carries the rest. Shared by the page header actions and the dialog footer,
  so both surfaces offer one set.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables/use-i18n'
import { CollectionDropdownMenu } from '../menus'
import { CollectionDynamicConfigFormDialog, CollectionEntitiesFormDialog } from '../forms'

interface Props {
  collectionId: string
  isDynamic: boolean
}

const props = defineProps<Props>()

const { m } = useI18n()

const editEntitiesOpen = ref(false)
const editFilterOpen = ref(false)
</script>

<template>
  <Button
    v-if="!props.isDynamic"
    variant="secondary"
    size="sm"
    @click="editEntitiesOpen = true"
  >
    <Icon
      icon="icon-[mdi--format-list-numbered]"
      class="mr-1.5 size-4"
    />
    {{ m.library.menu.editContent }}
  </Button>
  <Button
    v-else
    variant="secondary"
    size="sm"
    @click="editFilterOpen = true"
  >
    <Icon
      icon="icon-[mdi--filter-outline]"
      class="mr-1.5 size-4"
    />
    {{ m.library.menu.editFilter }}
  </Button>
  <CollectionDropdownMenu :collection-id="props.collectionId" />

  <CollectionEntitiesFormDialog
    v-if="!props.isDynamic && editEntitiesOpen"
    v-model:open="editEntitiesOpen"
    :collection-id="props.collectionId"
  />
  <CollectionDynamicConfigFormDialog
    v-if="props.isDynamic && editFilterOpen"
    v-model:open="editFilterOpen"
    :collection-id="props.collectionId"
  />
</template>
