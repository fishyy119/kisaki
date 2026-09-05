<script setup lang="ts">
/**
 * Scanner List Item
 *
 * Row component for scanner list displaying scanner info,
 * progress, status, and action buttons.
 */

import { ref, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { Icon } from '@renderer/components/ui/icon'
import { scanners as scannersTable, type Scanner } from '@shared/db'
import { isActiveScannerRunStatus } from '@shared/scanner'
import { ipcManager } from '@renderer/core/ipc'
import { useScannerStore } from '@renderer/stores'
import { cn } from '@renderer/utils/cn'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
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
import { ScannerFormDialog } from './scanner-form-dialog'
import ScannerIssuesDialog from './scanner-issues-dialog.vue'
import { Spinner } from '@renderer/components/ui/spinner'
import { TableCell, TableRow } from '@renderer/components/ui/table'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const log = createLogger('Scanner')

const { m, f } = useI18n()

// =============================================================================
// Props
// =============================================================================

interface Props {
  scanner: Scanner
  /** Resolved by the scanner route query; null when unset or hidden. */
  targetCollectionName: string | null
  /** Resolved by the scanner route query; null when unset. */
  scraperProfileName: string | null
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
  <TableRow :class="cn('relative border-border/50 hover:bg-accent/30', isBusy && 'bg-primary/5')">
    <!-- Name column -->
    <TableCell>
      <!-- Progress bar overlay while a run is active; positioned by the row -->
      <div
        v-if="showProgressOverlay"
        class="absolute left-0 top-0 h-full bg-primary/10 transition-all duration-300"
        :style="{ width: `${progress}%` }"
      />

      <span
        class="relative block truncate font-medium"
        :title="props.scanner.name"
      >
        {{ props.scanner.name }}
      </span>
    </TableCell>

    <TableCell class="relative">
      <Button
        variant="link"
        size="sm"
        class="max-w-full min-w-0 justify-start px-0 font-normal text-foreground"
        :tooltip="props.scanner.path"
        @click="handleOpenPath"
      >
        <span class="truncate">{{ props.scanner.path }}</span>
      </Button>
    </TableCell>

    <TableCell class="relative truncate">
      {{ getTypeText(props.scanner.type) }}
    </TableCell>

    <TableCell class="relative">
      <span
        :title="props.scanner.watchEnabled ? m.scanner.item.watching : m.scanner.item.watchDisabled"
      >
        {{ props.scanner.watchEnabled ? m.states.enabled : m.states.disabled }}
      </span>
    </TableCell>

    <!-- Profile column -->
    <TableCell class="relative">
      <span
        class="block truncate"
        :title="props.scraperProfileName ?? undefined"
      >
        {{ props.scraperProfileName || '-' }}
      </span>
    </TableCell>

    <!-- Collection column -->
    <TableCell class="relative">
      <span
        class="block truncate"
        :title="props.targetCollectionName ?? undefined"
      >
        {{ props.targetCollectionName || '-' }}
      </span>
    </TableCell>

    <TableCell class="relative tabular-nums">
      <span :class="scannerState ? 'text-success' : 'text-muted-foreground'">
        {{ scannerState ? f.number(scannerState.newCount) : m.values.emptyValue }}
      </span>
    </TableCell>
    <TableCell class="relative tabular-nums">
      <span :class="!scannerState && 'text-muted-foreground'">
        {{ scannerState ? f.number(scannerState.existingCount) : m.values.emptyValue }}
      </span>
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
    <TableCell class="relative">
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
          :tooltip="m.actions.edit"
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
          :tooltip="m.actions.delete"
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
        <AlertDialogCancel>{{ m.actions.cancel }}</AlertDialogCancel>
        <AlertDialogAction @click="handleDelete">{{ m.actions.delete }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Other Dialogs -->
  <ScannerIssuesDialog
    v-if="isIssuesDialogOpen"
    v-model:open="isIssuesDialogOpen"
    :scanner-id="props.scanner.id"
  />
  <ScannerFormDialog
    v-if="isEditDialogOpen"
    v-model:open="isEditDialogOpen"
    :scanner-id="props.scanner.id"
  />
</template>
