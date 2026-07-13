<!--
Extension Signer Panel manages extension-scoped signer trust.
Boundary: calls signer trust IPC only; trust remains scoped by extension id.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { useAsyncData, useRenderState } from '@renderer/composables'
import SignerDetailsDialog from './signer-details-dialog.vue'
import SignerPanelRow from './signer-panel-row.vue'
import SignerRemoveDialog from './signer-remove-dialog.vue'
import type { ExtensionTrustedSignerInfo } from '@shared/extension'

const removing = ref(false)
const detailsDialogOpen = ref(false)
const removeDialogOpen = ref(false)
const signerToView = ref<ExtensionTrustedSignerInfo | null>(null)
const signerToRemove = ref<ExtensionTrustedSignerInfo | null>(null)

const {
  data: signers,
  isLoading,
  error,
  refetch
} = useAsyncData(
  async () => unwrapIpcData(await ipcManager.invoke('extension:list-trusted-signers')),
  { immediate: true }
)
const state = useRenderState(isLoading, error, signers, { preset: 'network' })
const signerList = computed(() =>
  [...(signers.value ?? [])].sort(
    (left, right) =>
      left.extensionId.localeCompare(right.extensionId) ||
      left.fingerprint.localeCompare(right.fingerprint)
  )
)

let unsubscribeTrustedSignersChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeTrustedSignersChanged = ipcManager.on('extension:trusted-signers-changed', () => {
    refetch()
  })
})

onUnmounted(() => {
  unsubscribeTrustedSignersChanged?.()
})

watch(detailsDialogOpen, (open) => {
  if (!open) {
    signerToView.value = null
  }
})

watch(removeDialogOpen, (open) => {
  if (!open) {
    signerToRemove.value = null
  }
})

function openDetailsDialog(signer: ExtensionTrustedSignerInfo): void {
  signerToView.value = signer
  detailsDialogOpen.value = true
}

function openRemoveDialog(signer: ExtensionTrustedSignerInfo): void {
  signerToRemove.value = signer
  removeDialogOpen.value = true
}

async function handleRemoveSigner(): Promise<void> {
  const signer = signerToRemove.value
  if (!signer) {
    return
  }

  removing.value = true
  try {
    unwrapIpcVoid(await ipcManager.invoke('extension:remove-trusted-signer', signer.id))
    notify.success('签名信任已撤销')
    removeDialogOpen.value = false
    signerToRemove.value = null
    refetch()
  } catch (err) {
    notify.error('撤销签名信任失败', err instanceof Error ? err.message : String(err))
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="shrink-0 flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-3">
      <div class="flex-1">
        <div class="text-sm font-medium">签名信任</div>
        <div class="text-xs text-muted-foreground">{{ signerList.length }} 个扩展级签名指纹</div>
      </div>

      <Button
        variant="outline"
        size="sm"
        :disabled="state === 'loading'"
        @click="refetch"
      >
        <Icon
          icon="icon-[mdi--refresh]"
          class="size-4"
        />
        刷新
      </Button>
    </div>

    <div class="flex-1 overflow-auto">
      <StateView
        v-if="state === 'loading'"
        state="loading"
        class="h-48"
      />

      <StateView
        v-else-if="signerList.length === 0"
        state="empty"
        icon="icon-[mdi--shield-key-outline]"
        title="暂无信任的签名指纹"
        class="h-48"
      />

      <template v-else>
        <div class="divide-y divide-border">
          <SignerPanelRow
            v-for="signer in signerList"
            :key="signer.id"
            :signer="signer"
            @details="openDetailsDialog"
            @remove="openRemoveDialog"
          />
        </div>
      </template>
    </div>

    <SignerDetailsDialog
      v-if="detailsDialogOpen && signerToView"
      v-model:open="detailsDialogOpen"
      :signer="signerToView"
    />

    <SignerRemoveDialog
      v-if="removeDialogOpen && signerToRemove"
      v-model:open="removeDialogOpen"
      :signer="signerToRemove"
      :removing="removing"
      @confirm="handleRemoveSigner"
    />
  </div>
</template>
