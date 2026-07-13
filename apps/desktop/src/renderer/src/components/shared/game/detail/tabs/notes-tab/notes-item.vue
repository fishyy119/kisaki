<!--
  GameDetailNotesItem
  Single note item component showing note info with action buttons.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import type { GameNote } from '@shared/db'
import { formatDate } from '@renderer/utils/datetime'
import { getAttachmentUrl } from '@renderer/utils/attachment'

interface Props {
  note: GameNote
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
</script>

<template>
  <div class="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 border">
    <div class="flex items-center gap-3 min-w-0">
      <div class="size-12 rounded-md overflow-hidden bg-muted shrink-0">
        <img
          v-if="props.note.coverFile"
          :src="
            getAttachmentUrl('game_notes', props.note.id, props.note.coverFile, {
              width: 96,
              height: 96
            })
          "
          alt=""
          class="size-full object-cover border shadow-raised"
        />
        <div
          v-else
          class="size-full flex items-center justify-center"
        >
          <Icon
            icon="icon-[mdi--note-text-outline]"
            class="size-6 text-muted-foreground/50"
          />
        </div>
      </div>

      <div class="min-w-0">
        <p class="text-sm font-medium truncate">{{ props.note.name }}</p>
        <p class="text-xs text-muted-foreground">{{ formatDate(props.note.updatedAt) }}</p>
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        tooltip="打开"
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
        tooltip="上移"
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
        tooltip="下移"
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
        tooltip="编辑"
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
        tooltip="删除"
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
