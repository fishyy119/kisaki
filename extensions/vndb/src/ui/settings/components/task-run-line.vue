<!-- Task Run Line shows one task run's status, progress, and cancel control. -->
<script setup lang="ts">
import { Button, Progress } from '@kisaki3/extension-ui-vue'
import type { VndbTaskStateView } from '../../../shared/settings'
import { m } from '../i18n'

interface Props {
  task: VndbTaskStateView | null
  active: boolean
  percent: number | null
  statusLabel: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  cancel: []
}>()
</script>

<template>
  <div
    v-if="props.task"
    class="flex flex-wrap items-center gap-2 text-xs"
  >
    <span class="font-medium">{{ props.statusLabel }}</span>
    <span
      v-if="props.task.current !== undefined && props.task.total !== undefined"
      class="text-muted-foreground"
    >
      {{ m.ui.task.progress({ current: props.task.current, total: props.task.total }) }}
    </span>
    <template v-if="props.active">
      <Progress
        :model-value="props.percent"
        class="w-40"
      />
      <Button
        variant="outline"
        size="sm"
        type="button"
        @click="emit('cancel')"
      >
        {{ m.ui.task.cancel }}
      </Button>
    </template>
    <span
      v-if="props.task.summary ?? props.task.error"
      class="text-muted-foreground"
    >
      {{ props.task.summary ?? props.task.error }}
    </span>
  </div>
</template>
