<script setup lang="ts">
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import type { ExtensionResolvedSettingsPanelLinkNode } from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelLinkNode
}>()

async function openLink(): Promise<void> {
  if (props.node.disabled) {
    return
  }

  try {
    unwrapIpcVoid(await ipcManager.invoke('native:open-external', props.node.href))
  } catch (error) {
    notify.error('打开链接失败', error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <button
    type="button"
    class="inline-flex min-w-0 max-w-full items-center text-left text-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
    :disabled="props.node.disabled"
    @click="openLink"
  >
    <span class="truncate">{{ props.node.label }}</span>
  </button>
</template>
