<!--
Catalog Package Details Dialog shows repository releases and install metadata.
Boundary: read-only details plus install request emission.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  ExtensionCreateRepositoryInstallPlanRequest
} from '@shared/extension'

interface Props {
  extension: ExtensionCatalogPackageInfo
  installed: boolean
}

interface Emits {
  (e: 'install', request: ExtensionCreateRepositoryInstallPlanRequest): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })

const iconError = ref(false)
const sortedReleases = computed(() => [...props.extension.releases])

watch(
  () => props.extension.iconUrl,
  () => {
    iconError.value = false
  }
)

function installRelease(release: ExtensionCatalogReleaseInfo) {
  if (!canInstallRelease(release)) {
    return
  }

  emit('install', {
    sourceKind: 'repository',
    extensionId: props.extension.id,
    releaseId: release.releaseDigest,
    repositoryId: release.repositoryId
  })
}

function canInstallRelease(release: ExtensionCatalogReleaseInfo): boolean {
  return !props.installed && release.compatible && !release.yanked && release.artifact !== null
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
              {{ props.extension.summary }}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <DialogBody class="max-h-[65vh] overflow-auto scrollbar-thin space-y-5">
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
          v-if="props.extension.description"
          class="text-xs text-muted-foreground leading-relaxed"
        >
          {{ props.extension.description }}
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
                    不兼容
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
                  <div>Kisaki：{{ release.engines.kisaki }}</div>
                  <div>安装包大小：{{ formatBytes(release.artifact?.size) }}</div>
                </div>

                <p
                  v-if="release.changelog?.text"
                  class="text-xs text-muted-foreground line-clamp-2"
                >
                  {{ release.changelog.text }}
                </p>
              </div>

              <div class="flex items-start">
                <Button
                  size="sm"
                  :disabled="!canInstallRelease(release)"
                  @click="installRelease(release)"
                >
                  <Icon
                    icon="icon-[mdi--download]"
                    class="size-3.5"
                  />
                  安装
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
