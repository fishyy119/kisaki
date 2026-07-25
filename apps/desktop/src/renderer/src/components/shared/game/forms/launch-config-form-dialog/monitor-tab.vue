<!--
  GameLaunchConfigMonitorTab
  Monitor configuration tab content with monitor mode and path settings.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { ipcManager } from '@renderer/core/ipc'
import { GameMonitorMode } from '@shared/db'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@renderer/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface Props {
  effectiveMonitorPath: string | null
}

const props = defineProps<Props>()

const monitorMode = defineModel<GameMonitorMode>('monitorMode', { required: true })
const monitorPath = defineModel<string>('monitorPath', { required: true })

const MONITOR_MODE_OPTIONS = computed<
  { value: GameMonitorMode; label: string; description: string }[]
>(() => [
  {
    value: 'folder',
    label: m.value.game.launchConfig.monitorFolder,
    description: m.value.game.launchConfig.monitorFolderHint
  },
  {
    value: 'file',
    label: m.value.game.launchConfig.monitorFile,
    description: m.value.game.launchConfig.monitorFileHint
  },
  {
    value: 'process',
    label: m.value.game.launchConfig.monitorProcess,
    description: m.value.game.launchConfig.monitorProcessHint
  }
])

async function handleSelectMonitorPath() {
  const result = await ipcManager.invoke('native:open-dialog', {
    properties: [monitorMode.value === 'file' ? 'openFile' : 'openDirectory']
  })
  if (result.success && result.data && !result.data.canceled && result.data.filePaths[0]) {
    monitorPath.value = result.data.filePaths[0]
  }
}
</script>

<template>
  <FieldGroup>
    <Field>
      <FieldLabel>{{ m.game.launchConfig.monitorModeLabel }}</FieldLabel>
      <FieldContent>
        <Select v-model="monitorMode">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in MONITOR_MODE_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldContent>
      <FieldDescription>
        {{ MONITOR_MODE_OPTIONS.find((o) => o.value === monitorMode)?.description }}
      </FieldDescription>
    </Field>

    <Field>
      <FieldLabel class="inline-flex items-center gap-1">
        {{
          monitorMode === 'process'
            ? m.game.launchConfig.processNameLabel
            : m.game.launchConfig.monitorPathLabel
        }}
        <Tooltip>
          <TooltipTrigger as-child>
            <Icon
              icon="icon-[mdi--help-circle-outline]"
              class="size-3.5 text-muted-foreground cursor-help"
            />
          </TooltipTrigger>
          <TooltipContent class="max-w-xs">
            <div class="space-y-1">
              <div class="font-medium">{{ m.game.launchConfig.autoDeriveTitle }}</div>
              <div class="text-muted-foreground">
                <template v-if="monitorMode === 'folder'">
                  {{ m.game.launchConfig.autoDeriveFolderHint }}
                </template>
                <template v-else-if="monitorMode === 'file'">{{
                  m.game.launchConfig.autoDeriveFileHint
                }}</template>
                <template v-else>{{ m.game.launchConfig.autoDeriveProcessHint }}</template>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </FieldLabel>
      <FieldContent>
        <div class="flex gap-2">
          <Input
            v-model="monitorPath"
            :placeholder="m.game.launchConfig.autoDerivePlaceholder"
          />
          <Button
            v-if="monitorMode !== 'process'"
            type="button"
            variant="input"
            size="icon"
            @click="handleSelectMonitorPath"
          >
            <Icon
              :icon="
                monitorMode === 'file'
                  ? 'icon-[mdi--file-outline]'
                  : 'icon-[mdi--folder-open-outline]'
              "
              class="size-4"
            />
          </Button>
        </div>
      </FieldContent>
      <FieldDescription v-if="!monitorPath && props.effectiveMonitorPath">
        {{ m.game.launchConfig.willUse({ path: props.effectiveMonitorPath }) }}
      </FieldDescription>
    </Field>
  </FieldGroup>
</template>
