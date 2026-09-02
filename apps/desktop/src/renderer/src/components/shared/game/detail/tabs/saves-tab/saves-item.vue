<!--
  GameDetailSavesItem
  Single backup item component showing backup info with action buttons.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatBytes } from '@renderer/utils/format'

interface Props {
  note: string
  backupAt: number
  sizeBytes?: number
  locked: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  restore: []
  edit: []
  delete: []
}>()

const { m, f } = useI18n()
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent/30"
  >
    <div class="flex items-center gap-3 min-w-0">
      <Icon
        icon="icon-[mdi--content-save-outline]"
        class="size-5 text-muted-foreground shrink-0"
      />
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-sm font-medium truncate">
            {{ props.note || f.date(new Date(props.backupAt)) }}
          </p>
          <Icon
            v-if="props.locked"
            icon="icon-[mdi--lock-outline]"
            class="size-3.5 text-warning shrink-0"
          />
        </div>
        <div class="flex items-center gap-x-3 text-xs text-muted-foreground">
          <span>{{ f.dateTime(new Date(props.backupAt)) }}</span>
          <span v-if="props.sizeBytes">{{ formatBytes(props.sizeBytes) }}</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.game.saves.restoreTooltip"
        @click="emit('restore')"
      >
        <Icon
          icon="icon-[mdi--rotate-left]"
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
