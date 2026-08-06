<!--
  AddConditionMenu
  "Add condition" button opening a field menu; picking a field appends a
  default condition for it. A list-level action meant for the panel/dialog
  footer next to "clear filters".
-->
<script setup lang="ts">
import type { FilterState } from '@shared/filter'
import { addCondition, createDefaultCondition } from '@shared/filter'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useI18n } from '@renderer/composables'
import type { FilterUiFieldDef, FilterUiSpec } from './specs/types'

interface Props {
  uiSpec: FilterUiSpec
}

const props = defineProps<Props>()
const model = defineModel<FilterState>({ required: true })
const { m } = useI18n()

function handleAdd(field: FilterUiFieldDef) {
  model.value = addCondition(model.value, createDefaultCondition(field.key, field.kind))
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        variant="outline"
        size="sm"
      >
        <Icon
          icon="icon-[mdi--plus]"
          class="size-4 mr-1"
        />
        {{ m.filter.addCondition }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="start"
      class="max-h-72 min-w-48 overflow-auto"
    >
      <DropdownMenuItem
        v-for="field in props.uiSpec.fields"
        :key="field.key"
        @select="() => handleAdd(field)"
      >
        {{ field.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
