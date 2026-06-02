<!--
Extension Update Dialog confirms renderer-owned update intent.
Boundary: calls update IPC after showing the available update summary.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { Switch } from '@renderer/components/ui/switch'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@renderer/components/ui/field'
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
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { refreshExtensionContributionSnapshot } from '@renderer/core/extensions'
import { useTaskRunStore } from '@renderer/stores'
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
const taskRunStore = useTaskRunStore()
const updating = ref(false)
const cancelling = ref(false)
const currentRunId = ref<string | null>(null)
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
const canTrustSigner = computed(() => {
  const signer = props.updateInfo.signer
  return Boolean(signer?.fingerprint && signer.status !== 'trusted' && signer.status !== 'unsigned')
})
const currentRun = computed(() =>
  currentRunId.value ? taskRunStore.getRun(currentRunId.value) : undefined
)
const canCancelCurrentRun = computed(() => currentRun.value?.controls.cancelable !== false)

async function handleUpdate() {
  updating.value = true
  try {
    const started = unwrapIpcData(
      await ipcManager.invoke('extension:update', {
        extensionId: props.extension.id,
        planId: props.updateInfo.planId,
        planFingerprint: props.updateInfo.planFingerprint,
        trustSignerFingerprint: trustSignerFingerprint.value
      })
    )
    currentRunId.value = started.runId
    const finalRun = await taskRunStore.waitRun(started.runId)
    if (finalRun.status === 'cancelled') {
      notify.info('更新已取消')
      return
    }
    if (finalRun.status !== 'completed') {
      throw new Error(finalRun.result?.error ?? 'Extension update failed.')
    }

    await refreshExtensionContributionSnapshot()

    notify.success('扩展更新成功')
    open.value = false
    emit('updated')
  } catch (error) {
    notify.error('更新失败', error instanceof Error ? error.message : String(error))
  } finally {
    updating.value = false
    currentRunId.value = null
  }
}

async function handleCancel() {
  if (!updating.value) {
    open.value = false
    return
  }

  if (!currentRunId.value) {
    return
  }

  if (!canCancelCurrentRun.value) {
    notify.info('更新已进入提交阶段，无法取消')
    return
  }

  cancelling.value = true
  try {
    const cancelled = await taskRunStore.cancelRun(currentRunId.value)
    if (!cancelled) {
      notify.info('更新已进入提交阶段，无法取消')
    }
  } catch (error) {
    notify.error('取消更新失败', error instanceof Error ? error.message : String(error))
  } finally {
    cancelling.value = false
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

      <DialogBody class="space-y-4">
        <div class="rounded-md border border-border p-3 text-xs text-muted-foreground space-y-2">
          <FieldGroup class="gap-2">
            <Field orientation="horizontal">
              <FieldLabel class="text-xs text-muted-foreground">来源仓库</FieldLabel>
              <FieldContent class="justify-self-start">
                <span>{{ repositoryLabel }}</span>
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldLabel class="text-xs text-muted-foreground">签名状态</FieldLabel>
              <FieldContent class="justify-self-start">
                <span :class="signerTone">
                  {{ signerLabel }}
                </span>
              </FieldContent>
            </Field>
          </FieldGroup>

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

        <FieldGroup v-if="canTrustSigner">
          <Field orientation="horizontal">
            <FieldLabel>信任此扩展的签名指纹</FieldLabel>
            <FieldContent>
              <Switch v-model="trustSignerFingerprint" />
            </FieldContent>
          </Field>
        </FieldGroup>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="cancelling || (updating && !canCancelCurrentRun)"
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
