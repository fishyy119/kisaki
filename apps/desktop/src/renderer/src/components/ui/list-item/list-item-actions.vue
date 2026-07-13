<!--
  ListItemActions - Standard action buttons for a ListItem row.

  Renders optional move up/down buttons, extra buttons via default slot,
  then edit and delete. Meant to be placed in ListItem's #actions slot.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'

interface Props {
  /** Show move up/down buttons */
  movable?: boolean
  isFirst?: boolean
  isLast?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  movable: false,
  isFirst: false,
  isLast: false
})

const emit = defineEmits<{
  moveUp: []
  moveDown: []
  edit: []
  delete: []
}>()
</script>

<template>
  <template v-if="props.movable">
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      class="size-7"
      :disabled="props.isFirst"
      @click="emit('moveUp')"
    >
      <Icon
        icon="icon-[mdi--chevron-up]"
        class="size-4"
      />
    </Button>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      class="size-7"
      :disabled="props.isLast"
      @click="emit('moveDown')"
    >
      <Icon
        icon="icon-[mdi--chevron-down]"
        class="size-4"
      />
    </Button>
  </template>

  <slot />

  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    class="size-7"
    @click="emit('edit')"
  >
    <Icon
      icon="icon-[mdi--pencil-outline]"
      class="size-4"
    />
  </Button>
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    class="size-7 text-destructive hover:text-destructive"
    @click="emit('delete')"
  >
    <Icon
      icon="icon-[mdi--delete-outline]"
      class="size-4"
    />
  </Button>
</template>
