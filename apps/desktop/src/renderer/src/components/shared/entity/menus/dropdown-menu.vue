<!--
  EntityDropdownMenu
  Dropdown menu shell for entity items (kebab button). Dialog states live in
  the shared dialog assembly so they survive menu close.
-->
<script setup lang="ts">
import { ref } from 'vue'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@renderer/components/ui/dropdown-menu'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import type { MenuComponents } from '@renderer/types'
import type { ContentEntityType } from '@shared/entity-types'
import EntityMenuItems from './menu-items.vue'
import EntityMenuDialogs from './menu-dialogs.vue'

interface Props {
  entityType: ContentEntityType
  entityId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deleted: [entityId: string]
}>()

// Dropdown menu components adapter
const dropdownMenuComponents: MenuComponents = {
  Item: DropdownMenuItem,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  Separator: DropdownMenuSeparator,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem
}

const dialogs = ref<InstanceType<typeof EntityMenuDialogs>>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot>
        <Button
          variant="secondary"
          size="icon-sm"
        >
          <Icon
            icon="icon-[mdi--dots-horizontal]"
            class="size-4"
          />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      class="min-w-56"
    >
      <EntityMenuItems
        :entity-type="props.entityType"
        :entity-id="props.entityId"
        :components="dropdownMenuComponents"
        @open-score-dialog="dialogs?.open('score')"
        @open-assets-dialog="dialogs?.open('assets')"
        @open-metadata-update-dialog="dialogs?.open('metadataUpdate')"
        @open-external-ids-dialog="dialogs?.open('externalIds')"
        @open-merge-dialog="dialogs?.open('merge')"
        @open-delete-dialog="dialogs?.open('delete')"
        @open-new-collection-dialog="dialogs?.open('newCollection')"
        @open-extra-dialog="(name) => dialogs?.open(name)"
        @open-status-follow-up="dialogs?.open('statusFollowUp')"
      />
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- Dialogs rendered outside menu to survive menu close -->
  <EntityMenuDialogs
    ref="dialogs"
    :entity-type="props.entityType"
    :entity-id="props.entityId"
    @deleted="emit('deleted', $event)"
  />
</template>
