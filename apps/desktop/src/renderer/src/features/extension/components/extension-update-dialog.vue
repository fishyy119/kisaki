<!--
Extension Update Dialog confirms renderer-owned update intent.
Boundary: calls update IPC after showing the available update summary.
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
import type { ExtensionCatalogInfo, ExtensionUpdateInfo } from '@shared/extension'

interface Props {
  extension: ExtensionCatalogInfo
  updateInfo: ExtensionUpdateInfo
}

interface Emits {
  (e: 'updated'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })
const updating = ref(false)

async function handleUpdate() {
  updating.value = true
  try {
    unwrapIpcVoid(await ipcManager.invoke('extension:update', props.extension.id))
    await refreshExtensionContributionSnapshot()

    notify.success('扩展更新成功')
    open.value = false
    emit('updated')
  } catch (error) {
    notify.error('更新失败', error instanceof Error ? error.message : String(error))
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>更新扩展</DialogTitle>
        <DialogDescription>
          {{ props.extension.name }} 可从 v{{ props.updateInfo.currentVersion }} 更新到 v{{
            props.updateInfo.latestVersion
          }}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <div class="rounded-md border border-border p-3 text-xs text-muted-foreground space-y-1">
          <div class="flex items-center gap-2">
            <Icon
              icon="icon-[mdi--source-repository]"
              class="size-4"
            />
            <span> 来源：{{ props.updateInfo.source?.provider ?? '未知' }} </span>
          </div>
          <div>Release：{{ props.updateInfo.source?.locator ?? '未知' }}</div>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="updating"
          @click="open = false"
        >
          取消
        </Button>
        <Button
          :disabled="updating"
          @click="handleUpdate"
        >
          <Spinner
            v-if="updating"
            class="size-4"
          />
          更新
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
