<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from '@renderer/composables/use-i18n'
import { Icon } from '@renderer/components/ui/icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/utils/cn'
import { useTaskRunStore } from '@renderer/stores'
import TaskCenterDialog from './task-center-dialog.vue'

const { m } = useI18n()

const open = ref(false)
const store = useTaskRunStore()
const { activeCount } = storeToRefs(store)

const badgeText = computed(() => (activeCount.value > 9 ? '9+' : String(activeCount.value)))
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <button
        type="button"
        :class="
          cn(
            'group relative flex items-center justify-center size-10 rounded-md transition-colors',
            'text-surface-foreground hover:text-accent-foreground hover:bg-accent',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary'
          )
        "
        :aria-label="m.task.center"
        @click="open = true"
      >
        <Icon
          icon="icon-[mdi--format-list-checks]"
          class="size-5"
        />
        <span
          v-if="activeCount > 0"
          class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs leading-none text-primary-foreground"
        >
          {{ badgeText }}
        </span>
      </button>
    </TooltipTrigger>
    <TooltipContent
      side="right"
      :side-offset="8"
    >
      {{ m.task.center }}
    </TooltipContent>
  </Tooltip>

  <TaskCenterDialog
    v-if="open"
    v-model:open="open"
  />
</template>
