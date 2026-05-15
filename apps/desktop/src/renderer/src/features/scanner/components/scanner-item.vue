<script setup lang="ts">
/**
 * Scanner List Item
 *
 * Row component for scanner list displaying scanner info,
 * progress, status, and action buttons.
 */

import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { eq, and } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { Icon } from '@renderer/components/ui/icon'
import { scanners as scannersTable, collections, scraperProfiles, type Scanner } from '@shared/db'
import type { ScanProgressData } from '@shared/scanner'
import { ipcManager } from '@renderer/core/ipc'
import { usePreferencesStore, useScannerStore } from '@renderer/stores'
import { useAsyncData } from '@renderer/composables/use-async-data'
import { cn } from '@renderer/utils/cn'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { ScannerItemFormDialog } from './scanner-item-form-dialog'
import ScannerFailedScansDialog from './scanner-failed-scans-dialog.vue'
import { ScannerSkippedScansDialog } from './scanner-skipped-scans-dialog'
import { Spinner } from '@renderer/components/ui/spinner'
import { SCANNER_LIST_GRID_TEMPLATE } from '../utils/scanner-list-layout'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Scanner')

// =============================================================================
// Props
// =============================================================================

interface Props {
  scanner: Scanner
}

const props = defineProps<Props>()

// =============================================================================
// State
// =============================================================================

const isEditDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const isFailedScansDialogOpen = ref(false)
const isSkippedScansDialogOpen = ref(false)

// =============================================================================
// Store
// =============================================================================

const scannerStore = useScannerStore()
const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

const activeStatuses = new Set<ScanProgressData['status']>([
  'queued',
  'scanning',
  'pausing',
  'paused',
  'aborting'
])

// =============================================================================
// Data Fetching
// =============================================================================

// Fetch collection name if exists
const { data: collection } = useAsyncData(
  async () => {
    if (!props.scanner.targetCollectionId) return null
    const data = await db.query.collections.findFirst({
      where: and(
        eq(collections.id, props.scanner.targetCollectionId),
        showNsfw.value ? undefined : eq(collections.isNsfw, false)
      )
    })
    return data ?? null
  },
  { watch: [() => props.scanner.targetCollectionId, showNsfw] }
)

// Fetch profile name
const { data: profileName } = useAsyncData(
  async () => {
    if (!props.scanner.scraperProfileId) return undefined
    const profile = await db.query.scraperProfiles.findFirst({
      where: eq(scraperProfiles.id, props.scanner.scraperProfileId)
    })
    return profile?.name
  },
  { watch: [() => props.scanner.scraperProfileId] }
)

// =============================================================================
// Computed
// =============================================================================

const scannerState = computed(() => scannerStore.getScannerState(props.scanner.id))
const isBusy = computed(() =>
  scannerState.value ? activeStatuses.has(scannerState.value.status) : false
)
const showProgressOverlay = computed(() => {
  const status = scannerState.value?.status
  return status === 'scanning' || status === 'pausing' || status === 'paused'
})
const canStartScan = computed(() => {
  const status = scannerState.value?.status
  return !status || status === 'completed' || status === 'aborted'
})
const canPauseScan = computed(() => scannerState.value?.status === 'scanning')
const canResumeScan = computed(() => {
  const status = scannerState.value?.status
  return status === 'paused' || status === 'pausing'
})
const canAbortScan = computed(() => {
  const status = scannerState.value?.status
  return !!status && activeStatuses.has(status) && status !== 'aborting'
})
const isAborting = computed(() => scannerState.value?.status === 'aborting')

const progress = computed(() => {
  const state = scannerState.value
  if (!state || state.total === 0) return 0
  return Math.round((state.processedCount / state.total) * 100)
})

const statusInfo = computed(() => {
  const state = scannerState.value
  if (!state) {
    return { variant: 'secondary' as const, label: '空闲', spinning: false }
  }

  switch (state.status) {
    case 'queued':
      return { variant: 'secondary' as const, label: '排队中', spinning: true }
    case 'scanning':
      return {
        variant: 'default' as const,
        label: state.total > 0 ? `${progress.value}%` : '扫描中',
        spinning: true
      }
    case 'pausing':
      return { variant: 'warning' as const, label: '暂停中', spinning: true }
    case 'paused':
      return { variant: 'warning' as const, label: '已暂停', spinning: false }
    case 'aborting':
      return { variant: 'destructive' as const, label: '中止中', spinning: true }
    case 'completed':
      return { variant: 'success' as const, label: '完成', spinning: false }
    case 'aborted':
      return { variant: 'destructive' as const, label: '已中止', spinning: false }
    default:
      return { variant: 'secondary' as const, label: '空闲', spinning: false }
  }
})

const primaryAction = computed(() => {
  if (canPauseScan.value) {
    return {
      icon: 'icon-[mdi--pause]',
      tooltip: '暂停',
      disabled: false,
      handler: handlePause
    }
  }

  if (canResumeScan.value) {
    return {
      icon: 'icon-[mdi--play]',
      tooltip: '继续',
      disabled: false,
      handler: handleResume
    }
  }

  return {
    icon: 'icon-[mdi--play]',
    tooltip: '扫描',
    disabled: !canStartScan.value,
    handler: handleScan
  }
})

// =============================================================================
// Helpers
// =============================================================================

function getTypeText(type: Scanner['type']): string {
  if (type === 'game') return '游戏'
  return type
}

// =============================================================================
// Handlers
// =============================================================================

async function handleDelete() {
  await db.delete(scannersTable).where(eq(scannersTable.id, props.scanner.id))
  scannerStore.resetScannerState(props.scanner.id)
  isDeleteDialogOpen.value = false
}

function handleScan() {
  if (!canStartScan.value) return

  try {
    scannerStore.resetScannerState(props.scanner.id)
    ipcManager.send('scanner:scan-game', props.scanner.id)
  } catch (error) {
    log.error('Failed to start scan:', error)
  }
}

async function handlePause() {
  const result = await ipcManager.invoke('scanner:pause-game', props.scanner.id)
  if (!result.success) {
    log.error('Failed to pause scan:', result.error)
  }
}

async function handleResume() {
  const result = await ipcManager.invoke('scanner:resume-game', props.scanner.id)
  if (!result.success) {
    log.error('Failed to resume scan:', result.error)
  }
}

async function handleAbort() {
  const result = await ipcManager.invoke('scanner:abort-game', props.scanner.id)
  if (!result.success) {
    log.error('Failed to abort scan:', result.error)
  }
}

async function handleOpenPath() {
  try {
    await ipcManager.invoke('native:open-path', props.scanner.path)
  } catch (error) {
    log.error('Failed to open path:', error)
  }
}
</script>

<template>
  <div
    :class="
      cn(
        'relative grid items-center h-11 px-4 transition-colors hover:bg-accent/30',
        isBusy && 'bg-primary/5'
      )
    "
    :style="{ gridTemplateColumns: SCANNER_LIST_GRID_TEMPLATE }"
  >
    <!-- Progress bar overlay when scanning -->
    <div
      v-if="showProgressOverlay"
      class="absolute left-0 top-0 h-full bg-primary/10 transition-all duration-300"
      :style="{ width: `${progress}%` }"
    />

    <!-- Name column -->
    <div class="relative min-w-0 flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        class="bg-primary/10 text-primary hover:bg-primary/20"
        @click="handleOpenPath"
      >
        <Icon
          icon="icon-[mdi--folder-open-outline]"
          class="size-4"
        />
      </Button>
      <div class="min-w-0">
        <p class="text-sm font-medium truncate">{{ props.scanner.name }}</p>
        <p class="text-xs text-muted-foreground truncate">{{ props.scanner.path }}</p>
      </div>
    </div>

    <!-- Type column -->
    <div class="relative text-center">
      <span class="text-sm">{{ getTypeText(props.scanner.type) }}</span>
    </div>

    <!-- Profile column -->
    <div class="relative min-w-0 text-center">
      <span class="block truncate text-sm text-muted-foreground">
        {{ profileName || props.scanner.scraperProfileId }}
      </span>
    </div>

    <!-- Collection column -->
    <div class="relative min-w-0 text-center">
      <span class="block truncate text-sm text-muted-foreground">
        {{ collection?.name || '-' }}
      </span>
    </div>

    <!-- Stats columns -->
    <div class="relative flex items-center justify-center gap-1">
      <template v-if="scannerState">
        <div class="flex items-center gap-2 text-xs">
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="text-muted-foreground">{{ scannerState.processedCount }} 处理</span>
            </TooltipTrigger>
            <TooltipContent>已处理文件夹数</TooltipContent>
          </Tooltip>
          <span class="text-muted-foreground/50">|</span>
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="text-success">{{ scannerState.newCount }} 新增</span>
            </TooltipTrigger>
            <TooltipContent>新添加到数据库的游戏数</TooltipContent>
          </Tooltip>
        </div>
      </template>
      <template v-else>
        <span class="text-sm text-muted-foreground">-</span>
      </template>
    </div>

    <!-- Status column -->
    <div class="relative flex items-center justify-center gap-1">
      <Badge
        :variant="statusInfo.variant"
        class="gap-1"
      >
        <Spinner
          v-if="statusInfo.spinning"
          class="size-3"
        />
        {{ statusInfo.label }}
      </Badge>
    </div>

    <!-- Actions column -->
    <div class="relative flex items-center justify-end gap-0.5">
      <Tooltip v-if="scannerState && scannerState.skippedScans.length > 0">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-foreground"
            @click="isSkippedScansDialogOpen = true"
          >
            <Icon
              icon="icon-[mdi--skip-next-outline]"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>跳过 ({{ scannerState.skippedScans.length }})</TooltipContent>
      </Tooltip>

      <Tooltip v-if="scannerState && scannerState.failedScans.length > 0">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-warning hover:text-warning"
            @click="isFailedScansDialogOpen = true"
          >
            <Icon
              icon="icon-[mdi--alert-outline]"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>失败 ({{ scannerState.failedScans.length }})</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="primaryAction.disabled"
            @click="primaryAction.handler"
          >
            <Icon
              :icon="primaryAction.icon"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ primaryAction.tooltip }}</TooltipContent>
      </Tooltip>

      <Tooltip v-if="scannerState && isBusy">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="!canAbortScan"
            class="hover:text-destructive"
            @click="handleAbort"
          >
            <Icon
              icon="icon-[mdi--stop]"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ isAborting ? '中止中' : '中止' }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="isBusy"
            @click="isEditDialogOpen = true"
          >
            <Icon
              icon="icon-[mdi--pencil-outline]"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>编辑</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="isBusy"
            class="hover:text-destructive"
            @click="isDeleteDialogOpen = true"
          >
            <Icon
              icon="icon-[mdi--delete-outline]"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>删除</TooltipContent>
      </Tooltip>
    </div>
  </div>

  <!-- Delete Dialog -->
  <AlertDialog v-model:open="isDeleteDialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认删除</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogDescription>
        确定要删除扫描器「{{ props.scanner.name }}」吗？此操作无法撤销。
      </AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction @click="handleDelete">删除</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Other Dialogs -->
  <ScannerFailedScansDialog
    v-if="isFailedScansDialogOpen"
    v-model:open="isFailedScansDialogOpen"
    :scanner-id="props.scanner.id"
  />
  <ScannerSkippedScansDialog
    v-if="isSkippedScansDialogOpen"
    v-model:open="isSkippedScansDialogOpen"
    :scanner-id="props.scanner.id"
  />
  <ScannerItemFormDialog
    v-if="isEditDialogOpen"
    v-model:open="isEditDialogOpen"
    :scanner-id="props.scanner.id"
  />
</template>
