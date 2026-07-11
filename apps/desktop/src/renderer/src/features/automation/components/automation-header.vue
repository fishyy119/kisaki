<!--
Automation Header renders top-level page actions.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
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
  <header
    class="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4"
  >
    <div class="flex min-w-0 items-center gap-3">
      <Icon
        icon="icon-[mdi--timer-outline]"
        class="size-5 shrink-0"
      />
      <h1 class="truncate text-base font-semibold">自动化</h1>
      <span class="shrink-0 text-xs text-muted-foreground">
        {{ props.totalAutomations }} 个自动化
        <template v-if="props.runningAutomations > 0">
          · {{ props.runningAutomations }} 个运行中</template
        >
      </span>
    </div>

    <div class="flex items-center gap-2">
      <Button
        variant="secondary"
        size="icon-sm"
        title="刷新"
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
    </div>
  </header>
</template>
