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
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { ExtensionSettingsPanelDialog } from '@renderer/components/extension/settings-panels'
import ExtensionUninstallDialog from '../extension-uninstall-dialog.vue'
import ExtensionUpdateDialog from '../extension-update-dialog.vue'
import ExtensionUpdatePolicyDialog from '../extension-update-policy-dialog.vue'
import { cn } from '@renderer/utils/cn'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import {
  extensionContributionStore,
  refreshExtensionContributionSnapshot
} from '@renderer/core/extensions'
import type {
  ExtensionInstalledPackageInfo,
  ExtensionInstallUpdatePolicy,
  ExtensionSettingsPanelRegistrationInfo,
  ExtensionUpdateInfo
} from '@shared/extension'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Extension')

interface Props {
  extension: ExtensionInstalledPackageInfo
  updateInfo?: ExtensionUpdateInfo
}

interface Emits {
  (e: 'refresh'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const toggling = ref(false)
const iconError = ref(false)
const settingsOpen = ref(false)
const updateDialogOpen = ref(false)
const updatePolicyDialogOpen = ref(false)
const uninstallDialogOpen = ref(false)
const activeSettingsContribution = ref<ExtensionSettingsPanelRegistrationInfo | null>(null)
const settingsContributionMissingWhileOpen = ref(false)
const settingsRegistrationRevision = ref(0)

const UPDATE_POLICY_LABELS: Record<ExtensionInstallUpdatePolicy, string> = {
  manual: '手动',
  notify: '通知',
  auto: '自动',
  pinned: '固定'
}

const settingsContribution = computed(
  () =>
    extensionContributionStore.settingsPanels.value.find(
      (contribution) => contribution.extensionId === props.extension.id
    ) ?? null
)
const hasSettings = computed(
  () =>
    settingsContribution.value !== null ||
    Boolean(settingsOpen.value && activeSettingsContribution.value)
)
const settingsContributionAvailable = computed(() => settingsContribution.value !== null)

const iconUrl = computed(() => props.extension.iconUrl)
const versionLabel = computed(() =>
  props.extension.version ? `v${props.extension.version}` : '未知版本'
)
const isBuiltin = computed(() => props.extension.builtin)
const canToggle = computed(() => props.extension.status === 'ready' && !isBuiltin.value)
const updatePolicyLabel = computed(() => {
  if (isBuiltin.value) {
    return '内置'
  }

  const policy = props.extension.updatePolicy ?? 'manual'
  return UPDATE_POLICY_LABELS[policy]
})
const channelLabel = computed(() => props.extension.channel ?? 'stable')
const statusLabel = computed(() => {
  switch (props.extension.status) {
    case 'ready':
      return null
    case 'invalid':
      return '包无效'
    case 'missing-package':
      return '包缺失'
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

watch(settingsContribution, (contribution) => {
  if (!settingsOpen.value) {
    return
  }

  if (!contribution) {
    settingsContributionMissingWhileOpen.value = true
    return
  }

  const previous = activeSettingsContribution.value
  activeSettingsContribution.value = contribution

  if (
    settingsContributionMissingWhileOpen.value ||
    !previous ||
    getSettingsContributionKey(previous) !== getSettingsContributionKey(contribution)
  ) {
    settingsRegistrationRevision.value += 1
  }

  settingsContributionMissingWhileOpen.value = false
})

watch(settingsOpen, (open) => {
  if (!open) {
    activeSettingsContribution.value = null
    settingsContributionMissingWhileOpen.value = false
    return
  }

  const contribution = settingsContribution.value
  if (contribution) {
    activeSettingsContribution.value = contribution
    settingsContributionMissingWhileOpen.value = false
  }
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
    log.error('Toggle failed:', error)
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

function openSettingsPanel() {
  if (!settingsContribution.value) {
    return
  }

  activeSettingsContribution.value = settingsContribution.value
  settingsContributionMissingWhileOpen.value = false
  settingsOpen.value = true
}

function getSettingsContributionKey(contribution: ExtensionSettingsPanelRegistrationInfo): string {
  return [
    contribution.extensionId,
    contribution.contributionId,
    contribution.extensionVersion,
    contribution.title,
    contribution.description ?? '',
    contribution.order
  ].join('\0')
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
    <div class="text-xs text-muted-foreground mb-2 space-y-1">
      <div>{{ props.extension.author || '未知' }}</div>
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>策略：{{ updatePolicyLabel }}</span>
        <span v-if="!isBuiltin">频道：{{ channelLabel }}</span>
        <span v-if="props.extension.pinnedVersion">固定：v{{ props.extension.pinnedVersion }}</span>
      </div>
    </div>

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
          @click="updateDialogOpen = true"
        >
          <Icon
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
        <Tooltip v-if="!isBuiltin">
          <TooltipTrigger as-child>
            <Button
              size="icon-sm"
              variant="ghost"
              @click="updatePolicyDialogOpen = true"
            >
              <Icon
                icon="icon-[mdi--update]"
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>更新策略</TooltipContent>
        </Tooltip>
        <Tooltip v-if="!isBuiltin">
          <TooltipTrigger as-child>
            <Button
              size="icon-sm"
              variant="ghost"
              class="hover:text-destructive"
              @click="uninstallDialogOpen = true"
            >
              <Icon
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
      v-if="settingsOpen && activeSettingsContribution"
      v-model:open="settingsOpen"
      :contribution="activeSettingsContribution"
      :available="settingsContributionAvailable"
      :registration-revision="settingsRegistrationRevision"
    />

    <ExtensionUpdateDialog
      v-if="updateDialogOpen && props.updateInfo"
      v-model:open="updateDialogOpen"
      :extension="props.extension"
      :update-info="props.updateInfo"
      @updated="emit('refresh')"
    />

    <ExtensionUpdatePolicyDialog
      v-if="updatePolicyDialogOpen"
      v-model:open="updatePolicyDialogOpen"
      :extension="props.extension"
      @updated="emit('refresh')"
    />

    <ExtensionUninstallDialog
      v-if="uninstallDialogOpen"
      v-model:open="uninstallDialogOpen"
      :extension="props.extension"
      @uninstalled="emit('refresh')"
    />
  </div>
</template>
