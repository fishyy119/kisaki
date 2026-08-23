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
import { isActiveScannerRunStatus } from '@shared/scanner'
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
import ScannerIssuesDialog from './scanner-issues-dialog.vue'
import { Spinner } from '@renderer/components/ui/spinner'
import { TableCell, TableRow } from '@renderer/components/ui/table'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const log = createLogger('Scanner')

const { m } = useI18n()

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
const isIssuesDialogOpen = ref(false)

// =============================================================================
// Store
// =============================================================================

const scannerStore = useScannerStore()
const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

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
  scannerState.value ? isActiveScannerRunStatus(scannerState.value.status) : false
)
const showProgressOverlay = computed(() => {
  const status = scannerState.value?.status
  return status === 'running' || status === 'pausing' || status === 'paused'
})
const canStartScan = computed(() => {
  const status = scannerState.value?.status
  return !status || status === 'completed' || status === 'cancelled' || status === 'failed'
})
const canPauseScan = computed(() => scannerState.value?.status === 'running')
const canResumeScan = computed(() => {
  const status = scannerState.value?.status
  return status === 'paused' || status === 'pausing'
})
const canCancelScan = computed(() => {
  const status = scannerState.value?.status
  return !!status && isActiveScannerRunStatus(status) && status !== 'cancelling'
})
const isCancelling = computed(() => scannerState.value?.status === 'cancelling')

const progress = computed(() => {
  const state = scannerState.value
  if (!state || state.total === 0) return 0
  return Math.round((state.processedCount / state.total) * 100)
})

const issueCount = computed(() => scannerState.value?.issueCount ?? 0)

const statusInfo = computed(() => {
  const item = m.value.scanner.item
  const state = scannerState.value
  if (!state) {
    return { variant: 'secondary' as const, label: item.statusIdle, spinning: false }
  }

  switch (state.status) {
    case 'queued':
      return { variant: 'secondary' as const, label: item.statusQueued, spinning: true }
    case 'running':
      return {
        variant: 'default' as const,
        label: state.total > 0 ? `${progress.value}%` : item.statusScanning,
        spinning: true
      }
    case 'pausing':
      return { variant: 'warning' as const, label: item.statusPausing, spinning: true }
    case 'paused':
      return { variant: 'warning' as const, label: item.statusPaused, spinning: false }
    case 'cancelling':
      return { variant: 'destructive' as const, label: item.statusCancelling, spinning: true }
    case 'completed':
      return { variant: 'success' as const, label: item.statusCompleted, spinning: false }
    case 'cancelled':
      return { variant: 'destructive' as const, label: item.statusCancelled, spinning: false }
    case 'failed':
      return { variant: 'destructive' as const, label: item.statusFailed, spinning: false }
    default:
      return { variant: 'secondary' as const, label: item.statusIdle, spinning: false }
  }
})

const primaryAction = computed(() => {
  if (canPauseScan.value) {
    return {
      icon: 'icon-[mdi--pause]',
      tooltip: m.value.scanner.item.pause,
      disabled: false,
      handler: handlePause
    }
  }

  if (canResumeScan.value) {
    return {
      icon: 'icon-[mdi--play]',
      tooltip: m.value.scanner.item.resume,
      disabled: false,
      handler: handleResume
    }
  }

  return {
    icon: 'icon-[mdi--play]',
    tooltip: m.value.scanner.item.scan,
    disabled: !canStartScan.value,
    handler: handleScan
  }
})

// =============================================================================
// Helpers
// =============================================================================

function getTypeText(type: Scanner['type']): string {
  return m.value.library.entities[type]
}

// =============================================================================
// Handlers
// =============================================================================

async function handleDelete() {
  await db.delete(scannersTable).where(eq(scannersTable.id, props.scanner.id))
  isDeleteDialogOpen.value = false
}

async function handleScan() {
  if (!canStartScan.value) return

  try {
    await scannerStore.startScan(props.scanner.id)
  } catch (error) {
    log.error('Failed to start scan:', error)
  }
}

async function handlePause() {
  try {
    await scannerStore.pauseScan(props.scanner.id)
  } catch (error) {
    log.error('Failed to pause scan:', error)
  }
}

async function handleResume() {
  try {
    await scannerStore.resumeScan(props.scanner.id)
  } catch (error) {
    log.error('Failed to resume scan:', error)
  }
}

async function handleCancel() {
  try {
    await scannerStore.cancelScan(props.scanner.id)
  } catch (error) {
    log.error('Failed to cancel scan:', error)
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
  <TableRow
    :class="cn('relative h-11 border-border/50 hover:bg-accent/30', isBusy && 'bg-primary/5')"
  >
    <!-- Name column -->
    <TableCell class="pl-4">
      <!-- Progress bar overlay while a run is active; positioned by the row -->
      <div
        v-if="showProgressOverlay"
        class="absolute left-0 top-0 h-full bg-primary/10 transition-all duration-300"
        :style="{ width: `${progress}%` }"
      />

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
          <div class="flex items-center gap-1.5">
            <p class="text-sm font-medium truncate">{{ props.scanner.name }}</p>
            <Tooltip>
              <TooltipTrigger as-child>
                <Icon
                  :icon="
                    props.scanner.watchEnabled
                      ? 'icon-[mdi--radar]'
                      : 'icon-[mdi--hand-back-right-outline]'
                  "
                  :class="
                    cn(
                      'size-3.5 shrink-0',
                      props.scanner.watchEnabled ? 'text-primary' : 'text-muted-foreground'
                    )
                  "
                />
              </TooltipTrigger>
              <TooltipContent>
                {{
                  props.scanner.watchEnabled
                    ? m.scanner.item.watching
                    : m.scanner.item.watchDisabled
                }}
              </TooltipContent>
            </Tooltip>
          </div>
          <p class="text-xs text-muted-foreground truncate">{{ props.scanner.path }}</p>
        </div>
      </div>
    </TableCell>

    <!-- Type column -->
    <TableCell class="relative text-center">
      <span class="text-sm">{{ getTypeText(props.scanner.type) }}</span>
    </TableCell>

    <!-- Profile column -->
    <TableCell class="relative text-center">
      <span class="block truncate text-sm text-muted-foreground">
        {{ profileName || props.scanner.scraperProfileId }}
      </span>
    </TableCell>

    <!-- Collection column -->
    <TableCell class="relative text-center">
      <span class="block truncate text-sm text-muted-foreground">
        {{ collection?.name || '-' }}
      </span>
    </TableCell>

    <!-- Stats columns -->
    <TableCell class="relative">
      <div class="flex items-center justify-center gap-1">
        <template v-if="scannerState">
          <div class="flex items-center gap-2 text-xs">
            <Tooltip>
              <TooltipTrigger as-child>
                <span class="text-success">
                  {{ m.scanner.item.newCount({ count: scannerState.newCount }) }}
                </span>
              </TooltipTrigger>
              <TooltipContent>{{ m.scanner.item.newCountTooltip }}</TooltipContent>
            </Tooltip>
            <span class="text-muted-foreground/50">|</span>
            <Tooltip>
              <TooltipTrigger as-child>
                <span class="text-muted-foreground">
                  {{ m.scanner.item.existingCount({ count: scannerState.existingCount }) }}
                </span>
              </TooltipTrigger>
              <TooltipContent>{{ m.scanner.item.existingCountTooltip }}</TooltipContent>
            </Tooltip>
          </div>
        </template>
        <template v-else>
          <span class="text-sm text-muted-foreground">-</span>
        </template>
      </div>
    </TableCell>

    <!-- Status column -->
    <TableCell class="relative">
      <div class="flex items-center justify-center gap-1">
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
    </TableCell>

    <!-- Actions column -->
    <TableCell class="relative pr-4">
      <div class="flex items-center justify-end gap-0.5">
        <Button
          v-if="scannerState && issueCount > 0"
          variant="ghost"
          size="icon-sm"
          class="text-warning hover:text-warning"
          :tooltip="m.scanner.item.issuesTooltip({ count: issueCount })"
          @click="isIssuesDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--alert-outline]"
            class="size-4"
          />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="primaryAction.tooltip"
          :disabled="primaryAction.disabled"
          @click="primaryAction.handler"
        >
          <Icon
            :icon="primaryAction.icon"
            class="size-4"
          />
        </Button>

        <Button
          v-if="scannerState && isBusy"
          variant="ghost"
          size="icon-sm"
          :tooltip="isCancelling ? m.scanner.item.cancelling : m.scanner.item.cancel"
          :disabled="!canCancelScan"
          class="hover:text-destructive"
          @click="handleCancel"
        >
          <Icon
            icon="icon-[mdi--stop]"
            class="size-4"
          />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.common.edit"
          :disabled="isBusy"
          @click="isEditDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--pencil-outline]"
            class="size-4"
          />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.common.delete"
          :disabled="isBusy"
          class="hover:text-destructive"
          @click="isDeleteDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--delete-outline]"
            class="size-4"
          />
        </Button>
      </div>
    </TableCell>
  </TableRow>

  <!-- Delete Dialog -->
  <AlertDialog v-model:open="isDeleteDialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ m.scanner.item.deleteTitle }}</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogDescription>
        {{ m.scanner.item.deleteDescription({ name: props.scanner.name }) }}
      </AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ m.common.cancel }}</AlertDialogCancel>
        <AlertDialogAction @click="handleDelete">{{ m.common.delete }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Other Dialogs -->
  <ScannerIssuesDialog
    v-if="isIssuesDialogOpen"
    v-model:open="isIssuesDialogOpen"
    :scanner-id="props.scanner.id"
  />
  <ScannerItemFormDialog
    v-if="isEditDialogOpen"
    v-model:open="isEditDialogOpen"
    :scanner-id="props.scanner.id"
  />
</template>
