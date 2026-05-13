<!--
Extension Update Dialog confirms renderer-owned update intent.
Boundary: calls update IPC after showing the available update summary.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { Switch } from '@renderer/components/ui/switch'
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
import { refreshExtensionContributionSnapshot } from '@renderer/core/extensions'
import type { ExtensionInstalledPackageInfo, ExtensionUpdateInfo } from '@shared/extension'

interface Props {
  extension: ExtensionInstalledPackageInfo
  updateInfo: ExtensionUpdateInfo
}

interface Emits {
  (e: 'updated'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })
const updating = ref(false)
const cancelling = ref(false)
const currentOperationId = ref<string | null>(null)
const trustSignerFingerprint = ref(false)
const signerLabel = computed(() => {
  switch (props.updateInfo.signer?.status) {
    case 'trusted':
      return '已信任签名'
    case 'untrusted':
      return '未信任签名'
    case 'changed':
      return '签名已变更'
    case 'unsigned':
      return '未签名'
    default:
      return '未知签名状态'
  }
})
const signerTone = computed(() =>
  props.updateInfo.signer?.status === 'trusted' ? 'text-emerald-600' : 'text-amber-600'
)
const repositoryLabel = computed(() => props.updateInfo.repository?.name ?? '未知仓库')
const releaseLabel = computed(() => props.updateInfo.release?.releaseDigest ?? '未知')
const canTrustSigner = computed(() => {
  const signer = props.updateInfo.signer
  return Boolean(signer?.fingerprint && signer.status !== 'trusted' && signer.status !== 'unsigned')
})

async function handleUpdate() {
  updating.value = true
  const operationId = createOperationId()
  currentOperationId.value = operationId
  try {
    unwrapIpcVoid(
      await ipcManager.invoke('extension:update', {
        operationId,
        extensionId: props.extension.id,
        planId: props.updateInfo.planId,
        planFingerprint: props.updateInfo.planFingerprint,
        acceptedRiskIds: props.updateInfo.risks?.map((risk) => risk.id) ?? [],
        trustSignerFingerprint: trustSignerFingerprint.value
      })
    )
    await refreshExtensionContributionSnapshot()

    notify.success('扩展更新成功')
    open.value = false
    emit('updated')
  } catch (error) {
    if (isCancelledUpdateError(error)) {
      notify.info('更新已取消')
      return
    }
    notify.error('更新失败', error instanceof Error ? error.message : String(error))
  } finally {
    updating.value = false
    currentOperationId.value = null
  }
}

async function handleCancel() {
  if (!updating.value || !currentOperationId.value) {
    open.value = false
    return
  }

  cancelling.value = true
  try {
    const cancelled = unwrapIpcData(
      await ipcManager.invoke('extension:cancel-operation', currentOperationId.value)
    )
    if (!cancelled) {
      notify.info('更新已进入提交阶段，无法取消')
    }
  } catch (error) {
    notify.error('取消更新失败', error instanceof Error ? error.message : String(error))
  } finally {
    cancelling.value = false
  }
}

function createOperationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isCancelledUpdateError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('cancel')
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
        <div class="rounded-md border border-border p-3 text-xs text-muted-foreground space-y-2">
          <div class="flex items-center gap-2">
            <Icon
              icon="icon-[mdi--source-repository]"
              class="size-4"
            />
            <span>来源仓库：{{ repositoryLabel }}</span>
          </div>
          <div class="break-all">版本摘要：{{ releaseLabel }}</div>
          <div
            class="flex items-center gap-2"
            :class="signerTone"
          >
            <Icon
              icon="icon-[mdi--signature-freehand]"
              class="size-4"
            />
            <span>{{ signerLabel }}</span>
          </div>
          <div
            v-if="props.updateInfo.release?.changelog?.text"
            class="text-foreground"
          >
            {{ props.updateInfo.release.changelog.text }}
          </div>
        </div>

        <div
          v-if="props.updateInfo.risks?.length"
          class="space-y-2"
        >
          <div
            v-for="risk in props.updateInfo.risks"
            :key="risk.id"
            class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700"
          >
            {{ risk.message }}
          </div>
        </div>

        <label
          v-if="canTrustSigner"
          class="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
        >
          <span>信任此扩展的签名指纹</span>
          <Switch v-model="trustSignerFingerprint" />
        </label>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="cancelling"
          @click="handleCancel"
        >
          <Spinner
            v-if="cancelling"
            class="size-4"
          />
          {{ updating ? '取消更新' : '取消' }}
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
