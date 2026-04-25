<!--
Installed Extension Card manages one installed extension row.
Boundary: toggles, updates, uninstalls, and opens structured settings.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { Badge } from '@renderer/components/ui/badge'
import { Spinner } from '@renderer/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { ExtensionSettingsPanelDialog } from '@renderer/components/shared/extension'
import { cn } from '@renderer/utils/cn'
import { notify } from '@renderer/core/notify'
import {
  disableExtension,
  enableExtension,
  extensionContributionStore,
  refreshExtensionContributionSnapshot,
  uninstallExtension,
  updateExtension
} from '@renderer/core/extensions'
import type { ExtensionCatalogInfo, ExtensionUpdateInfo } from '@shared/extension'

interface Props {
  extension: ExtensionCatalogInfo
  updateInfo?: ExtensionUpdateInfo
}

interface Emits {
  (e: 'refresh'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const toggling = ref(false)
const uninstalling = ref(false)
const updating = ref(false)
const iconError = ref(false)
const settingsOpen = ref(false)

const settingsPanel = computed(
  () =>
    extensionContributionStore.settingsPanels.value.find(
      (panel) => panel.extensionId === props.extension.id
    ) ?? null
)
const hasSettings = computed(() => settingsPanel.value !== null)

// Fixed icon.png convention - construct file:// URL
const iconUrl = computed(() => {
  if (!props.extension.directory) return undefined
  const fullPath = `${props.extension.directory}/icon.png`.replace(/\\/g, '/')
  return `file://${fullPath}`
})

async function handleToggle(enabled: boolean) {
  toggling.value = true
  try {
    await (enabled ? enableExtension(props.extension.id) : disableExtension(props.extension.id))
    await refreshExtensionContributionSnapshot()

    notify.success(enabled ? '扩展已启用' : '扩展已禁用')
    emit('refresh')
  } catch (error) {
    console.error('Toggle failed:', error)
    notify.error('操作失败', (error as Error).message)
  } finally {
    toggling.value = false
  }
}

// Computed model for extension enabled state
const enabledModel = computed({
  get: () => props.extension.enabled,
  set: (v: boolean) => handleToggle(v)
})

async function handleUninstall() {
  uninstalling.value = true
  try {
    await uninstallExtension(props.extension.id)
    await refreshExtensionContributionSnapshot()

    notify.success('扩展已卸载')
    emit('refresh')
  } catch (error) {
    console.error('Uninstall failed:', error)
    notify.error('卸载失败', (error as Error).message)
  } finally {
    uninstalling.value = false
  }
}

async function handleUpdate() {
  updating.value = true
  try {
    await updateExtension(props.extension.id)
    await refreshExtensionContributionSnapshot()

    notify.success('扩展更新成功')
    emit('refresh')
  } catch (error) {
    console.error('Update failed:', error)
    notify.error('更新失败', (error as Error).message)
  } finally {
    updating.value = false
  }
}

function openSettingsPanel() {
  if (!settingsPanel.value) {
    return
  }

  settingsOpen.value = true
}
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col p-4 border-r border-b',
        'hover:bg-accent/50 transition-colors',
        !props.extension.enabled && 'opacity-50'
      )
    "
  >
    <!-- Header -->
    <div class="flex items-center gap-2 mb-2">
      <img
        v-if="iconUrl && !iconError"
        :src="iconUrl"
        alt=""
        class="size-5 rounded shrink-0 border shadow-xs"
        @error="iconError = true"
      />
      <Icon
        v-else
        icon="icon-[mdi--puzzle-outline]"
        class="size-5 text-primary shrink-0"
      />
      <h3 class="text-sm font-medium truncate flex-1">{{ props.extension.name }}</h3>
      <span class="text-[10px] text-muted-foreground/70 px-1.5 py-0.5 bg-muted/30 rounded">
        v{{ props.extension.version }}
      </span>
      <Badge
        v-if="props.updateInfo"
        variant="default"
        class="text-[10px] px-1.5 py-0 h-4"
      >
        更新
      </Badge>
    </div>

    <!-- Meta -->
    <div class="text-xs text-muted-foreground mb-2">{{ props.extension.author || '未知' }}</div>

    <!-- Description -->
    <p class="text-xs text-muted-foreground/70 line-clamp-2 flex-1 mb-3">
      {{ props.extension.description || '无描述' }}
    </p>

    <!-- Footer -->
    <div class="flex items-center justify-between">
      <!-- Enable/Disable -->
      <div class="flex items-center gap-2">
        <Switch
          v-model="enabledModel"
          :disabled="toggling"
          class="scale-90"
        />
        <span class="text-xs text-muted-foreground">
          {{ props.extension.enabled ? '启用' : '禁用' }}
        </span>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-1">
        <Button
          v-if="props.updateInfo"
          size="sm"
          variant="default"
          :disabled="updating"
          @click="handleUpdate"
        >
          <Spinner
            v-if="updating"
            class="size-3"
          />
          <Icon
            v-else
            icon="icon-[mdi--refresh]"
            class="size-3.5"
          />
          更新
        </Button>
        <Tooltip v-if="hasSettings">
          <TooltipTrigger as-child>
            <Button
              size="icon-sm"
              variant="ghost"
              @click="openSettingsPanel"
            >
              <Icon
                icon="icon-[mdi--cog-outline]"
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>设置</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-sm"
              variant="ghost"
              :disabled="uninstalling"
              class="hover:text-destructive"
              @click="handleUninstall"
            >
              <Spinner
                v-if="uninstalling"
                class="size-3"
              />
              <Icon
                v-else
                icon="icon-[mdi--delete-outline]"
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>卸载</TooltipContent>
        </Tooltip>
      </div>
    </div>

    <!-- Settings Dialog -->
    <ExtensionSettingsPanelDialog
      v-if="settingsOpen && settingsPanel"
      v-model:open="settingsOpen"
      :panel="settingsPanel"
    />
  </div>
</template>
