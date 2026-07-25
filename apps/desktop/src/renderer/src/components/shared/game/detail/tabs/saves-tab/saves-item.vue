<!--
  GameDetailSavesItem
  Single backup item component showing backup info with action buttons.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables/use-i18n'

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

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}
</script>

<template>
  <div class="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
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
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{{ f.dateTime(new Date(props.backupAt)) }}</span>
          <template v-if="props.sizeBytes">
            <span>·</span>
            <span>{{ formatSize(props.sizeBytes) }}</span>
          </template>
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
        :tooltip="m.common.edit"
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
        :tooltip="m.common.delete"
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
