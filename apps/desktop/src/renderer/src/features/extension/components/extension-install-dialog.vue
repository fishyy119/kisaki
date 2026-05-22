<!--
Extension Install Dialog reviews install plans before installing.
Boundary: creates repository/local plans and delegates package mutations to main over IPC.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Switch } from '@renderer/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Spinner } from '@renderer/components/ui/spinner'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import type {
  ExtensionCreateRepositoryInstallPlanRequest,
  ExtensionInstallPlan,
  ExtensionInstallUpdatePolicy
} from '@shared/extension'

interface Props {
  request?: ExtensionCreateRepositoryInstallPlanRequest | null
}

interface Emits {
  (e: 'installed'): void
}

const props = withDefaults(defineProps<Props>(), {
  request: null
})
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })

const plan = ref<ExtensionInstallPlan | null>(null)
const localFilePath = ref<string | null>(null)
const loadingPlan = ref(false)
const installing = ref(false)
const enabled = ref(true)
const updatePolicy = ref<ExtensionInstallUpdatePolicy>('manual')
const trustSignerFingerprint = ref(false)

const isRepositoryInstall = computed(() => props.request !== null)
const title = computed(() => (isRepositoryInstall.value ? '安装扩展' : '导入本地扩展'))
const description = computed(() =>
  isRepositoryInstall.value ? '检查版本、仓库来源和签名后继续安装' : '选择本地 .kisx 文件并确认导入'
)
const canTrustSigner = computed(
  () =>
    Boolean(plan.value?.signer.fingerprint) &&
    plan.value?.signer.status !== 'unsigned' &&
    plan.value?.signer.status !== 'trusted'
)
const riskVariant = computed(() => {
  if (!plan.value?.risks.some((risk) => risk.severity === 'danger')) {
    return plan.value?.risks.some((risk) => risk.severity === 'warning') ? 'warning' : 'secondary'
  }

  return 'destructive'
})

watch(
  () => [open.value, props.request] as const,
  ([isOpen]) => {
    if (!isOpen) {
      return
    }

    resetState()
    if (props.request) {
      createRepositoryPlan()
    }
  },
  { immediate: true }
)

async function createRepositoryPlan() {
  if (!props.request) {
    return
  }

  loadingPlan.value = true
  try {
    const request = toRepositoryInstallRequest(props.request)
    plan.value = unwrapIpcData(await ipcManager.invoke('extension:create-install-plan', request))
    enabled.value = plan.value.defaultEnabled
    updatePolicy.value = plan.value.updatePolicy
    trustSignerFingerprint.value = false
  } catch (error) {
    notify.error('无法创建安装计划', error instanceof Error ? error.message : String(error))
    open.value = false
  } finally {
    loadingPlan.value = false
  }
}

async function handleSelectLocalFile() {
  loadingPlan.value = true
  try {
    const res = await ipcManager.invoke('native:open-dialog', {
      title: '选择扩展文件',
      filters: [{ name: '扩展包', extensions: ['kisx'] }],
      properties: ['openFile']
    })

    if (!res.success || res.data.canceled || res.data.filePaths.length === 0) {
      return
    }

    const filePath = res.data.filePaths[0]
    localFilePath.value = filePath
    plan.value = unwrapIpcData(
      await ipcManager.invoke('extension:create-install-plan', {
        sourceKind: 'local-file',
        filePath
      })
    )
    enabled.value = plan.value.defaultEnabled
    updatePolicy.value = plan.value.updatePolicy
  } catch (error) {
    localFilePath.value = null
    plan.value = null
    notify.error('无法创建安装计划', error instanceof Error ? error.message : String(error))
  } finally {
    loadingPlan.value = false
  }
}

async function handleInstall() {
  const currentPlan = plan.value
  if (!currentPlan) {
    if (!isRepositoryInstall.value) {
      await handleSelectLocalFile()
    }
    return
  }

  installing.value = true
  try {
    if (currentPlan.sourceKind === 'repository') {
      const request = toRepositoryInstallRequest(
        props.request ?? {
          sourceKind: 'repository',
          extensionId: currentPlan.package.id,
          releaseId: currentPlan.release?.releaseDigest,
          repositoryId: currentPlan.release?.repositoryId
        }
      )
      unwrapIpcVoid(
        await ipcManager.invoke('extension:install-release', {
          ...request,
          sourceKind: 'repository',
          operationId: createOperationId(),
          planId: currentPlan.id,
          planFingerprint: currentPlan.fingerprint,
          trustSignerFingerprint: trustSignerFingerprint.value,
          enabled: enabled.value,
          updatePolicy: updatePolicy.value
        })
      )
    } else {
      if (!localFilePath.value) {
        throw new Error('Local extension file is missing.')
      }

      unwrapIpcVoid(
        await ipcManager.invoke('extension:install-from-file', {
          operationId: createOperationId(),
          filePath: localFilePath.value,
          planId: currentPlan.id,
          planFingerprint: currentPlan.fingerprint,
          enabled: enabled.value
        })
      )
    }

    notify.success('扩展安装成功')
    open.value = false
    emit('installed')
  } catch (error) {
    notify.error('安装失败', error instanceof Error ? error.message : String(error))
  } finally {
    installing.value = false
  }
}

function resetState() {
  plan.value = null
  localFilePath.value = null
  loadingPlan.value = false
  installing.value = false
  enabled.value = true
  updatePolicy.value = 'manual'
  trustSignerFingerprint.value = false
}

function createOperationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function toRepositoryInstallRequest(
  request: ExtensionCreateRepositoryInstallPlanRequest
): ExtensionCreateRepositoryInstallPlanRequest {
  return {
    sourceKind: 'repository',
    extensionId: request.extensionId,
    releaseId: request.releaseId,
    repositoryId: request.repositoryId
  }
}

function signerLabel(value: ExtensionInstallPlan['signer']['status']): string {
  switch (value) {
    case 'trusted':
      return '签名已信任'
    case 'untrusted':
      return '签名未信任'
    case 'changed':
      return '签名已变更'
    case 'unsigned':
      return '未签名'
  }
}

function signerVariant(
  value: ExtensionInstallPlan['signer']['status']
): 'success' | 'warning' | 'destructive' {
  if (value === 'trusted') {
    return 'success'
  }
  if (value === 'changed') {
    return 'destructive'
  }
  return 'warning'
}

function releaseKindLabel(value: ExtensionInstallPlan['package']['releaseKind']): string {
  return value === 'stable' ? '稳定版' : '预览版'
}

function shortDigest(value: string | null | undefined): string {
  return value ? value.slice(0, 12) : '无'
}

function formatBytes(value: number | undefined): string {
  if (!value || value <= 0) {
    return '未知大小'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>

      <DialogBody class="space-y-4">
        <div
          v-if="loadingPlan"
          class="flex items-center justify-center h-40"
        >
          <Spinner class="size-6" />
        </div>

        <template v-else-if="plan">
          <div class="rounded-md border border-border p-3 space-y-3">
            <div class="flex items-start gap-3">
              <Icon
                icon="icon-[mdi--package-variant-closed]"
                class="size-5 text-muted-foreground shrink-0 mt-0.5"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="text-sm font-medium truncate">{{ plan.package.name }}</div>
                  <Badge
                    variant="secondary"
                    class="text-[10px] h-5"
                  >
                    v{{ plan.package.targetVersion }}
                  </Badge>
                  <Badge
                    :variant="signerVariant(plan.signer.status)"
                    class="text-[10px] h-5"
                  >
                    {{ signerLabel(plan.signer.status) }}
                  </Badge>
                </div>
                <div class="mt-1 text-xs text-muted-foreground">
                  <template v-if="plan.repository">
                    仓库：{{ plan.repository.name }} · 下载主机：{{ plan.artifact?.host ?? '无' }}
                  </template>
                  <template v-else> 本地文件 · {{ formatBytes(plan.localFile?.size) }} </template>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div>当前版本：{{ plan.package.currentVersion ?? '未安装' }}</div>
              <div>版本类型：{{ releaseKindLabel(plan.package.releaseKind) }}</div>
              <div>
                安装包 SHA256：{{ shortDigest(plan.artifact?.sha256 ?? plan.localFile?.sha256) }}
              </div>
              <div>清单摘要：{{ shortDigest(plan.repository?.manifestDigest) }}</div>
              <div>签名指纹：{{ plan.signer.fingerprint ?? '无' }}</div>
              <div>安装包大小：{{ formatBytes(plan.artifact?.size ?? plan.localFile?.size) }}</div>
            </div>
          </div>

          <div
            v-if="plan.risks.length > 0"
            class="rounded-md border p-3 text-xs space-y-2"
            :class="
              riskVariant === 'destructive'
                ? 'border-destructive/40 bg-destructive/5'
                : 'border-warning/40 bg-warning/5'
            "
          >
            <div class="font-medium">需要确认</div>
            <ul class="space-y-1 text-muted-foreground">
              <li
                v-for="risk in plan.risks"
                :key="risk.id"
              >
                {{ risk.message }}
              </li>
            </ul>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <label
              class="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span class="text-sm">安装后启用</span>
              <Switch v-model="enabled" />
            </label>

            <div
              v-if="isRepositoryInstall"
              class="flex items-center gap-2 rounded-md border border-border px-3 py-2"
            >
              <span class="text-sm shrink-0">更新策略</span>
              <Select v-model="updatePolicy">
                <SelectTrigger
                  size="sm"
                  class="flex-1"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">手动</SelectItem>
                  <SelectItem value="auto">自动</SelectItem>
                  <SelectItem value="pinned">锁定</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              v-else
              class="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span class="text-sm">更新策略</span>
              <Badge variant="secondary">手动</Badge>
            </div>

            <label
              v-if="canTrustSigner"
              class="col-span-2 flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span class="text-sm">信任此扩展的签名指纹</span>
              <Switch v-model="trustSignerFingerprint" />
            </label>
          </div>
        </template>

        <div
          v-else
          class="text-center py-8 border border-dashed border-border rounded-md"
        >
          <Icon
            icon="icon-[mdi--folder-zip-outline]"
            class="size-12 text-muted-foreground/50 mx-auto mb-3"
          />
          <p class="text-sm text-muted-foreground mb-4">选择本地扩展包文件 (.kisx)</p>
          <Button
            variant="outline"
            :disabled="loadingPlan"
            @click="handleSelectLocalFile"
          >
            <Icon
              icon="icon-[mdi--folder-open-outline]"
              class="size-4"
            />
            选择文件
          </Button>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="installing"
          @click="open = false"
        >
          取消
        </Button>
        <Button
          :disabled="loadingPlan || installing || !plan"
          @click="handleInstall"
        >
          <Spinner
            v-if="installing"
            class="size-4"
          />
          确认安装
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
