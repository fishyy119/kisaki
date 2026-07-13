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
import { useEvent } from '@renderer/composables/use-event'
import { useScannerStore } from '@renderer/stores'
import { Button } from '@renderer/components/ui/button'
import { ScannerItemFormDialog } from './scanner-item-form-dialog'
import ScannerSettingsFormDialog from './scanner-settings-form-dialog.vue'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Scanner')

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
useEvent('db.inserted', (payload) => {
  if (payload.table === 'scanners') refetch()
})

useEvent('db.updated', (payload) => {
  if (payload.table === 'scanners') refetch()
})

useEvent('db.deleted', (payload) => {
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
  <PageHeader back-to="/library">
    <PageHeaderTitle
      title="扫描器"
      icon="icon-[mdi--folder-search-outline]"
    >
      {{ totalScanners ?? 0 }} 个扫描器
      <template v-if="activeScannerStates > 0"> · {{ activeScannerStates }} 个运行中</template>
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
        添加扫描器
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
        {{ isScanning ? '取消全部' : '扫描全部' }}
      </Button>
      <Button
        variant="secondary"
        size="icon-sm"
        tooltip="扫描器设置"
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
