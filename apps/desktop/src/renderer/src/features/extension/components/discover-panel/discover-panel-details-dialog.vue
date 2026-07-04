<!--
Catalog Package Details Dialog shows repository releases and install metadata.
Boundary: read-only details plus release request emission.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import semver from 'semver'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { getLocalizedBody, getLocalizedSummary } from '../../utils/localized-document'
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
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })

const iconError = ref(false)
const sortedReleases = computed(() => [...props.extension.releases])
const descriptionSummary = computed(() => getLocalizedSummary(props.extension.description))
const descriptionBody = computed(() => getLocalizedBody(props.extension.description))

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

function getReleaseActionLabel(release: ExtensionCatalogReleaseInfo): string {
  const currentVersion = props.installedPackage?.version
  if (!currentVersion) {
    return '安装'
  }

  if (currentVersion === release.version) {
    return '重新安装'
  }

  if (semver.valid(currentVersion) && semver.valid(release.version)) {
    return semver.gt(release.version, currentVersion) ? '更新' : '降级'
  }

  return '应用'
}

function getReleaseActionIcon(release: ExtensionCatalogReleaseInfo): string {
  const label = getReleaseActionLabel(release)
  if (label === '安装') {
    return 'icon-[mdi--download]'
  }
  if (label === '降级') {
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
    return '未知时间'
  }

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return date.toLocaleDateString()
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

function formatReleaseSourceCount(release: ExtensionCatalogReleaseInfo): string {
  const count = release.sources.length || release.repositoryCount
  return `${count} 个来源`
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-3xl">
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
            <DialogTitle>{{ props.extension.name }}</DialogTitle>
            <DialogDescription class="mt-1">
              {{ descriptionSummary }}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <DialogBody class="max-h-[65vh] overflow-auto space-y-5">
        <section class="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <span class="text-muted-foreground">扩展 ID</span>
            <div class="font-mono">{{ props.extension.id }}</div>
          </div>
          <div v-if="props.extension.owner">
            <span class="text-muted-foreground">作者</span>
            <div>{{ props.extension.owner.name }}</div>
          </div>
          <div v-if="props.extension.updatedAt">
            <span class="text-muted-foreground">最近发布</span>
            <div>{{ formatDate(props.extension.updatedAt) }}</div>
          </div>
          <div v-if="props.extension.homepage">
            <span class="text-muted-foreground">主页</span>
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
            <span class="text-muted-foreground">代码仓库</span>
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
          v-if="descriptionBody"
          class="text-xs text-muted-foreground"
        >
          <MarkdownContent
            :content="descriptionBody"
            class="text-muted-foreground"
          />
        </section>

        <section class="space-y-2">
          <div class="text-sm font-medium">版本</div>
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
                    class="text-[10px] h-5"
                  >
                    最新版
                  </Badge>
                  <Badge
                    v-if="release.releaseKind === 'preview'"
                    variant="secondary"
                    class="text-[10px] h-5"
                  >
                    预览版
                  </Badge>
                  <Badge
                    v-if="release.yanked"
                    variant="destructive"
                    class="text-[10px] h-5"
                  >
                    已撤回
                  </Badge>
                  <Badge
                    v-if="!release.compatible"
                    variant="warning"
                    class="text-[10px] h-5"
                  >
                    API 不兼容
                  </Badge>
                  <Badge
                    v-if="!release.artifact"
                    variant="warning"
                    class="text-[10px] h-5"
                  >
                    无可用包
                  </Badge>
                  <Badge
                    v-else-if="!release.artifact.signature"
                    variant="warning"
                    class="text-[10px] h-5"
                  >
                    未签名
                  </Badge>
                </div>

                <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div>来源：{{ formatReleaseSourceCount(release) }}</div>
                  <div>发布时间：{{ formatDate(release.publishedAt) }}</div>
                  <div>扩展 API：{{ release.engines.kisakiExtensionApi }}</div>
                  <div>安装包大小：{{ formatBytes(release.artifact?.size) }}</div>
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
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
