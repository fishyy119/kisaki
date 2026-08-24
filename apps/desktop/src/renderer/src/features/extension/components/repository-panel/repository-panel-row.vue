<!--
Repository Panel Row renders one repository entry.
Boundary: pure row UI; emits repository actions to the parent panel.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Switch } from '@renderer/components/ui/switch'
import { Spinner } from '@renderer/components/ui/spinner'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ExtensionRepositoryInfo } from '@shared/extension'
import {
  formatRepositoryDate,
  getRepositoryHealthLabel,
  getRepositoryHealthVariant,
  shouldShowRepositoryHealthBadge
} from './display'

interface Props {
  repository: ExtensionRepositoryInfo
  priorityLabel: number
  busy: boolean
  canMoveUp: boolean
  canMoveDown: boolean
}

interface Emits {
  (e: 'details', repository: ExtensionRepositoryInfo): void
  (e: 'toggle', repository: ExtensionRepositoryInfo, enabled: boolean): void
  (e: 'refresh', repository: ExtensionRepositoryInfo): void
  (e: 'move', repository: ExtensionRepositoryInfo, delta: number): void
  (e: 'remove', repository: ExtensionRepositoryInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { m } = useI18n()
</script>

<template>
  <div
    class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 transition-colors hover:bg-accent/40"
  >
    <div class="min-w-0 space-y-2">
      <div class="flex min-w-0 items-center gap-2">
        <Icon
          icon="icon-[mdi--source-branch]"
          class="size-4 shrink-0 text-muted-foreground"
        />
        <div class="truncate text-sm font-medium">{{ props.repository.name }}</div>
        <Badge
          v-if="shouldShowRepositoryHealthBadge(props.repository)"
          :variant="getRepositoryHealthVariant(props.repository)"
          class="h-5"
        >
          {{ getRepositoryHealthLabel(props.repository) }}
        </Badge>
      </div>

      <div class="truncate text-xs text-muted-foreground">{{ props.repository.url }}</div>

      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground lg:grid-cols-4">
        <div>{{ m.extension.repository.priorityLine({ value: String(props.priorityLabel) }) }}</div>
        <div>
          {{ m.extension.repository.packageCountLine({ count: props.repository.packageCount }) }}
        </div>
        <div>
          {{
            m.extension.repository.manifestUpdatedLine({
              value: formatRepositoryDate(props.repository.manifestUpdatedAt)
            })
          }}
        </div>
        <div>
          {{
            m.extension.repository.lastCheckedLine({
              value: formatRepositoryDate(props.repository.lastRefreshAt)
            })
          }}
        </div>
      </div>

      <div
        v-if="props.repository.lastError"
        class="text-xs text-destructive"
      >
        {{ props.repository.lastError }}
      </div>
    </div>

    <div class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.extension.repository.detailsTooltip"
        @click="emit('details', props.repository)"
      >
        <Icon
          icon="icon-[mdi--information-outline]"
          class="size-4"
        />
      </Button>
      <Switch
        :model-value="props.repository.state === 'enabled'"
        :disabled="props.busy"
        @update:model-value="(enabled) => emit('toggle', props.repository, Boolean(enabled))"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="props.busy"
        @click="emit('refresh', props.repository)"
      >
        <Spinner
          v-if="props.busy"
          class="size-3"
        />
        <Icon
          v-else
          icon="icon-[mdi--refresh]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="props.busy || !props.canMoveUp"
        @click="emit('move', props.repository, -1)"
      >
        <Icon
          icon="icon-[mdi--arrow-up]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="props.busy || !props.canMoveDown"
        @click="emit('move', props.repository, 1)"
      >
        <Icon
          icon="icon-[mdi--arrow-down]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="props.busy"
        class="hover:text-destructive"
        @click="emit('remove', props.repository)"
      >
        <Icon
          icon="icon-[mdi--delete-outline]"
          class="size-4"
        />
      </Button>
    </div>
  </div>
</template>
