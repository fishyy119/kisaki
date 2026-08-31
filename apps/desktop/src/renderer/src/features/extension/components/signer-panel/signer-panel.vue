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
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { useI18n } from '@renderer/composables/use-i18n'
import { extensionSignersData } from '../../composables'
import SignerDetailsDialog from './signer-details-dialog.vue'
import SignerPanelRow from './signer-panel-row.vue'
import SignerRemoveDialog from './signer-remove-dialog.vue'
import type { ExtensionTrustedSignerInfo } from '@shared/extension'

const { m } = useI18n()
const removing = ref(false)
const detailsDialogOpen = ref(false)
const removeDialogOpen = ref(false)
const signerToView = ref<ExtensionTrustedSignerInfo | null>(null)
const signerToRemove = ref<ExtensionTrustedSignerInfo | null>(null)

// Data settled during navigation by the route loader
const { data: signers, error, refetch } = extensionSignersData()
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
    notify.success(m.value.extension.signer.revoked)
    removeDialogOpen.value = false
    signerToRemove.value = null
    refetch()
  } catch (err) {
    notify.error(
      m.value.extension.signer.revokeFailed,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="shrink-0 flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
      <div class="flex-1">
        <div class="text-sm font-medium">{{ m.extension.signer.panelTitle }}</div>
        <div class="text-xs text-muted-foreground">
          {{ m.extension.signer.panelSummary({ count: signerList.length }) }}
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        @click="refetch"
      >
        <Icon
          icon="icon-[mdi--refresh]"
          class="size-4"
        />
        {{ m.common.refresh }}
      </Button>
    </div>

    <div class="flex-1 overflow-auto">
      <StateView
        v-if="error"
        state="error"
        :error="error"
        class="h-48"
      />

      <StateView
        v-else-if="signerList.length === 0"
        state="empty"
        icon="icon-[mdi--shield-key-outline]"
        :title="m.extension.signer.emptyTitle"
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
