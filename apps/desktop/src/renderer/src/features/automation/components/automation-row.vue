<!--
Automation Row renders one automation in the dense list.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Switch } from '@renderer/components/ui/switch'
import { TableCell, TableRow } from '@renderer/components/ui/table'
import { cn } from '@renderer/utils/cn'
import { useI18n } from '@renderer/composables/use-i18n'
import type { Automation } from '@shared/automation'
import type { CommandListItem } from '@shared/command'
import {
  formatAutomationTriggers,
  formatAutomationTimestamp,
  getRunStatusLabel,
  getRunStatusVariant
} from '../utils/display'

interface Props {
  automation: Automation
  command?: CommandListItem
  running?: boolean
  busy?: boolean
}

interface Emits {
  (e: 'run'): void
  (e: 'cancel'): void
  (e: 'setEnabled', enabled: boolean): void
  (e: 'edit'): void
  (e: 'details'): void
  (e: 'delete'): void
}

const props = withDefaults(defineProps<Props>(), {
  command: undefined,
  running: false,
  busy: false
})
const emit = defineEmits<Emits>()

const { m } = useI18n()

const latestRun = computed(() => props.automation.history[0] ?? null)
const commandTitle = computed(() => props.command?.title ?? props.automation.commandId)
const nextRunLabel = computed(() =>
  props.automation.enabled
    ? formatAutomationTimestamp(props.automation.nextRunAt, m.value.automation.row.nextNone)
    : m.value.automation.row.disabled
)
const enabledModel = computed({
  get: () => props.automation.enabled,
  set: (enabled: boolean) => emit('setEnabled', enabled)
})
</script>

<template>
  <TableRow
    :class="cn('border-border/50 hover:bg-accent/30', !props.automation.enabled && 'opacity-70')"
  >
    <TableCell>
      <Switch
        v-model="enabledModel"
        :disabled="props.busy"
        :aria-label="props.automation.name"
      />
    </TableCell>
    <TableCell
      class="truncate font-medium"
      :title="props.automation.name"
    >
      {{ props.automation.name }}
    </TableCell>
    <TableCell
      class="truncate"
      :title="commandTitle"
    >
      {{ commandTitle }}
    </TableCell>
    <TableCell
      class="truncate"
      :title="formatAutomationTriggers(props.automation.triggers)"
    >
      {{ formatAutomationTriggers(props.automation.triggers) }}
    </TableCell>
    <TableCell
      class="truncate"
      :title="formatAutomationTimestamp(props.automation.lastRunAt)"
    >
      {{ formatAutomationTimestamp(props.automation.lastRunAt) }}
    </TableCell>
    <TableCell
      class="truncate"
      :title="nextRunLabel"
    >
      {{ nextRunLabel }}
    </TableCell>

    <TableCell>
      <Badge
        v-if="props.running"
        variant="default"
        class="h-5"
      >
        <Icon
          icon="icon-[mdi--progress-clock]"
          class="size-3"
        />
        {{ m.automation.row.running }}
      </Badge>
      <Badge
        v-else-if="latestRun"
        :variant="getRunStatusVariant(latestRun.invocationStatus)"
        class="h-5"
      >
        {{ getRunStatusLabel(latestRun.invocationStatus) }}
      </Badge>
      <Badge
        v-else
        variant="secondary"
        class="h-5"
      >
        {{ m.automation.row.notInvoked }}
      </Badge>
    </TableCell>

    <TableCell>
      <div class="flex items-center justify-end gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          :class="cn(props.running && 'hover:text-destructive')"
          :tooltip="props.running ? m.automation.row.stopRetry : m.automation.row.run"
          :disabled="props.busy"
          @click="props.running ? emit('cancel') : emit('run')"
        >
          <Icon
            :icon="props.running ? 'icon-[mdi--stop-circle-outline]' : 'icon-[mdi--play-outline]'"
            class="size-4"
          />
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          :tooltip="m.automation.row.details"
          @click="emit('details')"
        >
          <Icon
            icon="icon-[mdi--information-outline]"
            class="size-4"
          />
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          :tooltip="m.actions.edit"
          :disabled="props.busy || props.running"
          @click="emit('edit')"
        >
          <Icon
            icon="icon-[mdi--pencil-outline]"
            class="size-4"
          />
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          class="hover:text-destructive"
          :tooltip="m.actions.delete"
          :disabled="props.busy || props.running"
          @click="emit('delete')"
        >
          <Icon
            icon="icon-[mdi--delete-outline]"
            class="size-4"
          />
        </Button>
      </div>
    </TableCell>
  </TableRow>
</template>
