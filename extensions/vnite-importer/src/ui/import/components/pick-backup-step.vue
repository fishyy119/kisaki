<!-- Step 1: pick the Vnite backup archive. -->
<script setup lang="ts">
import { Button, Field, FieldContent, FieldGroup } from '@kisaki3/extension-ui-vue'

interface Props {
  file: { name: string; sizeBytes: number } | null
  busy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  pick: []
}>()

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }

  const units = ['KB', 'MB', 'GB'] as const
  let current = value / 1024
  for (const unit of units) {
    if (current < 1024 || unit === 'GB') {
      return `${current.toFixed(current >= 10 ? 0 : 1)} ${unit}`
    }
    current /= 1024
  }

  return `${value} B`
}
</script>

<template>
  <FieldGroup>
    <Field
      orientation="horizontal"
      label="备份包"
      description="选择从 Vnite 导出的数据库备份 zip。"
    >
      <FieldContent class="flex-row items-center gap-2">
        <span
          class="text-sm"
          :class="props.file ? '' : 'text-muted-foreground'"
        >
          {{ props.file ? `${props.file.name}（${formatBytes(props.file.sizeBytes)}）` : '未选择' }}
        </span>
        <Button
          variant="outline"
          type="button"
          :disabled="props.busy"
          @click="emit('pick')"
        >
          {{ props.file ? '更换文件' : '选择文件' }}
        </Button>
      </FieldContent>
    </Field>
  </FieldGroup>
</template>
