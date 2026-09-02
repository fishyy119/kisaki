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
import { useI18n } from '@renderer/composables/use-i18n'
import { formatBytes } from '@renderer/utils/format'
import { uiLocale } from '@renderer/core/i18n'
import { languageAutonym } from '@shared/i18n'
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

const { m, f } = useI18n()

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
  switch (uiLocale.value) {
    case 'ja':
      return 'ja'
    case 'en':
      return 'en'
    case 'zh-Hans':
    case 'zh-Hant':
      return 'zh-Hans'
    default:
      return DEFAULT_APP_UPDATER_CHANGELOG_LOCALE
  }
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
  return f.value.dateTime(date)
})

const releaseMetaItems = computed(() => {
  const items: string[] = []
  if (release.value?.version) items.push(`v${release.value.version}`)
  if (release.value?.releaseName) items.push(release.value.releaseName)
  if (releaseDateText.value)
    items.push(m.value.updater.dialog.releasedAt({ date: releaseDateText.value }))
  return items
})

const progressPercent = computed(() => {
  const value = downloadProgress.value?.percent ?? 0
  return Math.max(0, Math.min(100, value))
})

const statusText = computed(() => {
  const dialog = m.value.updater.dialog
  if (isChecking.value) return dialog.checking
  if (isDownloading.value) return dialog.downloading

  switch (state.value.status) {
    case 'idle':
      return dialog.idleHint
    case 'checking':
      return dialog.checking
    case 'available':
      return dialog.newVersionAvailable
    case 'downloading':
      return dialog.downloading
    case 'downloaded':
      return dialog.downloaded
    case 'not-available':
      return dialog.upToDate
    case 'error':
      return state.value.error
        ? dialog.failedWithReason({ message: state.value.error })
        : dialog.failed
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

function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s'
  return `${formatBytes(bytesPerSecond)}/s`
}

async function handleCheckForUpdates() {
  try {
    await updaterStore.checkForUpdates()
  } catch (error) {
    notify.error(
      m.value.updater.dialog.checkFailed,
      error instanceof Error ? error.message : String(error)
    )
  }
}

async function handleDownloadUpdate() {
  try {
    await updaterStore.downloadUpdate()
  } catch (error) {
    notify.error(
      m.value.updater.dialog.downloadFailed,
      error instanceof Error ? error.message : String(error)
    )
  }
}

async function handleInstallAndRestart() {
  try {
    await updaterStore.quitAndInstall()
  } catch (error) {
    notify.error(
      m.value.updater.dialog.installFailed,
      error instanceof Error ? error.message : String(error)
    )
  }
}

async function loadChangelog(options: { force: boolean; notifyOnError: boolean }) {
  if (!release.value?.version) return

  try {
    await updaterStore.ensureActiveReleaseChangelog({ force: options.force })
  } catch (error) {
    if (options.notifyOnError) {
      notify.error(
        m.value.updater.dialog.changelogLoadFailed,
        error instanceof Error ? error.message : String(error)
      )
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
        <DialogTitle>{{ m.updater.dialog.title }}</DialogTitle>
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
            <span>{{ m.updater.dialog.downloadProgress }}</span>
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
            <FieldLabel>{{ m.updater.dialog.changelogLabel }}</FieldLabel>
            <SegmentedControl v-model="selectedChangelogLocale">
              <SegmentedControlItem value="zh-Hans">{{
                languageAutonym('zh-Hans')
              }}</SegmentedControlItem>
              <SegmentedControlItem value="en">{{ languageAutonym('en') }}</SegmentedControlItem>
              <SegmentedControlItem value="ja">{{ languageAutonym('ja') }}</SegmentedControlItem>
            </SegmentedControl>
          </div>

          <FieldContent>
            <div class="rounded-md border border-border bg-muted/50 px-3 py-2 min-h-24">
              <div
                v-if="isActiveChangelogLoading"
                class="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Spinner class="size-4" />
                <span>{{ m.updater.dialog.changelogLoading }}</span>
              </div>

              <div
                v-else-if="activeChangelogError"
                class="space-y-2"
              >
                <p class="text-sm text-destructive">
                  {{ m.updater.dialog.changelogError({ message: activeChangelogError }) }}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="handleRetryChangelog"
                >
                  {{ m.actions.retry }}
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
                <p class="text-sm text-muted-foreground">{{ m.updater.dialog.changelogEmpty }}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="handleRetryChangelog"
                >
                  {{ m.actions.retry }}
                </Button>
              </div>

              <p
                v-else
                class="text-sm text-muted-foreground"
              >
                {{ m.updater.dialog.changelogPlaceholder }}
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
          <template v-else>{{ m.updater.dialog.checkUpdates }}</template>
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
            <template v-else>{{ m.updater.dialog.startDownload }}</template>
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
            <template v-else>{{ m.updater.dialog.installAndRestart }}</template>
          </Button>

          <Button
            type="button"
            variant="outline"
            :disabled="isInstalling"
            @click="open = false"
          >
            {{ m.actions.close }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
