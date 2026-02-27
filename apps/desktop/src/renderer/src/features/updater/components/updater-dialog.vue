<!--
  UpdaterDialog
  Unified update workflow dialog for checking, downloading, and installing app updates.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { notify } from '@renderer/core/notify'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { Spinner } from '@renderer/components/ui/spinner'
import { Progress } from '@renderer/components/ui/progress'
import { Button } from '@renderer/components/ui/button'
import { Field, FieldLabel, FieldContent } from '@renderer/components/ui/field'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { getLocale } from '@renderer/core/i18n'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useUpdaterStore } from '@renderer/stores'
import {
  DEFAULT_APP_UPDATER_CHANGELOG_LOCALE,
  type AppUpdaterChangelogLocale
} from '@shared/updater'

const open = defineModel<boolean>('open', { required: true })

const updaterStore = useUpdaterStore()
const {
  state,
  release,
  downloadProgress,
  isChecking,
  isDownloading,
  isManuallyChecking,
  canStartDownload,
  isStartingDownload,
  hasDownloadedUpdate,
  isInstalling,
  activeChangelog,
  activeChangelogError,
  isActiveChangelogLoading
} = storeToRefs(updaterStore)

function resolveDefaultChangelogLocale(): AppUpdaterChangelogLocale {
  const currentLocale = getLocale().toLowerCase()
  if (currentLocale.startsWith('ja')) return 'ja'
  if (currentLocale.startsWith('en')) return 'en'
  if (currentLocale.startsWith('zh')) return 'zh-Hans'
  return DEFAULT_APP_UPDATER_CHANGELOG_LOCALE
}

const selectedChangelogLocale = ref<AppUpdaterChangelogLocale>(resolveDefaultChangelogLocale())

const hasRelease = computed(() => !!release.value?.version)
const changelogMarkdown = computed(() => {
  if (!activeChangelog.value) return null
  return activeChangelog.value.markdownByLocale[selectedChangelogLocale.value]
})

const releaseDateText = computed(() => {
  const releaseDate = release.value?.releaseDate
  if (!releaseDate) return null

  const date = new Date(releaseDate)
  if (Number.isNaN(date.getTime())) return releaseDate
  return date.toLocaleString()
})

const releaseMetaItems = computed(() => {
  const items: string[] = []
  if (release.value?.version) items.push(`v${release.value.version}`)
  if (release.value?.releaseName) items.push(release.value.releaseName)
  if (releaseDateText.value) items.push(`发布于 ${releaseDateText.value}`)
  return items
})

const progressPercent = computed(() => {
  const value = downloadProgress.value?.percent ?? 0
  return Math.max(0, Math.min(100, value))
})

const statusText = computed(() => {
  switch (state.value.status) {
    case 'idle':
      return '点击「检查更新」开始'
    case 'checking':
      return '正在检查更新...'
    case 'available':
      return '发现新版本'
    case 'downloading':
      return '正在下载更新...'
    case 'downloaded':
      return '更新已下载'
    case 'not-available':
      return '当前已是最新版本'
    case 'error':
      return state.value.error ? `更新失败：${state.value.error}` : '更新失败'
    default:
      return ''
  }
})

const checkButtonDisabled = computed(
  () =>
    isChecking.value ||
    isDownloading.value ||
    isManuallyChecking.value ||
    isStartingDownload.value ||
    isInstalling.value
)

const downloadButtonDisabled = computed(
  () => !canStartDownload.value || isStartingDownload.value || isInstalling.value
)

const installButtonDisabled = computed(() => !hasDownloadedUpdate.value || isInstalling.value)

watch(
  () => release.value?.version ?? null,
  (version) => {
    if (!version) return
    void loadChangelog({ force: false, notifyOnError: false })
  },
  { immediate: true }
)

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s'
  return `${formatBytes(bytesPerSecond)}/s`
}

async function handleCheckForUpdates() {
  try {
    await updaterStore.checkForUpdates()
  } catch (error) {
    notify.error('检查更新失败', error instanceof Error ? error.message : String(error))
  }
}

async function handleDownloadUpdate() {
  try {
    await updaterStore.downloadUpdate()
  } catch (error) {
    notify.error('下载更新失败', error instanceof Error ? error.message : String(error))
  }
}

async function handleInstallAndRestart() {
  try {
    await updaterStore.quitAndInstall()
  } catch (error) {
    notify.error('安装更新失败', error instanceof Error ? error.message : String(error))
  }
}

async function loadChangelog(options: { force: boolean; notifyOnError: boolean }) {
  if (!release.value?.version) return

  try {
    await updaterStore.ensureActiveReleaseChangelog({ force: options.force })
  } catch (error) {
    if (options.notifyOnError) {
      notify.error('获取更新日志失败', error instanceof Error ? error.message : String(error))
    }
  }
}

async function handleRetryChangelog() {
  await loadChangelog({ force: true, notifyOnError: true })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>软件更新</DialogTitle>
      </DialogHeader>

      <DialogBody class="space-y-4 max-h-[70vh] overflow-y-auto">
        <div class="rounded-md border border-border bg-muted/20 text-muted-foreground px-3 py-2">
          <p class="text-sm font-medium leading-5">{{ statusText }}</p>
          <div
            v-if="releaseMetaItems.length"
            class="mt-1.5 flex flex-wrap gap-1.5"
          >
            <span
              v-for="(item, index) in releaseMetaItems"
              :key="`${index}-${item}`"
              class="inline-flex items-center rounded-sm border border-border/60 bg-muted px-1.5 py-0.5 text-xs leading-4"
            >
              {{ item }}
            </span>
          </div>
        </div>

        <div
          v-if="isDownloading && downloadProgress"
          class="rounded-md border border-border px-3 py-2 space-y-2"
        >
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>下载进度</span>
            <span>{{ progressPercent.toFixed(1) }}%</span>
          </div>
          <Progress :model-value="progressPercent" />
          <p class="text-xs text-muted-foreground">
            {{ formatBytes(downloadProgress.transferred) }} /
            {{ formatBytes(downloadProgress.total) }} ·
            {{ formatSpeed(downloadProgress.bytesPerSecond) }}
          </p>
        </div>

        <Field>
          <div class="flex items-center justify-between gap-2">
            <FieldLabel>更新日志</FieldLabel>
            <SegmentedControl v-model="selectedChangelogLocale">
              <SegmentedControlItem value="zh-Hans">简体中文</SegmentedControlItem>
              <SegmentedControlItem value="en">English</SegmentedControlItem>
              <SegmentedControlItem value="ja">日本語</SegmentedControlItem>
            </SegmentedControl>
          </div>

          <FieldContent>
            <div class="rounded-md border border-border bg-card px-3 py-2 min-h-24">
              <div
                v-if="isActiveChangelogLoading"
                class="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Spinner class="size-4" />
                <span>正在加载更新日志...</span>
              </div>

              <div
                v-else-if="activeChangelogError"
                class="space-y-2"
              >
                <p class="text-sm text-destructive">更新日志加载失败：{{ activeChangelogError }}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="handleRetryChangelog"
                >
                  重试
                </Button>
              </div>

              <MarkdownContent
                v-else-if="changelogMarkdown"
                :content="changelogMarkdown"
                class="text-sm px-0 py-0"
              />

              <div
                v-else-if="hasRelease"
                class="space-y-2"
              >
                <p class="text-sm text-muted-foreground">当前语言暂无更新日志</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="handleRetryChangelog"
                >
                  重试
                </Button>
              </div>

              <p
                v-else
                class="text-sm text-muted-foreground"
              >
                检查到更新后会在此显示更新日志
              </p>
            </div>
          </FieldContent>
        </Field>
      </DialogBody>

      <DialogFooter class="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          :disabled="checkButtonDisabled"
          @click="handleCheckForUpdates"
        >
          <Spinner
            v-if="isChecking || isManuallyChecking"
            class="size-4"
          />
          <template v-else>检查更新</template>
        </Button>

        <div class="flex items-center gap-2">
          <Button
            v-if="canStartDownload || isDownloading"
            type="button"
            :disabled="downloadButtonDisabled || isDownloading"
            @click="handleDownloadUpdate"
          >
            <Spinner
              v-if="isDownloading || isStartingDownload"
              class="size-4"
            />
            <template v-else>开始下载</template>
          </Button>

          <Button
            v-if="hasDownloadedUpdate"
            type="button"
            :disabled="installButtonDisabled"
            @click="handleInstallAndRestart"
          >
            <Spinner
              v-if="isInstalling"
              class="size-4"
            />
            <template v-else>更新并重启</template>
          </Button>

          <Button
            type="button"
            variant="outline"
            :disabled="isInstalling"
            @click="open = false"
          >
            关闭
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
