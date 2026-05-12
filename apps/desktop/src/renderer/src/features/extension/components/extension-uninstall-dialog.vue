<!--
Extension Uninstall Dialog confirms renderer-owned uninstall intent.
Boundary: performs uninstall IPC and leaves extension data cleanup to a later explicit feature.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
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
import type { ExtensionCatalogInfo } from '@shared/extension'

interface Props {
  extension: ExtensionCatalogInfo
}

interface Emits {
  (e: 'uninstalled'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })
const uninstalling = ref(false)

async function handleUninstall() {
  uninstalling.value = true
  try {
    unwrapIpcVoid(await ipcManager.invoke('extension:uninstall', props.extension.id))
    await refreshExtensionContributionSnapshot()

    notify.success('扩展已卸载')
    open.value = false
    emit('uninstalled')
  } catch (error) {
    notify.error('卸载失败', error instanceof Error ? error.message : String(error))
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
          卸载 {{ props.extension.name }} 会移除扩展代码，并保留本地设置和数据。
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <div class="rounded-md border border-border p-3 text-xs text-muted-foreground">
          <div class="flex items-start gap-2">
            <Icon
              icon="icon-[mdi--information-outline]"
              class="size-4 mt-0.5 shrink-0"
            />
            <div>
              清除扩展数据会在后续独立操作中提供；当前卸载不会删除扩展 storage、secrets
              或运行时缓存。
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
          卸载
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
