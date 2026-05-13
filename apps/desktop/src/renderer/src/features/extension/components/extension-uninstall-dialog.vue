<!--
Extension Uninstall Dialog confirms renderer-owned uninstall intent.
Boundary: performs uninstall IPC and can chain the explicit data purge IPC.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Label } from '@renderer/components/ui/label'
import { Spinner } from '@renderer/components/ui/spinner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { refreshExtensionContributionSnapshot } from '@renderer/core/extensions'
import type { ExtensionInstalledPackageInfo } from '@shared/extension'

interface Props {
  extension: ExtensionInstalledPackageInfo
}

interface Emits {
  (e: 'uninstalled'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })
const uninstalling = ref(false)
const purgeData = ref(false)

function updatePurgeData(value: boolean | 'indeterminate') {
  purgeData.value = value === true
}

async function handleUninstall() {
  uninstalling.value = true
  let uninstalled = false

  try {
    unwrapIpcVoid(await ipcManager.invoke('extension:uninstall', props.extension.id))
    uninstalled = true

    if (purgeData.value) {
      unwrapIpcVoid(
        await ipcManager.invoke('extension:purge-data', {
          extensionId: props.extension.id
        })
      )
    }

    await refreshExtensionContributionSnapshot()

    notify.success(purgeData.value ? '扩展已卸载并清除数据' : '扩展已卸载')
    open.value = false
    emit('uninstalled')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (uninstalled) {
      await refreshExtensionContributionSnapshot().catch(() => undefined)
      notify.error('扩展已卸载，清除数据失败', message)
      open.value = false
      emit('uninstalled')
    } else {
      notify.error('卸载失败', message)
    }
  } finally {
    uninstalling.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>卸载扩展</DialogTitle>
        <DialogDescription>
          卸载 {{ props.extension.name }} 会移除扩展代码，默认保留本地设置和数据。
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <div class="space-y-3">
          <div class="flex items-start gap-2 rounded-md border border-border p-3">
            <Checkbox
              id="extension-purge-data"
              class="mt-0.5"
              :model-value="purgeData"
              :disabled="uninstalling"
              @update:model-value="updatePurgeData"
            />
            <div class="space-y-1">
              <Label
                for="extension-purge-data"
                class="text-sm font-medium cursor-pointer"
              >
                同时清除扩展数据
              </Label>
              <p class="text-xs text-muted-foreground">
                删除该扩展的本地配置、缓存和 secret。此操作不能撤销。
              </p>
            </div>
          </div>

          <div
            v-if="purgeData"
            class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
          >
            <div class="flex items-start gap-2">
              <Icon
                icon="icon-[mdi--alert-outline]"
                class="size-4 mt-0.5 shrink-0"
              />
              <div>清除数据后，重新安装该扩展也不会恢复原有配置或密钥。</div>
            </div>
          </div>

          <div
            v-else
            class="rounded-md border border-border p-3 text-xs text-muted-foreground"
          >
            <div class="flex items-start gap-2">
              <Icon
                icon="icon-[mdi--information-outline]"
                class="size-4 mt-0.5 shrink-0"
              />
              <div>本次只卸载扩展代码，保留设置、缓存和 secret。</div>
            </div>
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="uninstalling"
          @click="open = false"
        >
          取消
        </Button>
        <Button
          variant="destructive"
          :disabled="uninstalling"
          @click="handleUninstall"
        >
          <Spinner
            v-if="uninstalling"
            class="size-4"
          />
          {{ purgeData ? '卸载并清除' : '卸载' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
