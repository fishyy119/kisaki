<!--
  TagDetailActions
  The tag's entity-level operations: edit, and the tag menu. Shared by the
  page header actions and the dialog footer, so both surfaces offer one set.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables/use-i18n'
import { TagDropdownMenu } from '../menus'
import { TagInfoFormDialog } from '../forms'

interface Props {
  tagId: string
}

const props = defineProps<Props>()

const { m } = useI18n()

const editDialogOpen = ref(false)
</script>

<template>
  <Button
    variant="secondary"
    size="sm"
    @click="editDialogOpen = true"
  >
    <Icon
      icon="icon-[mdi--pencil-outline]"
      class="mr-1.5 size-4"
    />
    {{ m.common.edit }}
  </Button>
  <TagDropdownMenu :tag-id="props.tagId" />

  <TagInfoFormDialog
    v-if="editDialogOpen"
    v-model:open="editDialogOpen"
    :tag-id="props.tagId"
  />
</template>
