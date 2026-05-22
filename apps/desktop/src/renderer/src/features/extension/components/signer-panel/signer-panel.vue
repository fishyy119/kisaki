<!--
Extension Signer Panel manages extension-scoped signer trust.
Boundary: calls signer trust IPC only; trust remains scoped by extension id.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Spinner } from '@renderer/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
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
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { useAsyncData, useRenderState } from '@renderer/composables'
import type { ExtensionTrustedSignerInfo } from '@shared/extension'

const removing = ref(false)
const removeDialogOpen = ref(false)
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

function shortFingerprint(value: string): string {
  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return date.toLocaleString()
}

function repositoryLabel(signer: ExtensionTrustedSignerInfo): string {
  return signer.trustedFromRepositoryUrl ?? signer.trustedFromRepositoryId ?? '本地确认'
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="shrink-0 flex items-center gap-3 border-b border-border bg-background/50 px-4 py-3">
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

    <div class="flex-1 overflow-auto scrollbar-thin">
      <template v-if="state === 'loading'">
        <div class="flex h-48 items-center justify-center">
          <Spinner class="size-6" />
        </div>
      </template>

      <template v-else-if="signerList.length === 0">
        <div class="flex h-48 flex-col items-center justify-center text-muted-foreground">
          <Icon
            icon="icon-[mdi--shield-key-outline]"
            class="mb-3 size-16 opacity-30"
          />
          <p class="font-medium">暂无信任的签名指纹</p>
        </div>
      </template>

      <template v-else>
        <div class="divide-y divide-border">
          <div
            v-for="signer in signerList"
            :key="signer.id"
            class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 transition-colors hover:bg-accent/40"
          >
            <div class="min-w-0 space-y-2">
              <div class="flex min-w-0 items-center gap-2">
                <Icon
                  icon="icon-[mdi--shield-key-outline]"
                  class="size-4 shrink-0 text-muted-foreground"
                />
                <span class="truncate text-sm font-medium">{{ signer.extensionId }}</span>
                <Badge
                  variant="secondary"
                  class="h-5 text-[10px]"
                >
                  {{ signer.algorithm }}
                </Badge>
                <Badge
                  v-if="signer.label"
                  variant="outline"
                  class="h-5 max-w-44 truncate text-[10px]"
                >
                  {{ signer.label }}
                </Badge>
              </div>

              <div class="font-mono text-xs text-muted-foreground">
                {{ shortFingerprint(signer.fingerprint) }}
              </div>

              <div
                class="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground lg:grid-cols-2"
              >
                <div class="truncate">来源：{{ repositoryLabel(signer) }}</div>
                <div>信任时间：{{ formatDate(signer.trustedAt) }}</div>
              </div>
            </div>

            <div class="flex items-center">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="hover:text-destructive"
                    @click="openRemoveDialog(signer)"
                  >
                    <Icon
                      icon="icon-[mdi--delete-outline]"
                      class="size-4"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>撤销信任</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </template>
    </div>

    <Dialog v-model:open="removeDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>撤销签名信任</DialogTitle>
          <DialogDescription>
            {{ signerToRemove?.extensionId }}
          </DialogDescription>
        </DialogHeader>

        <DialogBody
          v-if="signerToRemove"
          class="space-y-3 text-sm"
        >
          <div class="rounded-md border border-border px-3 py-2">
            <div class="text-xs text-muted-foreground">签名指纹</div>
            <div class="break-all font-mono text-xs">{{ signerToRemove.fingerprint }}</div>
          </div>
          <div class="text-xs text-muted-foreground">
            撤销后，使用该指纹的新版本将需要重新确认。
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            :disabled="removing"
            @click="removeDialogOpen = false"
          >
            取消
          </Button>
          <Button
            variant="destructive"
            :disabled="removing"
            @click="handleRemoveSigner"
          >
            <Spinner
              v-if="removing"
              class="size-4"
            />
            撤销
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
