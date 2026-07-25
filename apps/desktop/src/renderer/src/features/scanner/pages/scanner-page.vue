<script setup lang="ts">
/**
 * Scanner Page
 *
 * Main scanner management page.
 * Provides scanner context and displays list of scanners.
 */

import { useScannerProvider } from '../composables'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table'
import { ScannerHeader, ScannerEmptyState, ScannerItem } from '../components'
import { useI18n } from '@renderer/composables/use-i18n'

// =============================================================================
// Context Provider (data settled during navigation by the route loader)
// =============================================================================

const { scanners } = useScannerProvider()

const SCANNER_TABLE_COLUMNS = ['', '6rem', '8rem', '7rem', '7rem', '5rem', '11rem']

const { m } = useI18n()
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page header -->
    <ScannerHeader />

    <!-- Main content - Table-like list -->
    <div class="flex-1 min-h-0 bg-background">
      <!-- Empty -->
      <ScannerEmptyState v-if="scanners.length === 0" />

      <!-- Scanner list -->
      <Table
        v-else
        fixed-header
        :columns="SCANNER_TABLE_COLUMNS"
      >
        <template #header>
          <TableHeader>
            <TableRow class="h-8">
              <TableHead class="pl-4">{{ m.scanner.table.name }}</TableHead>
              <TableHead class="text-center">{{ m.scanner.table.type }}</TableHead>
              <TableHead class="text-center">{{ m.scanner.table.scraperProfile }}</TableHead>
              <TableHead class="text-center">{{ m.scanner.table.targetCollection }}</TableHead>
              <TableHead class="text-center">{{ m.scanner.table.newExisting }}</TableHead>
              <TableHead class="text-center">{{ m.scanner.table.status }}</TableHead>
              <TableHead class="pr-4 text-right">{{ m.scanner.table.actions }}</TableHead>
            </TableRow>
          </TableHeader>
        </template>

        <TableBody>
          <ScannerItem
            v-for="scanner in scanners"
            :key="scanner.id"
            :scanner="scanner"
          />
        </TableBody>
      </Table>
    </div>
  </div>
</template>
