<!--
  GameLaunchConfigLaunchTab
  Launch configuration tab content with game directory, launcher mode, and path settings.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { ipcManager } from '@renderer/core/ipc'
import { GameLauncherMode } from '@shared/db'
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
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const dirPath = defineModel<string>('dirPath', { required: true })
const launcherMode = defineModel<GameLauncherMode>('launcherMode', { required: true })
const launcherPath = defineModel<string>('launcherPath', { required: true })

const LAUNCHER_MODE_OPTIONS = computed<
  { value: GameLauncherMode; label: string; description: string }[]
>(() => [
  {
    value: 'file',
    label: m.value.game.launchConfig.modeFile,
    description: m.value.game.launchConfig.modeFileHint
  },
  {
    value: 'url',
    label: m.value.game.launchConfig.modeUrl,
    description: m.value.game.launchConfig.modeUrlHint
  },
  {
    value: 'exec',
    label: m.value.game.launchConfig.modeExec,
    description: m.value.game.launchConfig.modeExecHint
  }
])

async function handleSelectGameDirPath() {
  const result = await ipcManager.invoke('native:open-dialog', {
    properties: ['openDirectory']
  })
  if (result.success && result.data && !result.data.canceled && result.data.filePaths[0]) {
    dirPath.value = result.data.filePaths[0]
  }
}

async function handleSelectLauncherPath() {
  const result = await ipcManager.invoke('native:open-dialog', {
    properties: ['openFile']
  })
  if (result.success && result.data && !result.data.canceled && result.data.filePaths[0]) {
    launcherPath.value = result.data.filePaths[0]
  }
}
</script>

<template>
  <FieldGroup>
    <Field>
      <FieldLabel>{{ m.game.launchConfig.gameDirLabel }}</FieldLabel>
      <FieldContent>
        <div class="flex gap-2">
          <Input
            v-model="dirPath"
            :placeholder="m.states.notSet"
          />
          <Button
            type="button"
            variant="input"
            size="icon"
            @click="handleSelectGameDirPath"
          >
            <Icon
              icon="icon-[mdi--folder-open-outline]"
              class="size-4"
            />
          </Button>
        </div>
      </FieldContent>
      <FieldDescription>{{ m.game.launchConfig.gameDirHint }}</FieldDescription>
    </Field>

    <Field>
      <FieldLabel>{{ m.game.launchConfig.launchModeLabel }}</FieldLabel>
      <FieldContent>
        <Select v-model="launcherMode">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in LAUNCHER_MODE_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldContent>
      <FieldDescription>
        {{ LAUNCHER_MODE_OPTIONS.find((o) => o.value === launcherMode)?.description }}
      </FieldDescription>
    </Field>

    <Field>
      <FieldLabel>
        {{
          launcherMode === 'url'
            ? m.game.launchConfig.launchUrlLabel
            : launcherMode === 'exec'
              ? m.game.launchConfig.launchCommandLabel
              : m.game.launchConfig.launchFileLabel
        }}
      </FieldLabel>
      <FieldContent>
        <div class="flex gap-2">
          <Input
            v-model="launcherPath"
            :placeholder="
              launcherMode === 'url' ? m.game.launchConfig.urlPlaceholder : m.states.notSet
            "
          />
          <Button
            v-if="launcherMode === 'file'"
            type="button"
            variant="input"
            size="icon"
            @click="handleSelectLauncherPath"
          >
            <Icon
              icon="icon-[mdi--file-outline]"
              class="size-4"
            />
          </Button>
        </div>
      </FieldContent>
    </Field>
  </FieldGroup>
</template>
