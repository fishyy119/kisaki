<!--
Installed Extension Card manages one installed extension row.
Boundary: toggles, updates, uninstalls, and opens structured settings.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { Badge } from '@renderer/components/ui/badge'
import { Spinner } from '@renderer/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { ExtensionSettingsDialog } from '@renderer/components/extension/settings'
import { cn } from '@renderer/utils/cn'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import {
  extensionContributionStore,
  refreshExtensionContributionSnapshot
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

const settingsContribution = computed(
  () =>
    extensionContributionStore.settings.value.find(
      (contribution) => contribution.extensionId === props.extension.id
    ) ?? null
)
const hasSettings = computed(() => settingsContribution.value !== null)

const iconUrl = computed(() => props.extension.iconUrl)
const versionLabel = computed(() =>
  props.extension.version ? `v${props.extension.version}` : '未知版本'
)
const isBuiltin = computed(() => props.extension.builtin)
const canToggle = computed(() => props.extension.status === 'ready' && !isBuiltin.value)
const statusLabel = computed(() => {
  switch (props.extension.status) {
    case 'ready':
      return null
    case 'invalid':
      return '包无效'
    case 'missing-package':
      return '包缺失'
    case 'orphaned':
      return '未登记'
  }

  return null
})
const runtimeLabel = computed(() => {
  if (!props.extension.enabled || props.extension.status !== 'ready') {
    return null
  }

  switch (props.extension.runtimeStatus) {
    case 'running':
      return '运行中'
    case 'failed':
      return '加载失败'
    case 'stopped':
      return '未运行'
  }

  return null
})
const runtimeBadgeVariant = computed(() =>
  props.extension.runtimeStatus === 'failed' ? 'destructive' : 'secondary'
)

watch(iconUrl, () => {
  iconError.value = false
})

async function handleToggle(enabled: boolean) {
  if (isBuiltin.value) {
    notify.error('内置扩展由 Kisaki 管理')
    return
  }

  if (!canToggle.value) {
    notify.error('无法启用扩展', props.extension.issues[0] ?? '扩展包当前不可运行')
    return
  }

  toggling.value = true
  try {
    if (enabled) {
      unwrapIpcVoid(await ipcManager.invoke('extension:enable', props.extension.id))
    } else {
      unwrapIpcVoid(await ipcManager.invoke('extension:disable', props.extension.id))
    }
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
    unwrapIpcVoid(await ipcManager.invoke('extension:uninstall', props.extension.id))
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
    unwrapIpcVoid(await ipcManager.invoke('extension:update', props.extension.id))
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

function openSettings() {
  if (!settingsContribution.value) {
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
        {{ versionLabel }}
      </span>
      <Badge
        v-if="isBuiltin"
        variant="secondary"
        class="text-[10px] px-1.5 py-0 h-4"
      >
        内置
      </Badge>
      <Badge
        v-if="props.updateInfo"
        variant="default"
        class="text-[10px] px-1.5 py-0 h-4"
      >
        更新
      </Badge>
      <Badge
        v-if="statusLabel"
        variant="secondary"
        class="text-[10px] px-1.5 py-0 h-4"
      >
        {{ statusLabel }}
      </Badge>
      <Badge
        v-if="runtimeLabel && !props.extension.runtimeError"
        :variant="runtimeBadgeVariant"
        class="text-[10px] px-1.5 py-0 h-4"
      >
        {{ runtimeLabel }}
      </Badge>
      <Tooltip v-else-if="runtimeLabel">
        <TooltipTrigger as-child>
          <Badge
            :variant="runtimeBadgeVariant"
            class="text-[10px] px-1.5 py-0 h-4"
          >
            {{ runtimeLabel }}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {{ props.extension.runtimeError }}
        </TooltipContent>
      </Tooltip>
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
        <template v-if="isBuiltin">
          <Icon
            icon="icon-[mdi--package-variant-closed-check]"
            class="size-4 text-muted-foreground"
          />
          <span class="text-xs text-muted-foreground">随应用启用</span>
        </template>
        <template v-else>
          <Switch
            v-model="enabledModel"
            :disabled="toggling || !canToggle"
            class="scale-90"
          />
          <span class="text-xs text-muted-foreground">
            {{ props.extension.enabled ? '启用' : '禁用' }}
          </span>
        </template>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-1">
        <Button
          v-if="props.updateInfo && !isBuiltin"
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
              @click="openSettings"
            >
              <Icon
                icon="icon-[mdi--cog-outline]"
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>设置</TooltipContent>
        </Tooltip>
        <Tooltip v-if="!isBuiltin">
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
    <ExtensionSettingsDialog
      v-if="settingsOpen && settingsContribution"
      v-model:open="settingsOpen"
      :contribution="settingsContribution"
    />
  </div>
</template>
