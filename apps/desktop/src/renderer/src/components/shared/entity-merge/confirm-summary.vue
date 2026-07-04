<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'

interface Props {
  targetName: string
  sourceName: string
}

const props = defineProps<Props>()
</script>

<template>
  <div class="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
    <div class="flex gap-2">
      <Icon
        icon="icon-[mdi--alert-outline]"
        class="mt-0.5 size-4 shrink-0 text-warning"
      />
      <div class="min-w-0 space-y-1">
        <div class="font-medium">将「{{ props.sourceName }}」合并到「{{ props.targetName }}」</div>
        <div class="text-xs leading-5 text-muted-foreground">
          「{{ props.sourceName }}」会被删除；外部
          ID、关系、标签、合集、活动记录和附件会迁移到保留实体，目标已有信息保持不变。
        </div>
      </div>
    </div>
  </div>
</template>
