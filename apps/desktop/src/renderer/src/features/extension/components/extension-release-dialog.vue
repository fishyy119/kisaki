<!--
Extension Release Dialog reviews one package release plan before applying it.
Boundary: creates release plans and delegates package mutations to main over IPC.
-->
<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue'
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
import { Field, FieldContent, FieldGroup, FieldLabel } from '@renderer/components/ui/field'
import { Spinner } from '@renderer/components/ui/spinner'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { refreshExtensionContributionSnapshot } from '@renderer/core/extensions'
import { useTaskRunStore } from '@renderer/stores'
import type {
  ExtensionApplyReleaseRequest,
  ExtensionCreateReleasePlanRequest,
  ExtensionInstallUpdatePolicy,
  ExtensionReleaseAction,
  ExtensionReleasePlan
} from '@shared/extension'

interface Props {
  request?: ExtensionCreateReleasePlanRequest | null
  initialPlan?: ExtensionReleasePlan | null
}

interface Emits {
  (e: 'applied'): void
}

const props = withDefaults(defineProps<Props>(), {
  request: null,
  initialPlan: null
})
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })
const taskRunStore = useTaskRunStore()

const plan = ref<ExtensionReleasePlan | null>(null)
const localFilePath = ref<string | null>(null)
const loadingPlan = ref(false)
const applying = ref(false)
const enabled = ref(true)
const updatePolicy = ref<ExtensionInstallUpdatePolicy>('manual')
const trustSignerFingerprint = ref(false)

const title = computed(() => {
  if (plan.value) {
    return `${releaseActionLabel(plan.value.action)}扩展`
  }

  return props.request ? '准备扩展版本' : '导入本地扩展'
})
const description = computed(() => {
  if (plan.value?.sourceKind === 'repository') {
    return '检查版本、仓库来源和签名后继续'
  }

  return '选择本地 .kisx 文件并确认'
})
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
const changelog = computed(() => plan.value?.release?.changelog ?? null)
const confirmLabel = computed(() =>
  plan.value ? `确认${releaseActionLabel(plan.value.action)}` : '选择文件'
)

watch(
  () => [open.value, props.request, props.initialPlan] as const,
  ([isOpen]) => {
    if (!isOpen) {
      return
    }

    resetState()
    if (props.initialPlan) {
      applyPlan(props.initialPlan)
      return
    }

    if (props.request) {
      void createPlan(props.request)
    }
  },
  { immediate: true }
)

async function createPlan(request: ExtensionCreateReleasePlanRequest) {
  loadingPlan.value = true
  try {
    applyPlan(
      unwrapIpcData(
        await ipcManager.invoke(
          'extension:create-release-plan',
          toReleasePlanRequestPayload(request)
        )
      )
    )
  } catch (error) {
    notify.error('无法创建版本计划', error instanceof Error ? error.message : String(error))
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
    applyPlan(
      unwrapIpcData(
        await ipcManager.invoke('extension:create-release-plan', {
          sourceKind: 'local-file',
          filePath
        })
      )
    )
  } catch (error) {
    localFilePath.value = null
    plan.value = null
    notify.error('无法创建版本计划', error instanceof Error ? error.message : String(error))
  } finally {
    loadingPlan.value = false
  }
}

async function handleApply() {
  const currentPlan = plan.value
  if (!currentPlan) {
    await handleSelectLocalFile()
    return
  }

  applying.value = true
  try {
    const started = unwrapIpcData(
      await ipcManager.invoke('extension:apply-release', toApplyReleaseRequest(currentPlan))
    )
    const finalRun = await taskRunStore.waitRun(started.runId)
    if (finalRun.status === 'cancelled') {
      notify.info('操作已取消')
      return
    }
    if (finalRun.status !== 'completed') {
      throw new Error(finalRun.result?.error ?? 'Extension release failed.')
    }

    await refreshExtensionContributionSnapshot()

    notify.success(`扩展${releaseActionLabel(currentPlan.action)}成功`)
    open.value = false
    emit('applied')
  } catch (error) {
    notify.error('操作失败', error instanceof Error ? error.message : String(error))
  } finally {
    applying.value = false
  }
}

function applyPlan(nextPlan: ExtensionReleasePlan) {
  plan.value = nextPlan
  enabled.value = nextPlan.defaultEnabled
  updatePolicy.value = nextPlan.updatePolicy
  trustSignerFingerprint.value = false
  if (nextPlan.localFile?.path) {
    localFilePath.value = nextPlan.localFile.path
  }
}

function toApplyReleaseRequest(currentPlan: ExtensionReleasePlan): ExtensionApplyReleaseRequest {
  if (currentPlan.sourceKind === 'local-file') {
    const filePath = localFilePath.value ?? currentPlan.localFile?.path
    if (!filePath) {
      throw new Error('Local extension file is missing.')
    }

    return {
      sourceKind: 'local-file',
      filePath,
      planId: currentPlan.id,
      planFingerprint: currentPlan.fingerprint,
      enabled: enabled.value
    }
  }

  const release = currentPlan.release
  if (!release) {
    throw new Error('Repository release is missing.')
  }

  return {
    sourceKind: 'repository',
    extensionId: currentPlan.package.id,
    releaseId: release.releaseDigest,
    repositoryId: release.repositoryId,
    planId: currentPlan.id,
    planFingerprint: currentPlan.fingerprint,
    trustSignerFingerprint: trustSignerFingerprint.value,
    enabled: enabled.value,
    updatePolicy: updatePolicy.value
  }
}

function toReleasePlanRequestPayload(
  request: ExtensionCreateReleasePlanRequest
): ExtensionCreateReleasePlanRequest {
  const rawRequest = toRaw(request)
  if (rawRequest.sourceKind === 'local-file') {
    return {
      sourceKind: 'local-file',
      filePath: rawRequest.filePath
    }
  }

  return {
    sourceKind: 'repository',
    extensionId: rawRequest.extensionId,
    releaseId: rawRequest.releaseId,
    repositoryId: rawRequest.repositoryId
  }
}

function resetState() {
  plan.value = null
  localFilePath.value = null
  loadingPlan.value = false
  applying.value = false
  enabled.value = true
  updatePolicy.value = 'manual'
  trustSignerFingerprint.value = false
}

function releaseActionLabel(action: ExtensionReleaseAction): string {
  switch (action) {
    case 'install':
      return '安装'
    case 'update':
      return '更新'
    case 'reinstall':
      return '重新安装'
    case 'downgrade':
      return '降级'
  }
}

function signerLabel(value: ExtensionReleasePlan['signer']['status']): string {
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
  value: ExtensionReleasePlan['signer']['status']
): 'success' | 'warning' | 'destructive' {
  if (value === 'trusted') {
    return 'success'
  }
  if (value === 'changed') {
    return 'destructive'
  }
  return 'warning'
}

function releaseKindLabel(value: ExtensionReleasePlan['package']['releaseKind']): string {
  return value === 'stable' ? '稳定版' : '预览版'
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
          <section class="space-y-3">
            <div class="flex items-start gap-3">
              <Icon
                icon="icon-[mdi--package-variant-closed]"
                class="size-5 text-muted-foreground shrink-0 mt-0.5"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 min-w-0">
                  <div class="text-sm font-medium truncate">{{ plan.package.name }}</div>
                  <Badge
                    variant="secondary"
                    class="text-[10px] h-5"
                  >
                    v{{ plan.package.targetVersion }}
                  </Badge>
                  <Badge
                    variant="outline"
                    class="text-[10px] h-5"
                  >
                    {{ releaseActionLabel(plan.action) }}
                  </Badge>
                  <Badge
                    :variant="signerVariant(plan.signer.status)"
                    class="text-[10px] h-5"
                  >
                    {{ signerLabel(plan.signer.status) }}
                  </Badge>
                </div>
                <div class="mt-1 text-xs text-muted-foreground">
                  <template v-if="plan.repository"> 仓库：{{ plan.repository.name }} </template>
                  <template v-else> 本地文件 · {{ formatBytes(plan.localFile?.size) }} </template>
                </div>
              </div>
            </div>

            <dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div class="min-w-0">
                <dt class="text-muted-foreground">当前版本</dt>
                <dd class="truncate">{{ plan.package.currentVersion ?? '未安装' }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">版本类型</dt>
                <dd>{{ releaseKindLabel(plan.package.releaseKind) }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">签名指纹</dt>
                <dd class="font-mono truncate">{{ plan.signer.fingerprint ?? '无' }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">安装包大小</dt>
                <dd>{{ formatBytes(plan.artifact?.size ?? plan.localFile?.size) }}</dd>
              </div>
            </dl>
          </section>

          <div
            v-if="changelog"
            class="rounded-md border border-border p-3 text-xs"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 space-y-2">
                <div class="font-medium">更新日志</div>
                <p
                  v-if="changelog.text"
                  class="text-muted-foreground whitespace-pre-wrap"
                >
                  {{ changelog.text }}
                </p>
              </div>
              <Button
                v-if="changelog.url"
                variant="outline"
                size="sm"
                class="shrink-0"
                as-child
              >
                <a
                  :href="changelog.url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon
                    icon="icon-[mdi--open-in-new]"
                    class="size-3.5"
                  />
                  查看
                </a>
              </Button>
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

          <FieldGroup>
            <Field orientation="horizontal">
              <FieldLabel>应用后启用</FieldLabel>
              <FieldContent>
                <Switch v-model="enabled" />
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldLabel>更新策略</FieldLabel>
              <FieldContent>
                <Select
                  v-if="plan.sourceKind === 'repository'"
                  v-model="updatePolicy"
                >
                  <SelectTrigger class="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">手动</SelectItem>
                    <SelectItem value="auto">自动</SelectItem>
                    <SelectItem value="pinned">锁定</SelectItem>
                  </SelectContent>
                </Select>
                <Badge
                  v-else
                  variant="secondary"
                >
                  手动
                </Badge>
              </FieldContent>
            </Field>

            <Field
              v-if="canTrustSigner"
              orientation="horizontal"
            >
              <FieldLabel>信任此扩展的签名指纹</FieldLabel>
              <FieldContent>
                <Switch v-model="trustSignerFingerprint" />
              </FieldContent>
            </Field>
          </FieldGroup>
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
          :disabled="applying"
          @click="open = false"
        >
          取消
        </Button>
        <Button
          :disabled="loadingPlan || applying || (!plan && Boolean(props.request))"
          @click="handleApply"
        >
          <Spinner
            v-if="applying"
            class="size-4"
          />
          {{ confirmLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
