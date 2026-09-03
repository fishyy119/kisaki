<!--
Catalog Package Details Dialog shows repository releases and install metadata.
Boundary: read-only details plus release request emission.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import semver from 'semver'
import { useI18n } from '@renderer/composables/use-i18n'
import { resolveExtensionText } from '@renderer/core/extensions'
import { formatBytes } from '@renderer/utils/format'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import type {
  ExtensionCatalogPackageInfo,
  ExtensionCatalogReleaseInfo,
  ExtensionCreateRepositoryReleasePlanRequest,
  ExtensionInstalledPackageInfo
} from '@shared/extension'

interface Props {
  extension: ExtensionCatalogPackageInfo
  installedPackage?: ExtensionInstalledPackageInfo | null
}

interface Emits {
  (e: 'apply-release', request: ExtensionCreateRepositoryReleasePlanRequest): void
}

const props = defineProps<Props>()

const { m, f } = useI18n()
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })

const iconError = ref(false)
const displayName = computed(() => resolveExtensionText(props.extension.name))
const displaySummary = computed(() => resolveExtensionText(props.extension.summary))
const displayDescription = computed(() => resolveExtensionText(props.extension.description))
const sortedReleases = computed(() => [...props.extension.releases])

watch(
  () => props.extension.iconUrl,
  () => {
    iconError.value = false
  }
)

function requestReleaseApply(release: ExtensionCatalogReleaseInfo) {
  if (!canApplyRelease(release)) {
    return
  }

  emit('apply-release', {
    sourceKind: 'repository',
    extensionId: props.extension.id,
    releaseId: release.releaseDigest,
    repositoryId: release.repositoryId
  })
}

function canApplyRelease(release: ExtensionCatalogReleaseInfo): boolean {
  return release.compatible && !release.yanked && release.artifact !== null
}

type ReleaseActionKind = 'install' | 'reinstall' | 'update' | 'downgrade' | 'apply'

function getReleaseActionKind(release: ExtensionCatalogReleaseInfo): ReleaseActionKind {
  const currentVersion = props.installedPackage?.version
  if (!currentVersion) {
    return 'install'
  }

  if (currentVersion === release.version) {
    return 'reinstall'
  }

  if (semver.valid(currentVersion) && semver.valid(release.version)) {
    return semver.gt(release.version, currentVersion) ? 'update' : 'downgrade'
  }

  return 'apply'
}

function getReleaseActionLabel(release: ExtensionCatalogReleaseInfo): string {
  return m.value.extension.actions[getReleaseActionKind(release)]
}

function getReleaseActionIcon(release: ExtensionCatalogReleaseInfo): string {
  const kind = getReleaseActionKind(release)
  if (kind === 'install') {
    return 'icon-[mdi--download]'
  }
  if (kind === 'downgrade') {
    return 'icon-[mdi--arrow-down-bold]'
  }
  return 'icon-[mdi--refresh]'
}

function isLatestStableRelease(release: ExtensionCatalogReleaseInfo): boolean {
  return (
    release.releaseDigest === props.extension.latestRelease?.releaseDigest &&
    release.releaseKind === 'stable' &&
    release.compatible &&
    !release.yanked &&
    release.artifact !== null
  )
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return m.value.extension.discover.unknownTime
  }

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return f.value.date(date)
}

function formatSizeLabel(value: number | undefined): string {
  if (!value || value <= 0) {
    return m.value.extension.discover.unknownSize
  }
  return formatBytes(value)
}

function formatReleaseSourceCount(release: ExtensionCatalogReleaseInfo): string {
  const count = release.sources.length || release.repositoryCount
  return m.value.extension.discover.sourceCount({ count })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="lg">
      <DialogHeader>
        <div class="flex items-start gap-3 min-w-0">
          <img
            v-if="props.extension.iconUrl && !iconError"
            :src="props.extension.iconUrl"
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
            <DialogDescription class="mt-1">
              {{ displaySummary }}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <DialogBody class="space-y-5">
        <section class="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <span class="text-muted-foreground">{{ m.extension.discover.extensionId }}</span>
            <div class="font-mono">{{ props.extension.id }}</div>
          </div>
          <div v-if="props.extension.owner">
            <span class="text-muted-foreground">{{ m.extension.discover.author }}</span>
            <div>{{ props.extension.owner.name }}</div>
          </div>
          <div v-if="props.extension.updatedAt">
            <span class="text-muted-foreground">{{ m.extension.discover.latestPublish }}</span>
            <div>{{ formatDate(props.extension.updatedAt) }}</div>
          </div>
          <div v-if="props.extension.homepage">
            <span class="text-muted-foreground">{{ m.extension.discover.homepage }}</span>
            <a
              :href="props.extension.homepage"
              target="_blank"
              rel="noopener noreferrer"
              class="block truncate text-primary hover:underline"
            >
              {{ props.extension.homepage }}
            </a>
          </div>
          <div v-if="props.extension.repository">
            <span class="text-muted-foreground">{{ m.extension.discover.codeRepository }}</span>
            <a
              :href="props.extension.repository"
              target="_blank"
              rel="noopener noreferrer"
              class="block truncate text-primary hover:underline"
            >
              {{ props.extension.repository }}
            </a>
          </div>
        </section>

        <section
          v-if="displayDescription"
          class="text-xs text-muted-foreground leading-relaxed"
        >
          {{ displayDescription }}
        </section>

        <section class="space-y-2">
          <div class="text-sm font-medium">{{ m.extension.discover.versions }}</div>
          <div class="rounded-md border border-border overflow-hidden">
            <div
              v-for="release in sortedReleases"
              :key="release.releaseDigest"
              class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-3 border-b border-border last:border-b-0"
            >
              <div class="min-w-0 space-y-2">
                <div class="flex flex-wrap items-center gap-2 min-w-0">
                  <span class="text-sm font-medium">v{{ release.version }}</span>
                  <Badge
                    v-if="isLatestStableRelease(release)"
                    variant="success"
                    class="h-5"
                  >
                    {{ m.extension.discover.latestBadge }}
                  </Badge>
                  <Badge
                    v-if="release.releaseKind === 'preview'"
                    variant="secondary"
                    class="h-5"
                  >
                    {{ m.extension.discover.previewBadge }}
                  </Badge>
                  <Badge
                    v-if="release.yanked"
                    variant="destructive"
                    class="h-5"
                  >
                    {{ m.extension.discover.yankedBadge }}
                  </Badge>
                  <Badge
                    v-if="!release.compatible"
                    variant="warning"
                    class="h-5"
                  >
                    {{ m.extension.discover.apiIncompatibleBadge }}
                  </Badge>
                  <Badge
                    v-if="!release.artifact"
                    variant="warning"
                    class="h-5"
                  >
                    {{ m.extension.discover.noArtifactBadge }}
                  </Badge>
                  <Badge
                    v-else-if="!release.artifact.signature"
                    variant="warning"
                    class="h-5"
                  >
                    {{ m.extension.discover.unsignedBadge }}
                  </Badge>
                </div>

                <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div>
                    {{
                      m.extension.discover.sourcesLine({ value: formatReleaseSourceCount(release) })
                    }}
                  </div>
                  <div>
                    {{
                      m.extension.discover.publishedLine({ value: formatDate(release.publishedAt) })
                    }}
                  </div>
                  <div>
                    {{
                      m.extension.discover.apiLine({ value: release.engines.kisakiExtensionApi })
                    }}
                  </div>
                  <div>
                    {{
                      m.extension.discover.sizeLine({
                        value: formatSizeLabel(release.artifact?.size)
                      })
                    }}
                  </div>
                </div>
              </div>

              <div class="flex items-start">
                <Button
                  size="sm"
                  :disabled="!canApplyRelease(release)"
                  @click="requestReleaseApply(release)"
                >
                  <Icon
                    :icon="getReleaseActionIcon(release)"
                    class="size-3.5"
                  />
                  {{ getReleaseActionLabel(release) }}
                </Button>
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
