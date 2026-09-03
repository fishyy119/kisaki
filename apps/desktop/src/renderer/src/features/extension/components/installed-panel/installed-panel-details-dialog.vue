<!--
Installed Extension Details Dialog shows read-only metadata for one installed extension.
Boundary: no mutations; includes provenance and verification metadata for troubleshooting.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import type { ExtensionInstalledPackageInfo } from '@shared/extension'
import { resolveExtensionText } from '@renderer/core/extensions'
import { useI18n } from '@renderer/composables/use-i18n'
import { EXTENSION_CATEGORIES } from '../../types/constants'

interface Props {
  extension: ExtensionInstalledPackageInfo
}

const props = defineProps<Props>()

const { m, f } = useI18n()
const open = defineModel<boolean>('open', { required: true })
const iconError = ref(false)

const iconUrl = computed(() => props.extension.iconUrl)
const displayName = computed(() => resolveExtensionText(props.extension.name))
const displayDescription = computed(() => resolveExtensionText(props.extension.description))
const repositorySource = computed(() =>
  props.extension.installationSource?.kind === 'repository'
    ? props.extension.installationSource
    : null
)
const localFileSource = computed(() =>
  props.extension.installationSource?.kind === 'local-file'
    ? props.extension.installationSource
    : null
)
const categoryLabels = computed(() => {
  const labelMap = new Map(
    EXTENSION_CATEGORIES.value.map((category) => [category.id, category.label])
  )
  const labels = props.extension.categories.map((category) => labelMap.get(category) ?? category)
  return labels.length > 0
    ? labels.join(m.value.extension.categories.joinSeparator)
    : m.value.extension.categories.uncategorized
})
const versionLabel = computed(() =>
  props.extension.version
    ? `v${props.extension.version}`
    : m.value.extension.installed.unknownVersion
)
const sourceKindLabel = computed(() => {
  if (props.extension.builtin) {
    return m.value.extension.installed.details.sourceBuiltin
  }

  if (repositorySource.value) {
    return m.value.extension.installed.details.sourceRepository
  }

  if (localFileSource.value) {
    return m.value.extension.installed.details.sourceLocalFile
  }

  return m.value.extension.installed.details.sourceUnknown
})
const packageStatusLabel = computed(() => {
  switch (props.extension.status) {
    case 'ready':
      return m.value.extension.installed.statusReady
    case 'invalid':
      return m.value.extension.installed.statusInvalid
    case 'missing-package':
      return m.value.extension.installed.statusMissingPackage
  }

  return m.value.states.unknown
})
const runtimeStatusLabel = computed(() => {
  if (!props.extension.enabled || props.extension.status !== 'ready') {
    return m.value.extension.installed.runtimeStopped
  }

  switch (props.extension.runtimeStatus) {
    case 'loading':
      return m.value.extension.installed.runtimeLoading
    case 'running':
      return m.value.extension.installed.runtimeRunning
    case 'failed':
      return m.value.extension.installed.runtimeFailed
    case 'stopped':
      return m.value.extension.installed.runtimeStopped
  }

  return m.value.states.unknown
})
const updatePolicyLabel = computed(() => {
  switch (props.extension.updatePolicy ?? 'manual') {
    case 'manual':
      return m.value.extension.policy.manual
    case 'auto':
      return m.value.extension.policy.auto
    case 'pinned':
      return m.value.extension.policy.pinned
  }

  return m.value.states.unknown
})

watch(iconUrl, () => {
  iconError.value = false
})

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return m.value.extension.installed.details.unknownTime
  }

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return f.value.dateTime(date)
}

function formatBoolean(value: boolean | null | undefined): string {
  return value ? m.value.states.yes : m.value.states.no
}

function diagnosticSeverityLabel(severity: string): string {
  switch (severity) {
    case 'info':
      return m.value.extension.installed.details.severityInfo
    case 'warning':
      return m.value.extension.installed.details.severityWarning
    case 'error':
      return m.value.extension.installed.details.severityError
    default:
      return severity
  }
}

function diagnosticSeverityClass(severity: string): string {
  switch (severity) {
    case 'info':
      return 'text-sky-600'
    case 'warning':
      return 'text-amber-600'
    case 'error':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <div class="flex items-start gap-3 min-w-0">
          <img
            v-if="iconUrl && !iconError"
            :src="iconUrl"
            alt=""
            class="size-9 rounded-md border shrink-0"
            @error="iconError = true"
          />
          <Icon
            v-else
            icon="icon-[mdi--puzzle-outline]"
            class="size-9 text-muted-foreground shrink-0"
          />
          <div class="min-w-0 flex-1">
            <DialogTitle>{{ displayName }}</DialogTitle>
            <DialogDescription
              v-if="displayDescription"
              class="mt-1"
            >
              {{ displayDescription }}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <DialogBody class="max-h-[65vh] space-y-5">
        <section class="space-y-2">
          <div class="text-sm font-medium">{{ m.extension.installed.details.basicInfo }}</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0 sm:col-span-2">
              <dt class="text-muted-foreground">{{ m.extension.installed.details.extensionId }}</dt>
              <dd class="font-mono break-all select-text">{{ props.extension.id }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">{{ m.extension.installed.details.version }}</dt>
              <dd>{{ versionLabel }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">{{ m.extension.installed.details.author }}</dt>
              <dd>{{ props.extension.author || m.extension.installed.details.unknownAuthor }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">{{ m.extension.installed.details.category }}</dt>
              <dd>{{ categoryLabels }}</dd>
            </div>
            <div
              v-if="props.extension.installedAt"
              class="min-w-0"
            >
              <dt class="text-muted-foreground">{{ m.extension.installed.details.installedAt }}</dt>
              <dd>{{ formatDate(props.extension.installedAt) }}</dd>
            </div>
            <div
              v-if="props.extension.homepage"
              class="min-w-0 sm:col-span-2"
            >
              <dt class="text-muted-foreground">{{ m.extension.installed.details.homepage }}</dt>
              <dd>
                <a
                  :href="props.extension.homepage"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block truncate text-primary hover:underline"
                >
                  {{ props.extension.homepage }}
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section class="space-y-2">
          <div class="text-sm font-medium">{{ m.extension.installed.details.status }}</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">
                {{ m.extension.installed.details.enabledStatus }}
              </dt>
              <dd>
                {{
                  props.extension.enabled
                    ? m.extension.installed.details.enabled
                    : m.extension.installed.details.disabled
                }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">
                {{ m.extension.installed.details.packageStatus }}
              </dt>
              <dd>{{ packageStatusLabel }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">
                {{ m.extension.installed.details.runtimeStatus }}
              </dt>
              <dd>{{ runtimeStatusLabel }}</dd>
            </div>
            <div
              v-if="props.extension.runtimeError"
              class="min-w-0 sm:col-span-2"
            >
              <dt class="text-muted-foreground">
                {{ m.extension.installed.details.runtimeError }}
              </dt>
              <dd class="break-words text-destructive">{{ props.extension.runtimeError }}</dd>
            </div>
          </dl>
        </section>

        <section class="space-y-2">
          <div class="text-sm font-medium">
            {{ m.extension.installed.details.installationSource }}
          </div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">{{ m.extension.installed.details.sourceType }}</dt>
              <dd>{{ sourceKindLabel }}</dd>
            </div>
            <template v-if="repositorySource">
              <div class="min-w-0">
                <dt class="text-muted-foreground">
                  {{ m.extension.installed.details.repository }}
                </dt>
                <dd class="font-mono break-all select-text">{{ repositorySource.repositoryId }}</dd>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">
                  {{ m.extension.installed.details.repositoryUrl }}
                </dt>
                <dd>
                  <a
                    :href="repositorySource.repositoryUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block break-all text-primary hover:underline"
                  >
                    {{ repositorySource.repositoryUrl }}
                  </a>
                </dd>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">
                  {{ m.extension.installed.details.releaseDigest }}
                </dt>
                <dd class="font-mono break-all select-text">{{ repositorySource.releaseId }}</dd>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">
                  {{ m.extension.installed.details.manifestDigest }}
                </dt>
                <dd class="font-mono break-all select-text">
                  {{ repositorySource.manifestDigest }}
                </dd>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">
                  {{ m.extension.installed.details.artifactSha256 }}
                </dt>
                <dd class="font-mono break-all select-text">
                  {{ repositorySource.artifact.sha256 }}
                </dd>
              </div>
              <div
                v-if="repositorySource.signature?.fingerprint"
                class="min-w-0 sm:col-span-2"
              >
                <dt class="text-muted-foreground">
                  {{ m.extension.installed.details.signerFingerprint }}
                </dt>
                <dd class="font-mono break-all select-text">
                  {{ repositorySource.signature.fingerprint }}
                </dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">
                  {{ m.extension.installed.details.releaseVersion }}
                </dt>
                <dd>v{{ repositorySource.snapshot.release.version }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">
                  {{ m.extension.installed.details.publishedAt }}
                </dt>
                <dd>{{ formatDate(repositorySource.snapshot.release.publishedAt) }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">
                  {{ m.extension.installed.details.extensionApi }}
                </dt>
                <dd>{{ repositorySource.snapshot.release.engines.kisakiExtensionApi }}</dd>
              </div>
            </template>
            <template v-else-if="localFileSource">
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">{{ m.extension.installed.details.file }}</dt>
                <dd class="break-all select-text">{{ localFileSource.path }}</dd>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">
                  {{ m.extension.installed.details.artifactSha256 }}
                </dt>
                <dd class="font-mono break-all select-text">
                  {{ localFileSource.artifactSha256 }}
                </dd>
              </div>
            </template>
            <div class="min-w-0 sm:col-span-2">
              <dt class="text-muted-foreground">{{ m.extension.installed.details.installDir }}</dt>
              <dd class="break-all select-text">{{ props.extension.directory }}</dd>
            </div>
          </dl>
        </section>

        <section
          v-if="!props.extension.builtin"
          class="space-y-2"
        >
          <div class="text-sm font-medium">{{ m.extension.installed.details.updateConfig }}</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">
                {{ m.extension.installed.details.updatePolicy }}
              </dt>
              <dd>{{ updatePolicyLabel }}</dd>
            </div>
            <div
              v-if="props.extension.updatePolicy === 'pinned' && props.extension.pinnedVersion"
              class="min-w-0"
            >
              <dt class="text-muted-foreground">
                {{ m.extension.installed.details.pinnedVersion }}
              </dt>
              <dd>v{{ props.extension.pinnedVersion }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">
                {{ m.extension.installed.details.receivePrerelease }}
              </dt>
              <dd>{{ formatBoolean(props.extension.includePreviewUpdates) }}</dd>
            </div>
          </dl>
        </section>

        <section
          v-if="props.extension.issues.length > 0"
          class="space-y-2"
        >
          <div class="text-sm font-medium">{{ m.extension.installed.details.packageIssues }}</div>
          <ul class="space-y-1 text-xs text-destructive">
            <li
              v-for="issue in props.extension.issues"
              :key="issue"
              class="break-words"
            >
              {{ issue }}
            </li>
          </ul>
        </section>

        <section
          v-if="props.extension.runtimeDiagnostics.length > 0"
          class="space-y-2"
        >
          <div class="text-sm font-medium">
            {{ m.extension.installed.details.runtimeDiagnostics }}
          </div>
          <div class="space-y-2 text-xs">
            <div
              v-for="diagnostic in props.extension.runtimeDiagnostics"
              :key="`${diagnostic.source}:${diagnostic.code}:${diagnostic.createdAt}`"
              class="rounded-md border border-border px-3 py-2 space-y-1"
            >
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  class="font-medium"
                  :class="diagnosticSeverityClass(diagnostic.severity)"
                >
                  {{ diagnosticSeverityLabel(diagnostic.severity) }}
                </span>
                <span class="text-muted-foreground">{{ diagnostic.source }}</span>
                <span class="text-muted-foreground">{{ formatDate(diagnostic.createdAt) }}</span>
              </div>
              <div class="break-words">{{ diagnostic.message }}</div>
              <div
                v-if="diagnostic.details"
                class="break-words text-muted-foreground"
              >
                {{ diagnostic.details }}
              </div>
            </div>
          </div>
        </section>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          @click="open = false"
        >
          {{ m.actions.close }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
