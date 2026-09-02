<!--
  MediaNotesItem
  Single note row showing cover, name, and update date with action buttons.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import type { MediaType } from '@shared/entity-types'
import { useI18n } from '@renderer/composables/use-i18n'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { MEDIA_NOTE_STORES, type MediaNoteRow } from './store'

interface Props {
  mediaType: MediaType
  note: MediaNoteRow
  canMoveUp: boolean
  canMoveDown: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  open: []
  moveUp: []
  moveDown: []
  edit: []
  delete: []
}>()

const { m, f } = useI18n()

const coverUrl = computed(() => {
  if (!props.note.coverFile) return null
  return getAttachmentUrl(
    MEDIA_NOTE_STORES[props.mediaType].tableName,
    props.note.id,
    props.note.coverFile,
    {
      width: 64,
      height: 64
    }
  )
})
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent/30"
  >
    <div class="flex items-center gap-3 min-w-0">
      <div class="size-8 rounded-md overflow-hidden bg-muted shrink-0">
        <img
          v-if="coverUrl"
          :src="coverUrl"
          alt=""
          class="size-full object-cover border shadow-raised"
        />
        <div
          v-else
          class="size-full flex items-center justify-center"
        >
          <Icon
            icon="icon-[mdi--note-text-outline]"
            class="size-4 text-muted-foreground/50"
          />
        </div>
      </div>

      <div class="min-w-0">
        <p class="text-sm font-medium truncate">{{ props.note.name }}</p>
        <p class="text-xs text-muted-foreground">{{ f.date(props.note.updatedAt) }}</p>
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.actions.open"
        @click="emit('open')"
      >
        <Icon
          icon="icon-[mdi--open-in-new]"
          class="size-4"
        />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.actions.moveUp"
        :disabled="!props.canMoveUp"
        @click="emit('moveUp')"
      >
        <Icon
          icon="icon-[mdi--chevron-up]"
          class="size-4"
        />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.actions.moveDown"
        :disabled="!props.canMoveDown"
        @click="emit('moveDown')"
      >
        <Icon
          icon="icon-[mdi--chevron-down]"
          class="size-4"
        />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.actions.edit"
        @click="emit('edit')"
      >
        <Icon
          icon="icon-[mdi--pencil-outline]"
          class="size-4"
        />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.actions.delete"
        class="hover:text-destructive"
        @click="emit('delete')"
      >
        <Icon
          icon="icon-[mdi--delete-outline]"
          class="size-4"
        />
      </Button>
    </div>
  </div>
</template>
