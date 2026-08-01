<!--
Automation Header renders top-level page actions.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { cn } from '@renderer/utils/cn'
import { useI18n } from '@renderer/composables/use-i18n'

interface Props {
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

const { m } = useI18n()
</script>

<template>
  <PageHeader>
    <PageHeaderTitle
      :title="m.automation.title"
      icon="icon-[mdi--timer-outline]"
    />

    <template #actions>
      <Button
        variant="secondary"
        size="icon-sm"
        :tooltip="m.common.refresh"
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
        {{ m.automation.addAutomation }}
      </Button>
    </template>
  </PageHeader>
</template>
