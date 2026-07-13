<!--
Automation Header renders top-level page actions.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { cn } from '@renderer/utils/cn'

interface Props {
  totalAutomations: number
  runningAutomations: number
  refreshing?: boolean
}

interface Emits {
  (e: 'create'): void
  (e: 'refresh'): void
}

const props = withDefaults(defineProps<Props>(), {
  refreshing: false
})
const emit = defineEmits<Emits>()
</script>

<template>
  <PageHeader>
    <PageHeaderTitle
      title="自动化"
      icon="icon-[mdi--timer-outline]"
    >
      {{ props.totalAutomations }} 个自动化
      <template v-if="props.runningAutomations > 0">
        · {{ props.runningAutomations }} 个运行中</template
      >
    </PageHeaderTitle>

    <template #actions>
      <Button
        variant="secondary"
        size="icon-sm"
        tooltip="刷新"
        :disabled="props.refreshing"
        @click="emit('refresh')"
      >
        <Icon
          icon="icon-[mdi--refresh]"
          :class="cn('size-4', props.refreshing && 'animate-spin')"
        />
      </Button>
      <Button
        size="sm"
        @click="emit('create')"
      >
        <Icon
          icon="icon-[mdi--plus]"
          class="size-4"
        />
        添加自动化
      </Button>
    </template>
  </PageHeader>
</template>
