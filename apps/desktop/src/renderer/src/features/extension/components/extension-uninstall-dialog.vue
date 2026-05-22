<!--
Extension Uninstall Dialog confirms renderer-owned uninstall intent.
Boundary: performs uninstall IPC and can chain the explicit data purge IPC.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Label } from '@renderer/components/ui/label'
import { Spinner } from '@renderer/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
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
  <AlertDialog v-model:open="open">
    <AlertDialogContent class="max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>卸载 {{ props.extension.name }}？</AlertDialogTitle>
      </AlertDialogHeader>

      <div class="px-4 py-3 text-sm text-muted-foreground">
        <div class="flex items-center gap-2">
          <Checkbox
            id="extension-purge-data"
            :model-value="purgeData"
            :disabled="uninstalling"
            @update:model-value="updatePurgeData"
          />
          <Label
            for="extension-purge-data"
            class="text-sm font-normal cursor-pointer"
          >
            同时清除扩展数据
          </Label>
        </div>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="uninstalling">取消</AlertDialogCancel>
        <AlertDialogAction
          :disabled="uninstalling"
          @click.prevent="handleUninstall"
        >
          <Spinner
            v-if="uninstalling"
            class="size-4"
          />
          {{ purgeData ? '卸载并清除' : '卸载' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
