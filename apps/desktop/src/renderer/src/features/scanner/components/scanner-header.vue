<script setup lang="ts">
/**
 * Scanner Header
 *
 * Header of the scanner page: the scanner count comes from the page's route
 * data, the actions drive the scanner store.
 */

import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { useScannerStore } from '@renderer/stores'
import { Button } from '@renderer/components/ui/button'
import { ScannerFormDialog } from './scanner-form-dialog'
import ScannerSettingsDialog from './scanner-settings-dialog.vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import { useScanners } from '../composables'

const log = createLogger('Scanner')

const { m } = useI18n()

// =============================================================================
// State
// =============================================================================

const isSettingsDialogOpen = ref(false)
const isCreateDialogOpen = ref(false)

// =============================================================================
// Data
// =============================================================================

const { entries } = useScanners()
const totalScanners = computed(() => entries.value.length)

// =============================================================================
// Scanner State
// =============================================================================

const scannerStore = useScannerStore()

const isScanning = computed(() => scannerStore.hasActiveScans)
const activeScannerIds = computed(() =>
  scannerStore.activeScannerStates.map((state) => state.scannerId)
)

// =============================================================================
// Handlers
// =============================================================================

async function handleScanAll() {
  try {
    await scannerStore.startAllScans()
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
    />

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
  <ScannerSettingsDialog
    v-if="isSettingsDialogOpen"
    v-model:open="isSettingsDialogOpen"
  />
  <ScannerFormDialog
    v-if="isCreateDialogOpen"
    v-model:open="isCreateDialogOpen"
  />
</template>
