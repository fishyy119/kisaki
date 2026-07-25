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
import { useI18n } from '@renderer/composables/use-i18n'
import { resolveExtensionText } from '@renderer/core/extensions'
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
const { m } = useI18n()

const plan = ref<ExtensionReleasePlan | null>(null)
const localFilePath = ref<string | null>(null)
const loadingPlan = ref(false)
const applying = ref(false)
const enabled = ref(true)
const updatePolicy = ref<ExtensionInstallUpdatePolicy>('manual')
const trustSignerFingerprint = ref(false)

const title = computed(() => {
  if (plan.value) {
    return m.value.extension.release.actionTitle({ action: releaseActionLabel(plan.value.action) })
  }

  return props.request
    ? m.value.extension.release.prepareTitle
    : m.value.extension.release.importLocalTitle
})
const description = computed(() => {
  if (plan.value?.sourceKind === 'repository') {
    return m.value.extension.release.repositoryDescription
  }

  return m.value.extension.release.localDescription
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
  plan.value
    ? m.value.extension.release.confirmAction({ action: releaseActionLabel(plan.value.action) })
    : m.value.extension.release.selectFile
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
    notify.error(
      m.value.extension.release.planFailed,
      error instanceof Error ? error.message : String(error)
    )
    open.value = false
  } finally {
    loadingPlan.value = false
  }
}

async function handleSelectLocalFile() {
  loadingPlan.value = true
  try {
    const res = await ipcManager.invoke('native:open-dialog', {
      title: m.value.extension.release.filePickerTitle,
      filters: [{ name: m.value.extension.release.filePickerFilterName, extensions: ['kisx'] }],
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
    notify.error(
      m.value.extension.release.planFailed,
      error instanceof Error ? error.message : String(error)
    )
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
      notify.info(m.value.extension.release.cancelled)
      return
    }
    if (finalRun.status !== 'completed') {
      throw new Error(finalRun.result?.error ?? 'Extension release failed.')
    }

    await refreshExtensionContributionSnapshot()

    notify.success(
      m.value.extension.release.applied({ action: releaseActionLabel(currentPlan.action) })
    )
    open.value = false
    emit('applied')
  } catch (error) {
    notify.error(
      m.value.extension.release.applyFailed,
      error instanceof Error ? error.message : String(error)
    )
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
  return m.value.extension.actions[action]
}

function signerLabel(value: ExtensionReleasePlan['signer']['status']): string {
  switch (value) {
    case 'trusted':
      return m.value.extension.release.signerTrusted
    case 'untrusted':
      return m.value.extension.release.signerUntrusted
    case 'changed':
      return m.value.extension.release.signerChanged
    case 'unsigned':
      return m.value.extension.release.signerUnsigned
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
  return value === 'stable'
    ? m.value.extension.release.kindStable
    : m.value.extension.release.kindPreview
}

function formatBytes(value: number | undefined): string {
  if (!value || value <= 0) {
    return m.value.extension.release.unknownSize
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
                  <div class="text-sm font-medium truncate">
                    {{ resolveExtensionText(plan.package.name) }}
                  </div>
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
                  <template v-if="plan.repository">
                    {{ m.extension.release.repositoryLine({ name: plan.repository.name }) }}
                  </template>
                  <template v-else>
                    {{
                      m.extension.release.localFileLine({
                        size: formatBytes(plan.localFile?.size)
                      })
                    }}
                  </template>
                </div>
              </div>
            </div>

            <dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div class="min-w-0">
                <dt class="text-muted-foreground">{{ m.extension.release.currentVersion }}</dt>
                <dd class="truncate">
                  {{ plan.package.currentVersion ?? m.extension.release.notInstalled }}
                </dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">{{ m.extension.release.releaseKind }}</dt>
                <dd>{{ releaseKindLabel(plan.package.releaseKind) }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">{{ m.extension.release.signerFingerprint }}</dt>
                <dd class="font-mono truncate">{{ plan.signer.fingerprint ?? m.common.none }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">{{ m.extension.release.artifactSize }}</dt>
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
                <div class="font-medium">{{ m.extension.release.changelog }}</div>
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
                  {{ m.extension.release.viewChangelog }}
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
            <div class="font-medium">{{ m.extension.release.needsConfirmation }}</div>
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
              <FieldLabel>{{ m.extension.release.enableAfterApply }}</FieldLabel>
              <FieldContent>
                <Switch v-model="enabled" />
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldLabel>{{ m.extension.release.updatePolicy }}</FieldLabel>
              <FieldContent>
                <Select
                  v-if="plan.sourceKind === 'repository'"
                  v-model="updatePolicy"
                >
                  <SelectTrigger class="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{{ m.extension.policy.manual }}</SelectItem>
                    <SelectItem value="auto">{{ m.extension.policy.auto }}</SelectItem>
                    <SelectItem value="pinned">{{ m.extension.policy.pinned }}</SelectItem>
                  </SelectContent>
                </Select>
                <Badge
                  v-else
                  variant="secondary"
                >
                  {{ m.extension.policy.manual }}
                </Badge>
              </FieldContent>
            </Field>

            <Field
              v-if="canTrustSigner"
              orientation="horizontal"
            >
              <FieldLabel>{{ m.extension.release.trustSigner }}</FieldLabel>
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
          <p class="text-sm text-muted-foreground mb-4">
            {{ m.extension.release.pickLocalHint }}
          </p>
          <Button
            variant="outline"
            :disabled="loadingPlan"
            @click="handleSelectLocalFile"
          >
            <Icon
              icon="icon-[mdi--folder-open-outline]"
              class="size-4"
            />
            {{ m.extension.release.selectFile }}
          </Button>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="applying"
          @click="open = false"
        >
          {{ m.common.cancel }}
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
