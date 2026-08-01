<script setup lang="ts">
/**
 * Scanner Header
 *
 * Self-contained header component for the scanner page.
 * Fetches scanner count internally and handles all actions.
 */

import { ref, computed } from 'vue'
import { db } from '@renderer/core/db'
import { Icon } from '@renderer/components/ui/icon'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { scanners } from '@shared/db'
import { useAsyncData } from '@renderer/composables/use-async-data'
import { useDbChanges } from '@renderer/composables/use-db-changes'
import { useScannerStore } from '@renderer/stores'
import { Button } from '@renderer/components/ui/button'
import { ScannerItemFormDialog } from './scanner-item-form-dialog'
import ScannerSettingsFormDialog from './scanner-settings-form-dialog.vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const log = createLogger('Scanner')

const { m } = useI18n()

// =============================================================================
// State
// =============================================================================

const isSettingsDialogOpen = ref(false)
const isCreateDialogOpen = ref(false)

// =============================================================================
// Data Fetching
// =============================================================================

async function fetchScannerCount(): Promise<number> {
  const result = await db.select({ id: scanners.id }).from(scanners)
  return result.length
}

const { data: totalScanners, refetch } = useAsyncData(fetchScannerCount)

// Listen for scanner changes
useDbChanges((payload) => {
  if (payload.table === 'scanners') refetch()
})

// =============================================================================
// Scanner State
// =============================================================================

const scannerStore = useScannerStore()

const activeScannerStates = computed(() => scannerStore.activeScannerStates.length)
const isScanning = computed(() => scannerStore.hasActiveScans)
const activeScannerIds = computed(() =>
  scannerStore.activeScannerStates.map((state) => state.scannerId)
)

// =============================================================================
// Handlers
// =============================================================================

async function handleScanAll() {
  try {
    await scannerStore.startAllGameScans()
  } catch (error) {
    log.error('Failed to scan all:', error)
  }
}

async function handleCancelAll() {
  const results = await Promise.allSettled(
    activeScannerIds.value.map((scannerId) => scannerStore.cancelScan(scannerId))
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      log.error('Failed to cancel scan:', result.reason)
    }
  }
}
</script>

<template>
  <PageHeader>
    <PageHeaderTitle
      :title="m.scanner.title"
      icon="icon-[mdi--folder-search-outline]"
    >
      {{ m.scanner.countSummary({ count: totalScanners ?? 0 }) }}
      <template v-if="activeScannerStates > 0">
        · {{ m.scanner.runningSummary({ count: activeScannerStates }) }}
      </template>
    </PageHeaderTitle>

    <template #actions>
      <Button
        size="sm"
        :disabled="isScanning"
        @click="isCreateDialogOpen = true"
      >
        <Icon
          icon="icon-[mdi--folder-plus-outline]"
          class="size-4"
        />
        {{ m.scanner.addScanner }}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        :disabled="totalScanners === 0"
        @click="isScanning ? handleCancelAll() : handleScanAll()"
      >
        <Icon
          :icon="isScanning ? 'icon-[mdi--stop-circle-outline]' : 'icon-[mdi--refresh]'"
          class="size-4"
        />
        {{ isScanning ? m.scanner.cancelAll : m.scanner.scanAll }}
      </Button>
      <Button
        variant="secondary"
        size="icon-sm"
        :tooltip="m.scanner.settingsTooltip"
        :disabled="isScanning"
        @click="isSettingsDialogOpen = true"
      >
        <Icon
          icon="icon-[mdi--cog-outline]"
          class="size-4"
        />
      </Button>
    </template>
  </PageHeader>

  <!-- Dialogs -->
  <ScannerSettingsFormDialog
    v-if="isSettingsDialogOpen"
    v-model:open="isSettingsDialogOpen"
  />
  <ScannerItemFormDialog
    v-if="isCreateDialogOpen"
    v-model:open="isCreateDialogOpen"
  />
</template>
